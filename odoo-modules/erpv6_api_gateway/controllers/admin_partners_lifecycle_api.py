# pylint: disable=import-error
"""Admin Partners Lifecycle API — gestione lifecycle_stage + quality_score.

Endpoint per /admin/partners: cambio stage, quality score, motivo degradamento.
Solo admin (base.group_system).

Pattern allineato a admin_deals_api.py.
"""
import json
import logging

from odoo import fields, http
from odoo.http import request

from .consultant_api import ConsultantAPIController

_logger = logging.getLogger(__name__)

VALID_STAGES = ('scouting', 'partner', 'attivo', 'degradato', 'chiuso')


class AdminPartnersLifecycleAPIController(ConsultantAPIController):

    def _require_admin(self):
        user, error_response = self._authenticate(require_auth=True)
        if error_response:
            return None, error_response
        if not user.has_group('base.group_system'):
            return None, self._json_response(
                {'error': 'Riservato agli amministratori'}, 403)
        return user, None

    def _partner_to_dict(self, p):
        return {
            'id': p.id,
            'name': p.name,
            'email': p.email or '',
            'lifecycleStage': p.lifecycle_stage or 'partner',
            'qualityScore': p.quality_score or 0,
            'degradedReason': p.degraded_reason or '',
            'degradedAt': p.degraded_at.isoformat() if p.degraded_at else None,
            'isPlaceholder': p.is_placeholder or False,
            'placeholderCode': p.placeholder_code or '',
        }

    # ── GET /api/v1/admin/partners ──
    @http.route('/api/v1/admin/partners', type='http', auth='none',
                methods=['GET'], csrf=False)
    def list_partners(self, lifecycle_stage=None, search=None, limit=100, **kw):
        _user, error = self._require_admin()
        if error:
            return error

        try:
            limit = min(int(limit), 500)
        except (TypeError, ValueError):
            limit = 100

        Partner = request.env['res.partner'].sudo()

        domain = []
        if lifecycle_stage and lifecycle_stage in VALID_STAGES:
            domain.append(('lifecycle_stage', '=', lifecycle_stage))
        if search:
            domain.append(('name', 'ilike', search))

        partners = Partner.search(domain, limit=limit, order='name')

        # Conteggi per stage (utili per la UI)
        counts = {}
        for stage in VALID_STAGES:
            counts[stage] = Partner.search_count(
                [('lifecycle_stage', '=', stage)])

        return self._json_response({
            'success': True,
            'count': len(partners),
            'counts': counts,
            'partners': [self._partner_to_dict(p) for p in partners],
        })

    # ── GET /api/v1/admin/partners/<id> ──
    @http.route('/api/v1/admin/partners/<int:partner_id>', type='http',
                auth='none', methods=['GET'], csrf=False)
    def get_partner(self, partner_id, **kw):
        _user, error = self._require_admin()
        if error:
            return error

        partner = request.env['res.partner'].sudo().browse(partner_id)
        if not partner.exists():
            return self._json_response({'error': 'Partner non trovato'}, 404)

        return self._json_response({
            'success': True,
            'partner': self._partner_to_dict(partner),
        })

    # ── POST /api/v1/admin/partners/<id>/lifecycle ──
    @http.route('/api/v1/admin/partners/<int:partner_id>/lifecycle',
                type='http', auth='none', methods=['POST'], csrf=False)
    def set_lifecycle(self, partner_id, **kw):
        _user, error = self._require_admin()
        if error:
            return error

        partner = request.env['res.partner'].sudo().browse(partner_id)
        if not partner.exists():
            return self._json_response({'error': 'Partner non trovato'}, 404)

        try:
            body = json.loads(request.httprequest.data or '{}')
        except (ValueError, TypeError):
            return self._json_response({'error': 'JSON non valido'}, 400)

        stage = body.get('stage')
        reason = body.get('reason')
        quality_score = body.get('quality_score')

        if stage is not None and stage not in VALID_STAGES:
            return self._json_response(
                {'error': f"stage non valido. Ammessi: {', '.join(VALID_STAGES)}"},
                400)

        if quality_score is not None:
            try:
                quality_score = int(quality_score)
                if not (0 <= quality_score <= 100):
                    raise ValueError
            except (TypeError, ValueError):
                return self._json_response(
                    {'error': 'quality_score deve essere int 0-100'}, 400)

        vals = {}
        if stage is not None:
            vals['lifecycle_stage'] = stage
        if reason is not None:
            vals['degraded_reason'] = reason
        if quality_score is not None:
            vals['quality_score'] = quality_score

        if not vals:
            return self._json_response(
                {'error': 'Nessun campo da aggiornare'}, 400)

        try:
            partner.write(vals)
            # onchange non scatta su write() diretto → gestisco qui degraded_at
            if stage == 'degradato' and not partner.degraded_at:
                partner.write({'degraded_at': fields.Datetime.now()})
            elif stage and stage != 'degradato' and partner.degraded_at:
                partner.write({'degraded_at': False})
            request.env.cr.commit()
        except Exception as e:  # noqa: BLE001
            _logger.exception("Lifecycle update failed for %s", partner_id)
            return self._json_response({'error': str(e)}, 400)

        return self._json_response({
            'success': True,
            'partner': self._partner_to_dict(partner),
        })
