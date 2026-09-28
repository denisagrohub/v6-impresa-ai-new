# pylint: disable=import-error
"""Admin Deals API — lista e dettaglio deal.

Endpoint per /admin/deals: lista deal raggruppati per progetto,
dettaglio con variabili/leg/participant/prospetto.
Solo admin (base.group_system).
"""
import json
import logging
import time

from odoo import fields, http
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

            # 28/09/2026: richieste di firma collegate al prospetto corrente
            sign_reqs = []
            if d.current_prospetto_id and d.current_prospetto_id.sign_request_ids:
                for sr in d.current_prospetto_id.sign_request_ids:
                    sign_reqs.append({
                        'id': sr.id,
                        'name': sr.name,
                        'status': sr.status,
                        'partnerId': sr.partner_id.id,
                        'partnerName': sr.partner_id.name or '',
                        'partnerEmail': sr.partner_id.email or '',
                        'requestUrl': sr.request_url or '',
                        'externalId': sr.external_id or '',
                        'sentAt': sr.sent_at.isoformat() if sr.sent_at else None,
                        'viewedAt': sr.viewed_at.isoformat() if sr.viewed_at else None,
                        'signedAt': sr.signed_at.isoformat() if sr.signed_at else None,
                        'contractDraftId': sr.contract_draft_id.id if sr.contract_draft_id else None,
                    })
            data['signRequests'] = sign_reqs

        return data




    # ══════════════════════════════════════════════════════════════
    # INCASSI DA CLIENTE (upstream)
    # ══════════════════════════════════════════════════════════════

    @http.route('/api/v1/admin/settlements/<int:settlement_id>/incasso',
                type='http', auth='none', methods=['POST'], csrf=False)
    def registra_incasso(self, settlement_id, **kw):
        if not request.db:
            return self._json_response({})
        user, err = self._require_admin()
        if err:
            return err
        S = request.env['erpv6.deal.settlement'].sudo()
        s = S.browse(settlement_id)
        if not s.exists():
            return self._json_response({'error': 'Settlement non trovato'}, 404)
        try:
            body = json.loads(request.httprequest.data or b'{}')
        except (ValueError, TypeError):
            return self._json_response({'error': 'JSON non valido'}, 400)
        importo = body.get('importo')
        if not importo or float(importo) <= 0:
            return self._json_response({'error': 'Importo obbligatorio > 0'}, 400)
        try:
            s.action_registra_incasso(
                importo=float(importo),
                riferimento=body.get('riferimento', ''),
                note=body.get('note', ''),
            )
            request.env.cr.commit()
            return self._json_response({
                'success': True,
                'settlement': self._settlement_to_dict(s),
            })
        except Exception as e:
            _logger.exception('Errore incasso settlement %s', settlement_id)
            return self._json_response({'error': str(e)}, 400)

    @http.route('/api/v1/admin/settlements/incassi/<int:incasso_id>',
                type='http', auth='none', methods=['DELETE'], csrf=False)
    def delete_incasso(self, incasso_id, **kw):
        if not request.db:
            return self._json_response({})
        user, err = self._require_admin()
        if err:
            return err
        I = request.env['erpv6.deal.settlement.incasso'].sudo()
        i = I.browse(incasso_id)
        if not i.exists():
            return self._json_response({'error': 'Movimento non trovato'}, 404)
        settlement = i.settlement_id
        try:
            i.unlink()
            request.env.cr.commit()
            return self._json_response({
                'success': True,
                'settlement': self._settlement_to_dict(settlement),
            })
        except Exception as e:
            _logger.exception('Errore delete incasso %s', incasso_id)
            return self._json_response({'error': str(e)}, 400)

    # ══════════════════════════════════════════════════════════════
    # AZIONI PAGAMENTO — state machine
    # ══════════════════════════════════════════════════════════════

    @http.route('/api/v1/admin/settlements/lines/<int:line_id>/pagamento',
                type='http', auth='none', methods=['POST'], csrf=False)
    def set_pagamento_stato(self, line_id, **kw):
        if not request.db:
            return self._json_response({})
        user, err = self._require_admin()
        if err:
            return err
        L = request.env['erpv6.deal.settlement.line'].sudo()
        line = L.browse(line_id)
        if not line.exists():
            return self._json_response({'error': 'Linea non trovata'}, 404)
        try:
            body = json.loads(request.httprequest.data or b'{}')
        except (ValueError, TypeError):
            return self._json_response({'error': 'JSON non valido'}, 400)
        action = body.get('action')
        if action == 'fattura_ricevuta':
            line.action_segna_fattura_ricevuta()
        elif action == 'in_pagamento':
            line.action_segna_in_pagamento()
        elif action == 'pagato':
            line.action_segna_pagato()
        elif action == 'contestato':
            line.action_segna_contestato(body.get('motivo'))
        else:
            return self._json_response(
                {'error': f"Azione non valida: {action}. Ammesse: fattura_ricevuta, in_pagamento, pagato, contestato"},
                400)
        request.env.cr.commit()
        return self._json_response({
            'success': True,
            'line': {
                'id': line.id,
                'pagamentoStato': line.pagamento_stato,
                'fatturaRicevutaIl': line.fattura_ricevuta_il.isoformat() if line.fattura_ricevuta_il else None,
                'fatturaScadenza': line.fattura_scadenza.isoformat() if line.fattura_scadenza else None,
                'giorniRitardo': line.giorni_ritardo or 0,
                'paid': line.pagato,
                'paidAt': line.pagato_il.isoformat() if line.pagato_il else None,
            },
        })

    @http.route('/api/v1/admin/settlements/<int:settlement_id>/pagamenti-summary',
                type='http', auth='none', methods=['GET'], csrf=False)
    def get_pagamenti_summary(self, settlement_id, **kw):
        if not request.db:
            return self._json_response({})
        user, err = self._require_admin()
        if err:
            return err
        S = request.env['erpv6.deal.settlement'].sudo()
        s = S.browse(settlement_id)
        if not s.exists():
            return self._json_response({'error': 'Settlement non trovato'}, 404)
        counts = {}
        totale_pagato = 0.0
        totale_da_pagare = 0.0
        for l in s.line_ids:
            st = l.pagamento_stato or 'attesa_fattura'
            counts[st] = counts.get(st, 0) + 1
            if st == 'pagato':
                totale_pagato += l.importo_effettivo or 0
            else:
                totale_da_pagare += l.importo_effettivo or 0
        return self._json_response({
            'success': True,
            'counts': counts,
            'totalePagato': totale_pagato,
            'totaleDaPagare': totale_da_pagare,
            'totale': totale_pagato + totale_da_pagare,
        })

    # ══════════════════════════════════════════════════════════════
    # SETTLEMENT MENSLIE — consuntivi deal V6
    # ══════════════════════════════════════════════════════════════

    def _settlement_to_dict(self, s, include_lines=True):
        d = {
            'id': s.id,
            'name': s.name,
            'dealId': s.deal_id.id,
            'prospettoId': s.prospetto_id.id if s.prospetto_id else None,
            'periodoMese': s.periodo_mese,
            'periodoAnno': s.periodo_anno,
            'state': s.state,
            'quantitaReale': s.quantita_reale or 0,
            'prezzoMedioReale': s.prezzo_medio_reale or 0,
            'feePctReale': s.fee_pct_reale or 0,
            'unita': s.unita or '',
            'transatoTotale': s.transato_totale or 0,
            'ricavoLordo': s.ricavo_lordo or 0,
            'nettoRipartizione': s.netto_ripartizione or 0,
            'transparencyUnlocked': s.transparency_unlocked,
            'noteMensili': s.note_mensili or '',
            'narrativeHtml': s.narrative_html or '',
            # 28/09/2026: incasso upstream
            'incassoModalita': s.incasso_modalita,
            'incassoImporto': s.incasso_importo or 0,
            'incassoStato': s.incasso_stato or 'attesa',
            'incassoPercentuale': s.incasso_percentuale or 0,
            'incassi': [{
                'id': i.id,
                'data': i.data.isoformat() if i.data else None,
                'importo': i.importo,
                'riferimento': i.riferimento or '',
                'source': i.source,
                'matchedAuto': i.matched_auto,
                'note': i.note or '',
            } for i in s.incasso_movimento_ids],
            'computedAt': s.computed_at.isoformat() if s.computed_at else None,
            'frozenAt': s.frozen_at.isoformat() if s.frozen_at else None,
            'frozenBy': s.frozen_by.name if s.frozen_by else None,
            'sentAt': s.sent_at.isoformat() if s.sent_at else None,
            'signedAt': s.signed_at.isoformat() if s.signed_at else None,
            'pdfDocumentId': s.pdf_document_id.id if s.pdf_document_id else None,
            'lineCount': len(s.line_ids),
        }
        if include_lines:
            d['lines'] = [{
                'id': l.id,
                'participantId': l.participant_id.id,
                'partnerName': l.participant_id.partner_id.name,
                'tier': l.participant_id.tier or '',
                'sharePct': (l.participant_id.share_pct or 0) * 100,
                'importoEffettivo': l.importo_effettivo or 0,
                'visibility': l.visibility,
                'causaleFattura': l.causale_fattura or '',
                'sentAt': l.sent_at.isoformat() if l.sent_at else None,
                'paid': l.pagato,
                'paidAt': l.pagato_il.isoformat() if l.pagato_il else None,
                # 28/09/2026: pagamento state machine
                'pagamentoStato': l.pagamento_stato,
                'fatturaRicevutaIl': l.fattura_ricevuta_il.isoformat() if l.fattura_ricevuta_il else None,
                'fatturaScadenza': l.fattura_scadenza.isoformat() if l.fattura_scadenza else None,
                'giorniRitardo': l.giorni_ritardo or 0,
                'contestatoMotivo': l.contestato_motivo or '',
                'notePagamento': l.note_pagamento or '',
                'pagabile': l.pagabile,
                'importoSbloccato': l.importo_sbloccato or 0,
            } for l in s.line_ids]
        return d

    @http.route('/api/v1/admin/deals/<int:deal_id>/settlements', type='http',
                auth='none', methods=['GET'], csrf=False)
    def list_settlements(self, deal_id, **kw):
        if not request.db:
            return self._json_response({})
        user, err = self._require_admin()
        if err:
            return err
        Deal = request.env['erpv6.deal'].sudo()
        d = Deal.browse(deal_id)
        if not d.exists():
            return self._json_response({'error': 'Deal non trovato'}, 404)
        return self._json_response({
            'success': True,
            # 28/09/2026: include_lines=True (piccoli, serve UI espansione)
            'settlements': [self._settlement_to_dict(s, include_lines=True)
                            for s in d.settlement_ids],
        })

    @http.route('/api/v1/admin/deals/<int:deal_id>/settlements', type='http',
                auth='none', methods=['POST'], csrf=False)
    def create_settlement(self, deal_id, **kw):
        if not request.db:
            return self._json_response({})
        user, err = self._require_admin()
        if err:
            return err
        Deal = request.env['erpv6.deal'].sudo()
        d = Deal.browse(deal_id)
        if not d.exists():
            return self._json_response({'error': 'Deal non trovato'}, 404)
        try:
            body = json.loads(request.httprequest.data or b'{}')
        except (ValueError, TypeError):
            return self._json_response({'error': 'JSON non valido'}, 400)
        required = ['periodo_mese', 'periodo_anno']
        for f in required:
            if not body.get(f):
                return self._json_response({'error': f'Campo {f} mancante'}, 400)
        try:
            vals = {
                'deal_id': deal_id,
                'prospetto_id': d.current_prospetto_id.id or False,
                'periodo_mese': str(body['periodo_mese']),
                'periodo_anno': int(body['periodo_anno']),
                'quantita_reale': float(body.get('quantita_reale', 0)),
                'prezzo_medio_reale': float(body.get('prezzo_medio_reale', 0)),
                'fee_pct_reale': float(body.get('fee_pct_reale', 0)),
                'unita': body.get('unita', 'TEE'),
                'note_mensili': body.get('note_mensili', ''),
            }
            s = request.env['erpv6.deal.settlement'].sudo().create(vals)
            request.env.cr.commit()
            return self._json_response({
                'success': True,
                'settlement': self._settlement_to_dict(s),
            })
        except Exception as e:
            _logger.exception('Errore create settlement per deal %s', deal_id)
            return self._json_response({'error': str(e)}, 400)

    @http.route('/api/v1/admin/settlements/<int:settlement_id>/freeze',
                type='http', auth='none', methods=['POST'], csrf=False)
    def freeze_settlement(self, settlement_id, **kw):
        if not request.db:
            return self._json_response({})
        user, err = self._require_admin()
        if err:
            return err
        S = request.env['erpv6.deal.settlement'].sudo()
        s = S.browse(settlement_id)
        if not s.exists():
            return self._json_response({'error': 'Settlement non trovato'}, 404)
        try:
            s.action_freeze()
            s.action_generate_pdf()
            request.env.cr.commit()
            return self._json_response({
                'success': True,
                'settlement': self._settlement_to_dict(s),
            })
        except Exception as e:
            _logger.exception('Errore freeze settlement %s', settlement_id)
            return self._json_response({'error': str(e)}, 400)

    @http.route('/api/v1/admin/settlements/<int:settlement_id>/send-to-sign',
                type='http', auth='none', methods=['POST'], csrf=False)
    def send_settlement_to_sign(self, settlement_id, **kw):
        if not request.db:
            return self._json_response({})
        user, err = self._require_admin()
        if err:
            return err
        S = request.env['erpv6.deal.settlement'].sudo()
        s = S.browse(settlement_id)
        if not s.exists():
            return self._json_response({'error': 'Settlement non trovato'}, 404)
        if not s.pdf_document_id or not s.pdf_document_id.pdf_file:
            return self._json_response(
                {'error': 'PDF non generato: congela prima il consuntivo'}, 400)
        try:
            Sign = request.env['erpv6.sign.request'].sudo()
            sign_ids = []
            # Crea SR per ogni participant con email
            for line in s.line_ids:
                partner = line.participant_id.partner_id
                if not partner or not partner.email:
                    continue
                sr = Sign.create({
                    'name': f'{s.name} — firma {partner.name}',
                    'partner_id': partner.id,
                    'document_id': s.pdf_document_id.id,
                    'related_kind': 'deal_settlement',
                    'related_id': s.id,
                    'related_model': 'erpv6.deal.settlement',
                    'notes': f'Consuntivo {s.periodo_mese}/{s.periodo_anno}',
                })
                sr.action_send_to_sign()
                sign_ids.append(sr.id)
            if not sign_ids:
                return self._json_response(
                    {'error': 'Nessun partecipante con email'}, 400)
            s.write({'state': 'sent', 'sent_at': fields.Datetime.now()})
            request.env.cr.commit()
            return self._json_response({
                'success': True,
                'signRequestIds': sign_ids,
                'settlement': self._settlement_to_dict(s),
            })
        except Exception as e:
            _logger.exception('Errore send-to-sign settlement %s', settlement_id)
            return self._json_response({'error': str(e)}, 400)

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

    # ------------------------------------------------------------------
    # POST /api/v1/admin/deals/<id>/variable — aggiorna una variabile
    # Body: {"name": "v6_entity_pct", "enabled": true, "valueBase": 15.0}
    # Se il deal è frozen, lo riporta a negotiating (auto-unfreeze).
    # ------------------------------------------------------------------
    @http.route('/api/v1/admin/deals/<int:deal_id>/variable', type='http',
                auth='none', methods=['POST'], csrf=False)
    def admin_deal_update_variable(self, deal_id, **kw):
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

        try:
            body = json.loads(request.httprequest.data or b'{}')
        except Exception:
            return self._json_response({'error': 'JSON non valido'}, 400)

        name = body.get('name')
        if not name:
            return self._json_response({'error': 'Parametro name mancante'}, 400)

        var = d.variable_ids.filtered(lambda v: v.name == name)
        if not var:
            return self._json_response(
                {'error': 'Variabile %s non trovata' % name}, 404)

        vals = {}
        if 'enabled' in body:
            vals['enabled'] = bool(body['enabled'])
        if 'valueBase' in body:
            vals['value_base'] = float(body['valueBase'])
        if 'valueMin' in body:
            vals['value_min'] = float(body['valueMin'])
        if 'valueMax' in body:
            vals['value_max'] = float(body['valueMax'])

        try:
            # Se il deal è frozen, lo riporta a negotiating e cancella
            # il prospetto corrente (va rigenerato).
            if d.state in ('frozen', 'signing') and vals:
                if d.current_prospetto_id:
                    d.current_prospetto_id.unlink()
                    d.current_prospetto_id = False
                d.state = 'negotiating'

            var.write(vals)
            request.env.cr.commit()
        except Exception as e:
            _logger.exception('Errore update variable deal %s', deal_id)
            return self._json_response({'error': str(e)}, 400)

        self._log_api_call(
            '/api/v1/admin/deals/%s/variable' % deal_id, 'POST',
            user.id, 200, start_time)
        return self._json_response({
            'success': True,
            'deal': self._deal_to_dict(d, include_detail=True),
        })

    # ------------------------------------------------------------------
    # POST /api/v1/admin/deals/<id>/freeze — congela il deal
    # ------------------------------------------------------------------
    @http.route('/api/v1/admin/deals/<int:deal_id>/freeze', type='http',
                auth='none', methods=['POST'], csrf=False)
    def admin_deal_freeze(self, deal_id, **kw):
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

        try:
            d.action_freeze()
            self.env.cr.commit() if hasattr(self, 'env') else None
            request.env.cr.commit()
        except Exception as e:
            _logger.exception('Errore freeze deal %s', deal_id)
            return self._json_response({'error': str(e)}, 400)

        self._log_api_call(
            '/api/v1/admin/deals/%s/freeze' % deal_id, 'POST', user.id, 200, start_time)
        return self._json_response({
            'success': True,
            'deal': self._deal_to_dict(d, include_detail=True),
        })

    # ------------------------------------------------------------------
    # POST /api/v1/admin/deals/<id>/send-to-sign — invia in firma
    # ------------------------------------------------------------------
    @http.route('/api/v1/admin/deals/<int:deal_id>/send-to-sign', type='http',
                auth='none', methods=['POST'], csrf=False)
    def admin_deal_send_to_sign(self, deal_id, **kw):
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

        try:
            d.action_send_to_sign()
            request.env.cr.commit()
        except Exception as e:
            _logger.exception('Errore send-to-sign deal %s', deal_id)
            return self._json_response({'error': str(e)}, 400)

        self._log_api_call(
            '/api/v1/admin/deals/%s/send-to-sign' % deal_id, 'POST', user.id, 200, start_time)
        return self._json_response({
            'success': True,
            'deal': self._deal_to_dict(d, include_detail=True),
        })
