# pylint: disable=import-error
"""Admin API — timeline eventi + snapshot deal.

30/09/2026 (F1 S5): CRUD eventi + lista snapshot per la tab Storia del
deal. Segue il pattern degli altri endpoint admin (auth + _check_admin_perm).
"""
import logging
import time

from odoo import http
from odoo.http import request

from .admin_deals_api import AdminDealsAPIController

_logger = logging.getLogger(__name__)


class AdminDealEventsAPIController(AdminDealsAPIController):

    def _parse_iso_date(self, s):
        """ISO 8601 → formato Odoo."""
        if not s:
            return False
        try:
            from datetime import datetime
            cleaned = s.replace('Z', '+00:00')
            dt = datetime.fromisoformat(cleaned)
            return dt.strftime('%Y-%m-%d %H:%M:%S')
        except (ValueError, AttributeError):
            return s

    def _deal_event_to_dict(self, ev):
        """Serializza un evento per il frontend."""
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
            'sourceAttachmentId': ev.source_attachment_id.id if ev.source_attachment_id else None,
            'sourceUrl': ev.source_url or '',
            'changesApplied': ev.changes_applied or {},
        }

    def _snapshot_to_dict(self, snap):
        return {
            'id': snap.id,
            'version': snap.version,
            'snapshotDate': self._iso_utc(snap.snapshot_date) if snap.snapshot_date else None,
            'triggerType': snap.trigger_type or '',
            'triggerEventId': snap.trigger_event_id.id if snap.trigger_event_id else None,
            'triggerEventTitle': snap.trigger_event_id.title if snap.trigger_event_id else '',
            'values': snap.values or {},
            'diffFromPrev': snap.diff_from_prev or {},
            'isCurrent': bool(snap.is_current),
            'createdBy': snap.created_by_id.name if snap.created_by_id else '',
            'note': snap.note or '',
        }

    # ─────────────────────────────────────────────────────────────
    # GET  /api/v1/admin/deals/<deal_id>/events
    # POST /api/v1/admin/deals/<deal_id>/events
    # ─────────────────────────────────────────────────────────────
    @http.route('/api/v1/admin/deals/<int:deal_id>/events',
                type='http', auth='none', methods=['GET', 'POST', 'OPTIONS'],
                csrf=False)
    def deal_events(self, deal_id, **kw):
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})

        start_time = time.time()
        user, err = self._authenticate(require_auth=True)
        if err:
            return err
        request.update_env(user=user.id)

        Deal = request.env['erpv6.deal'].sudo()
        deal = Deal.browse(deal_id)
        if not deal.exists():
            return self._json_response({'error': 'Deal non trovato'}, 404)
        _mode = 'read' if request.httprequest.method == 'GET' else 'write'
        err403 = self._require_deal_access(user, deal, mode=_mode)
        if err403:
            return err403

        Event = request.env['erpv6.deal.event'].sudo()

        if request.httprequest.method == 'GET':
            events = Event.search([('deal_id', '=', deal_id)], order='event_date desc, id desc')
            return self._json_response({
                'success': True,
                'events': [self._deal_event_to_dict(e) for e in events],
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
            'deal_id': deal_id,
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
        if body.get('changesApplied'):
            vals['changes_applied'] = body['changesApplied']

        ev = Event.create(vals)

        # Se l'utente ha chiesto di applicare subito le modifiche, fallo
        if body.get('applyChanges') and vals.get('changes_applied'):
            try:
                ev.action_apply_changes()
            except Exception as e:
                _logger.warning('apply_changes fallito: %s', e)

        self._log_api_call(f'/api/v1/admin/deals/{deal_id}/events', 'POST',
                           user.id, 200, start_time)
        return self._json_response({'success': True, 'event': self._deal_event_to_dict(ev)})

    # ─────────────────────────────────────────────────────────────
    # PUT/DELETE  /api/v1/admin/deals/<deal_id>/events/<event_id>
    # ─────────────────────────────────────────────────────────────
    @http.route('/api/v1/admin/deals/<int:deal_id>/events/<int:event_id>',
                type='http', auth='none',
                methods=['PUT', 'DELETE', 'OPTIONS'], csrf=False)
    def deal_event_detail(self, deal_id, event_id, **kw):
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})

        start_time = time.time()
        user, err = self._authenticate(require_auth=True)
        if err:
            return err
        request.update_env(user=user.id)

        Event = request.env['erpv6.deal.event'].sudo()
        ev = Event.browse(event_id)
        if not ev.exists() or ev.deal_id.id != deal_id:
            return self._json_response({'error': 'Evento non trovato'}, 404)
        err403 = self._require_deal_access(user, ev.deal_id, mode='write')
        if err403:
            return err403

        if request.httprequest.method == 'DELETE':
            ev.unlink()
            return self._json_response({'success': True, 'deleted': True})

        # PUT
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
        if 'changesApplied' in body:
            vals['changes_applied'] = body['changesApplied']

        if vals:
            ev.write(vals)

        return self._json_response({'success': True, 'event': self._deal_event_to_dict(ev)})

    # ─────────────────────────────────────────────────────────────
    # GET  /api/v1/admin/deals/<deal_id>/snapshots
    # ─────────────────────────────────────────────────────────────
    @http.route('/api/v1/admin/deals/<int:deal_id>/snapshots',
                type='http', auth='none', methods=['GET', 'OPTIONS'], csrf=False)
    def deal_snapshots(self, deal_id, **kw):
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})

        user, err = self._authenticate(require_auth=True)
        if err:
            return err
        request.update_env(user=user.id)

        Deal = request.env['erpv6.deal'].sudo()
        deal = Deal.browse(deal_id)
        if not deal.exists():
            return self._json_response({'error': 'Deal non trovato'}, 404)
        err403 = self._require_deal_access(user, deal, mode='read')
        if err403:
            return err403

        snaps = deal.snapshot_ids.sorted('version', reverse=True)
        return self._json_response({
            'success': True,
            'snapshots': [self._snapshot_to_dict(s) for s in snaps],
            'currentId': (deal.current_snapshot_id.id if deal.current_snapshot_id else None),
            'total': len(snaps),
        })
