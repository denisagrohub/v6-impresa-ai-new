# pylint: disable=import-error
"""Admin Deals API — lista e dettaglio deal.

Endpoint per /admin/deals: lista deal raggruppati per progetto,
dettaglio con variabili/leg/participant/prospetto.
Solo admin (base.group_system).
"""
import json
import logging
import time

from odoo import http
from odoo.http import request

from .consultant_api import ConsultantAPIController

_logger = logging.getLogger(__name__)


class AdminDealsAPIController(ConsultantAPIController):

    def _require_admin(self):
        user, error_response = self._authenticate(require_auth=True)
        if error_response:
            return None, error_response
        if not user.has_group('base.group_system'):
            return None, self._json_response(
                {'error': 'Riservato agli amministratori'}, 403)
        return user, None

    def _deal_to_dict(self, d, include_detail=False):
        data = {
            'id': d.id,
            'name': d.name,
            'state': d.state,
            'revenueModel': d.revenue_model,
            'schemaCode': d.schema_code,
            'schemaVersion': d.schema_version,
            'relationId': d.relation_id.id if d.relation_id else None,
            'relationName': d.relation_id.name if d.relation_id else None,
            'parentDealId': d.parent_deal_id.id if d.parent_deal_id else None,
            'parentDealName': d.parent_deal_id.name if d.parent_deal_id else None,
            'sellerId': d.seller_id.id if d.seller_id else None,
            'sellerName': d.seller_id.name if d.seller_id else None,
            'sellerIsPlaceholder': d.seller_id.is_placeholder if d.seller_id else False,
            'sellerPlaceholderCode': d.seller_id.placeholder_code if d.seller_id else None,
            'buyerId': d.buyer_id.id if d.buyer_id else None,
            'buyerName': d.buyer_id.name if d.buyer_id else None,
            'buyerIsPlaceholder': d.buyer_id.is_placeholder if d.buyer_id else False,
            'buyerPlaceholderCode': d.buyer_id.placeholder_code if d.buyer_id else None,
            'canFreeze': d.can_freeze,
            'canSign': d.can_sign,
            'missingCriticalCount': d.missing_critical_count,
            'frozenAt': d.frozen_at.isoformat() if d.frozen_at else None,
            'frozenBy': d.frozen_by.name if d.frozen_by else None,
            'currentProspettoId': d.current_prospetto_id.id if d.current_prospetto_id else None,
            'legCount': len(d.leg_ids),
            'participantCount': len(d.participant_ids),
            'variableCount': len(d.variable_ids),
            'notes': d.notes or '',
            'createDate': d.create_date.isoformat() if d.create_date else None,
        }

        if include_detail:
            # Variabili
            data['variables'] = [{
                'id': v.id,
                'name': v.name,
                'label': v.label or v.name,
                'unit': v.unit or '',
                'valueMin': v.value_min,
                'valueBase': v.value_base,
                'valueMax': v.value_max,
                'valueText': v.value_text or '',
                'source': v.source,
                'isCritical': v.is_critical,
                'locked': v.locked,
                'enabled': v.enabled,
            } for v in d.variable_ids]

            # Leg
            data['legs'] = [{
                'id': l.id,
                'sequence': l.sequence,
                'sellerId': l.seller_id.id,
                'sellerName': l.seller_id.name,
                'sellerIsPlaceholder': l.seller_id.is_placeholder,
                'sellerPlaceholderCode': l.seller_id.placeholder_code or '',
                'quantita': l.quantita,
                'prezzoAcquisto': l.prezzo_acquisto,
                'prezzoVendita': l.prezzo_vendita,
                'referralId': l.referral_id.id if l.referral_id else None,
                'notes': l.notes or '',
            } for l in d.leg_ids]

            # Partecipanti
            data['participants'] = [{
                'id': p.id,
                'partnerId': p.partner_id.id,
                'partnerName': p.partner_id.name,
                'role': p.role,
                'tier': p.tier or '',
                'scope': p.scope,
                'scopeRelationId': p.scope_relation_id.id if p.scope_relation_id else None,
                'scopeRelationName': p.scope_relation_id.name if p.scope_relation_id else None,
                'sharePct': p.share_pct,
                'consultantUserId': p.consultant_user_id.id if p.consultant_user_id else None,
                'isReferralPayer': p.is_referral_payer,
                'notes': p.notes or '',
            } for p in d.participant_ids]

            # Prospetto corrente
            if d.current_prospetto_id:
                p = d.current_prospetto_id
                data['prospetto'] = {
                    'id': p.id,
                    'version': p.version,
                    'state': p.state,
                    'computedAt': p.computed_at.isoformat() if p.computed_at else None,
                    'lines': [{
                        'id': line.id,
                        'participantId': line.participant_id.id,
                        'partnerName': line.participant_id.partner_id.name,
                        'role': line.role,
                        'monthlyMin': line.monthly_min,
                        'monthlyBase': line.monthly_base,
                        'monthlyMax': line.monthly_max,
                        'rolling12Min': line.rolling_12_min,
                        'rolling12Base': line.rolling_12_base,
                        'rolling12Max': line.rolling_12_max,
                        'rolling24Min': line.rolling_24_min,
                        'rolling24Base': line.rolling_24_base,
                        'rolling24Max': line.rolling_24_max,
                    } for line in p.line_ids],
                }

        return data

    # ------------------------------------------------------------------
    # GET /api/v1/admin/deals — lista deal + KPI
    # ------------------------------------------------------------------
    @http.route('/api/v1/admin/deals', type='http', auth='none',
                methods=['GET'], csrf=False)
    def admin_deals_list(self, **kw):
        start_time = time.time()
        if not request.db:
            return self._json_response({})
        user, err = self._require_admin()
        if err:
            return err

        Deal = request.env['erpv6.deal'].sudo()
        deals = Deal.search([], order='relation_id, id desc')

        # Raggruppa per progetto
        by_project = {}
        for d in deals:
            key = d.relation_id.id if d.relation_id else 0
            if key not in by_project:
                by_project[key] = {
                    'relationId': key,
                    'relationName': d.relation_id.name if d.relation_id else '(senza progetto)',
                    'deals': [],
                }
            by_project[key]['deals'].append(self._deal_to_dict(d))

        # KPI globali
        total_deals = len(deals)
        active = len(deals.filtered(lambda d: d.state == 'active'))
        frozen = len(deals.filtered(lambda d: d.state == 'frozen'))
        signing = len(deals.filtered(lambda d: d.state == 'signing'))
        forecasting = len(deals.filtered(
            lambda d: d.state in ('forecasting', 'negotiating')))

        # Fee totale / mese (dai prospetti frozen)
        fee_monthly_min = 0.0
        fee_monthly_base = 0.0
        fee_monthly_max = 0.0
        for d in deals:
            if d.current_prospetto_id:
                # Somma linee monthly, esclude i referral (sono costo)
                for line in d.current_prospetto_id.line_ids:
                    if line.participant_id.role != 'referral':
                        fee_monthly_min += line.monthly_min
                        fee_monthly_base += line.monthly_base
                        fee_monthly_max += line.monthly_max

        self._log_api_call('/api/v1/admin/deals', 'GET', user.id, 200, start_time)
        return self._json_response({
            'success': True,
            'groups': list(by_project.values()),
            'kpi': {
                'totalDeals': total_deals,
                'active': active,
                'frozen': frozen,
                'signing': signing,
                'forecasting': forecasting,
                'feeMonthlyMin': round(fee_monthly_min, 2),
                'feeMonthlyBase': round(fee_monthly_base, 2),
                'feeMonthlyMax': round(fee_monthly_max, 2),
            },
        })

    # ------------------------------------------------------------------
    # GET /api/v1/admin/deals/<id> — dettaglio
    # ------------------------------------------------------------------
    @http.route('/api/v1/admin/deals/<int:deal_id>', type='http', auth='none',
                methods=['GET'], csrf=False)
    def admin_deal_detail(self, deal_id, **kw):
        start_time = time.time()
        if not request.db:
            return self._json_response({})
        user, err = self._require_admin()
        if err:
            return err

        Deal = request.env['erpv6.deal'].sudo()
        d = Deal.browse(deal_id)
        if not d.exists():
            return self._json_response({'error': 'Deal non trovato'}, 404)

        self._log_api_call(
            '/api/v1/admin/deals/%s' % deal_id, 'GET', user.id, 200, start_time)
        return self._json_response({
            'success': True,
            'deal': self._deal_to_dict(d, include_detail=True),
        })
