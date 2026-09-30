# pylint: disable=import-error
"""Consultant API — timeline eventi deal (read-only + nota operativa).

30/09/2026 (F1 S5): il consulente vede solo gli eventi con visibility
'consultant' o 'all'. Può aggiungere solo note operative (event_type=
'nota_operativa', visibility='consultant') sui deal dove è participant.
"""
import logging
import time

from odoo import http
from odoo.http import request

from .consultant_api import ConsultantAPIController

_logger = logging.getLogger(__name__)


class ConsultantDealEventsAPIController(ConsultantAPIController):

    def _is_participant(self, deal, user):
        return any(p.partner_id.id == user.partner_id.id for p in deal.participant_ids)

    def _event_to_dict(self, ev):
        return {
            'id': ev.id,
            'dealId': ev.deal_id.id if ev.deal_id else None,
            'eventType': ev.event_type or '',
            'eventDate': self._iso_utc(ev.event_date) if ev.event_date else None,
            'title': ev.title or '',
            'description': ev.description or '',
            'visibility': ev.visibility or 'consultant',
            'isAuto': bool(ev.is_auto),
            'createdBy': ev.created_by_id.name if ev.created_by_id else '',
            'createdAt': self._iso_utc(ev.create_date) if ev.create_date else None,
            'attendees': [{'id': a.id, 'name': a.name or ''} for a in ev.attendees],
            'changesApplied': ev.changes_applied or {},
        }

    @http.route('/api/v1/consultant/deals/<int:deal_id>/events',
                type='http', auth='none', methods=['GET', 'POST', 'OPTIONS'],
                csrf=False)
    def consultant_deal_events(self, deal_id, **kw):
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})

        start_time = time.time()
        user, error_response = self._authenticate(require_auth=True)
        if error_response:
            return error_response

        Deal = request.env['erpv6.deal'].sudo()
        deal = Deal.browse(deal_id)
        if not deal.exists():
            return self._json_response({'error': 'Deal non trovato'}, 404)

        is_admin = self._is_responsabile_o_admin(user)
        if not is_admin and not self._is_participant(deal, user):
            return self._json_response({'error': 'Non sei participant di questo deal'}, 403)

        Event = request.env['erpv6.deal.event'].sudo()

        if request.httprequest.method == 'GET':
            domain = [('deal_id', '=', deal_id)]
            if not is_admin:
                domain.append(('visibility', 'in', ['consultant', 'all']))
            events = Event.search(domain, order='event_date desc, id desc')
            return self._json_response({
                'success': True,
                'events': [self._event_to_dict(e) for e in events],
                'total': len(events),
            })

        # POST: solo nota_operativa, visibility consultant
        try:
            import json
            body = json.loads(request.httprequest.get_data(as_text=True) or '{}')
        except Exception:
            return self._json_response({'error': 'JSON non valido'}, 400)

        if not body.get('title'):
            return self._json_response({'error': 'Titolo obbligatorio'}, 400)

        ev = Event.create({
            'deal_id': deal_id,
            'event_type': 'nota_operativa',
            'title': body['title'],
            'description': body.get('description') or '',
            'visibility': 'consultant',
        })

        return self._json_response({'success': True, 'event': self._event_to_dict(ev)})
