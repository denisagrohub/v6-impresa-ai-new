# pylint: disable=import-error
"""Admin API — timeline eventi su progetti (tracking.relation).

01/10/2026 (est): stesso pattern di admin_deal_events_api, ma agganciato
a erpv6.tracking.relation invece che a erpv6.deal. Serve per registrare
i tavoli di brief, le call, gli incontri su canali e pipeline (non solo
sui deal operativi).
"""
import logging
import time

from odoo import http
from odoo.http import request

from .admin_deals_api import AdminDealsAPIController

_logger = logging.getLogger(__name__)


class AdminRelationEventsAPIController(AdminDealsAPIController):

    def _parse_iso_date(self, s):
        """Converte 'YYYY-MM-DDTHH:MM:SS.sssZ' (ISO 8601 dal browser)
        in 'YYYY-MM-DD HH:MM:SS' (formato Odoo Datetime)."""
        if not s:
            return False
        try:
            # Provo prima ISO (browser JS)
            from datetime import datetime
            cleaned = s.replace('Z', '+00:00')
            dt = datetime.fromisoformat(cleaned)
            # Converto UTC → naive (Odoo usa UTC naive)
            return dt.strftime('%Y-%m-%d %H:%M:%S')
        except (ValueError, AttributeError):
            # Fallback: se già nel formato Odoo, lo lascio
            return s

    def _event_to_dict_relation(self, ev):
        return {
            'id': ev.id,
            'dealId': ev.deal_id.id if ev.deal_id else None,
            'relationId': ev.relation_id.id if ev.relation_id else None,
            'eventType': ev.event_type or '',
            'eventDate': self._iso_utc(ev.event_date) if ev.event_date else None,
            'title': ev.title or '',
            'description': ev.description or '',
            'visibility': ev.visibility or 'consultant',
            'isAuto': bool(ev.is_auto),
            'createdBy': ev.created_by_id.name if ev.created_by_id else '',
            'createdAt': self._iso_utc(ev.create_date) if ev.create_date else None,
            'attendees': [
                {'id': a.id, 'name': a.name or '', 'email': a.email or ''}
                for a in ev.attendees
            ],
            'sourceUrl': ev.source_url or '',
            'changesApplied': ev.changes_applied or {},
        }

    @http.route('/api/v1/admin/relations/<int:relation_id>/events',
                type='http', auth='none',
                methods=['GET', 'POST', 'OPTIONS'], csrf=False)
    def relation_events(self, relation_id, **kw):
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        start_time = time.time()
        user, err = self._authenticate(require_auth=True)
        if err:
            return err
        request.update_env(user=user.id)

        Relation = request.env['erpv6.tracking.relation'].sudo()
        rel = Relation.browse(relation_id)
        if not rel.exists():
            return self._json_response({'error': 'Progetto non trovato'}, 404)
        _mode = 'read' if request.httprequest.method == 'GET' else 'write'
        err403 = self._require_relation_access(user, rel, mode=_mode)
        if err403:
            return err403

        Event = request.env['erpv6.deal.event'].sudo()

        if request.httprequest.method == 'GET':
            events = Event.search([('relation_id', '=', relation_id)],
                                  order='event_date desc, id desc')
            return self._json_response({
                'success': True,
                'events': [self._event_to_dict_relation(e) for e in events],
                'total': len(events),
            })

        # POST
        try:
            import json
            body = json.loads(request.httprequest.get_data(as_text=True) or '{}')
        except Exception:
            return self._json_response({'error': 'JSON non valido'}, 400)

        if not body.get('title'):
            return self._json_response({'error': 'Titolo obbligatorio'}, 400)

        vals = {
            'relation_id': relation_id,
            'event_type': body.get('eventType') or 'nota_operativa',
            'title': body['title'],
            'description': body.get('description') or '',
            'visibility': body.get('visibility') or 'consultant',
            'source_url': body.get('sourceUrl') or False,
        }
        if body.get('eventDate'):
            vals['event_date'] = self._parse_iso_date(body['eventDate'])
        if body.get('attendeeIds'):
            vals['attendees'] = [(6, 0, [int(x) for x in body['attendeeIds']])]

        ev = Event.create(vals)

        self._log_api_call(f'/api/v1/admin/relations/{relation_id}/events', 'POST',
                           user.id, 200, start_time)
        return self._json_response({'success': True, 'event': self._event_to_dict_relation(ev)})

    @http.route('/api/v1/admin/relations/<int:relation_id>/events/<int:event_id>',
                type='http', auth='none',
                methods=['PUT', 'DELETE', 'OPTIONS'], csrf=False)
    def relation_event_detail(self, relation_id, event_id, **kw):
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        user, err = self._authenticate(require_auth=True)
        if err:
            return err
        request.update_env(user=user.id)

        Event = request.env['erpv6.deal.event'].sudo()
        ev = Event.browse(event_id)
        if not ev.exists() or ev.relation_id.id != relation_id:
            return self._json_response({'error': 'Evento non trovato'}, 404)
        err403 = self._require_relation_access(user, ev.relation_id, mode='write')
        if err403:
            return err403

        if request.httprequest.method == 'DELETE':
            ev.unlink()
            return self._json_response({'success': True, 'deleted': True})

        try:
            import json
            body = json.loads(request.httprequest.get_data(as_text=True) or '{}')
        except Exception:
            return self._json_response({'error': 'JSON non valido'}, 400)

        vals = {}
        if 'title' in body: vals['title'] = body['title']
        if 'description' in body: vals['description'] = body['description']
        if 'eventType' in body: vals['event_type'] = body['eventType']
        if 'visibility' in body: vals['visibility'] = body['visibility']
        if 'eventDate' in body and body['eventDate']:
            vals['event_date'] = self._parse_iso_date(body['eventDate'])
        if 'attendeeIds' in body:
            vals['attendees'] = [(6, 0, [int(x) for x in (body['attendeeIds'] or [])])]

        if vals:
            ev.write(vals)

        return self._json_response({'success': True, 'event': self._event_to_dict_relation(ev)})
