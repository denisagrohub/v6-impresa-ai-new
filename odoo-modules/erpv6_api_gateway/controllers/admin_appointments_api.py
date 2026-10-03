# pylint: disable=import-error
"""Admin Appointments API — CRUD calendar.event (C1b-agenda-1a).

Riusa _authenticate di APIBaseController.
Sicurezza R2: partner_ids accettati SOLO se V6 interni (group_user).
"""
import json
import logging

from odoo import fields, http
from odoo.http import request

from .consultant_api import ConsultantAPIController

_logger = logging.getLogger(__name__)


class AdminAppointmentsAPIController(ConsultantAPIController):

    def _event_to_dict(self, e):
        return {
            'id': e.id,
            'name': e.name or '',
            'start': self._iso_utc(e.start) if e.start else None,
            'stop': self._iso_utc(e.stop) if e.stop else None,
            'location': e.location or '',
            'description': e.description or '',
            'relation_id': e.relation_id.id if e.relation_id else None,
            'relation_name': e.relation_id.name if e.relation_id else None,
            'deal_id': e.deal_id.id if e.deal_id else None,
            'deal_name': e.deal_id.name if e.deal_id else None,
            'external_attendees': e.external_attendees or '',
            'telegram_reminder_sent_at': self._iso_utc(e.telegram_reminder_sent_at)
                if e.telegram_reminder_sent_at else None,
            'attendee_ids': e.attendee_ids.ids,
            'attendee_names': [a.partner_id.name for a in e.attendee_ids],
            'user_id': e.user_id.id if e.user_id else None,
            'user_name': e.user_id.name if e.user_id else None,
            'is_v6': bool(e.relation_id),
        }

    def _is_v6_partner(self, partner):
        """R2: partner accettato solo se uno user V6 (group_user)."""
        for u in partner.user_ids:
            if u.has_group('base.group_user') and u.active:
                return True
        return False

    def _parse_datetime(self, s):
        """Parsing ISO tollerante (from '2026-10-15T10:00' o '10:00:00')."""
        if not s:
            return False
        s = s.replace('T', ' ')
        # Rimuovi timezone se presente (naive)
        if '+' in s:
            s = s.split('+')[0].strip()
        if s.endswith('Z'):
            s = s[:-1]
        return s

    # ═══════════════════════════════════════════════════════════════
    # GET /api/v1/admin/appointments
    # ═══════════════════════════════════════════════════════════════
    @http.route('/api/v1/admin/appointments', type='http', auth='none',
                methods=['GET', 'OPTIONS'], csrf=False)
    def list_appointments(self, **kwargs):  # pylint: disable=unused-argument
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        user, err = self._authenticate(require_auth=True)
        if err:
            return err

        args = request.httprequest.args
        date_from = (args.get('from') or '').strip()
        date_to = (args.get('to') or '').strip()
        scope = (args.get('scope') or 'mine').strip().lower()
        is_admin = self._is_strict_admin(user)

        domain = [('is_v6_managed', '=', True)]  # 03/10/2026: solo eventi gestiti da API V6
        if date_from:
            domain.append(('start', '>=', date_from + ' 00:00:00'))
        if date_to:
            domain.append(('start', '<=', date_to + ' 23:59:59'))
        if scope == 'mine':
            domain.append(('partner_ids', 'in', [user.partner_id.id]))
        elif scope == 'all' and not is_admin:
            return self._json_response({'error': 'scope=all solo admin'}, 403)

        E = request.env['calendar.event'].sudo()
        events = E.search(domain, order='start asc', limit=200)
        return self._json_response({
            'appointments': [self._event_to_dict(e) for e in events],
            'total': len(events),
        })

    # ═══════════════════════════════════════════════════════════════
    # GET /<id>
    # ═══════════════════════════════════════════════════════════════
    @http.route('/api/v1/admin/appointments/<int:eid>', type='http', auth='none',
                methods=['GET', 'OPTIONS'], csrf=False)
    def get_appointment(self, eid, **kwargs):  # pylint: disable=unused-argument
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        user, err = self._authenticate(require_auth=True)
        if err:
            return err

        E = request.env['calendar.event'].sudo()
        e = E.browse(eid)
        if not e.exists():
            return self._json_response({'error': 'not found'}, 404)
        return self._json_response(self._event_to_dict(e))

    # ═══════════════════════════════════════════════════════════════
    # POST /
    # ═══════════════════════════════════════════════════════════════
    @http.route('/api/v1/admin/appointments', type='http', auth='none',
                methods=['POST', 'OPTIONS'], csrf=False)
    def create_appointment(self, **kwargs):  # pylint: disable=unused-argument
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        user, err = self._authenticate(require_auth=True)
        if err:
            return err

        try:
            body = json.loads(request.httprequest.data or b'{}')
        except (ValueError, TypeError):
            return self._json_response({'error': 'JSON non valido'}, 400)

        name = (body.get('name') or '').strip()
        start = self._parse_datetime(body.get('start'))
        stop = self._parse_datetime(body.get('stop'))
        if not name or not start or not stop:
            return self._json_response(
                {'error': 'name, start, stop obbligatori'}, 400)

        # Filtro R2: partner_ids solo V6 interni
        Partner = request.env['res.partner'].sudo()
        valid_partner_ids = []
        skipped = []
        for pid in (body.get('partner_ids') or []):
            p = Partner.browse(int(pid))
            if p.exists() and self._is_v6_partner(p):
                valid_partner_ids.append(p.id)
            else:
                skipped.append(pid)
        if skipped:
            _logger.warning('calendar.event create: partner_ids non V6 scartati: %s', skipped)

        vals = {
            'name': name,
            'start': start,
            'stop': stop,
            'location': body.get('location') or False,
            'description': body.get('description') or False,
            'external_attendees': body.get('external_attendees')
                if isinstance(body.get('external_attendees'), str)
                else (','.join(body.get('external_attendees')) if body.get('external_attendees') else False),
        }
        if valid_partner_ids:
            vals['partner_ids'] = [(6, 0, valid_partner_ids)]
        if body.get('relation_id'):
            vals['relation_id'] = int(body['relation_id'])
        if body.get('deal_id'):
            vals['deal_id'] = int(body['deal_id'])

        vals['is_v6_managed'] = True
        if not vals.get('user_id'):
            vals['user_id'] = user.id

        try:
            # 03/10/2026 (C1b-agenda-1a): no_mail_to_attendees=True per R2.
            # Il create() di calendar.event chiama _send_invitation_emails()
            # automaticamente. Nel MVP non inviamo email: l'invito è .ics
            # scaricato manualmente. In agenda-1c si aggiungerà un endpoint
            # /invite esplicito che usa action_sendmail.
            e = request.env['calendar.event'].sudo().with_context(
                no_mail_to_attendees=True,
            ).create(vals)
            request.env.cr.commit()
        except Exception as ex:
            _logger.exception('Errore create calendar.event')
            return self._json_response({'error': str(ex)}, 400)

        return self._json_response({
            'success': True,
            'appointment': self._event_to_dict(e),
            'skipped_partner_ids': skipped,
        })

    # ═══════════════════════════════════════════════════════════════
    # PATCH /<id>
    # ═══════════════════════════════════════════════════════════════
    @http.route('/api/v1/admin/appointments/<int:eid>', type='http', auth='none',
                methods=['PATCH', 'PUT', 'OPTIONS'], csrf=False)
    def update_appointment(self, eid, **kwargs):  # pylint: disable=unused-argument
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        user, err = self._authenticate(require_auth=True)
        if err:
            return err

        E = request.env['calendar.event'].sudo()
        e = E.browse(eid)
        if not e.exists():
            return self._json_response({'error': 'not found'}, 404)
        if not e.is_v6_managed:
            return self._json_response(
                {'error': 'Solo eventi V6 possono essere modificati'}, 403)

        try:
            body = json.loads(request.httprequest.data or b'{}')
        except (ValueError, TypeError):
            return self._json_response({'error': 'JSON non valido'}, 400)

        vals = {}
        for k in ('name', 'location', 'description'):
            if k in body:
                vals[k] = body.get(k) or False
        if 'start' in body:
            vals['start'] = self._parse_datetime(body['start'])
        if 'stop' in body:
            vals['stop'] = self._parse_datetime(body['stop'])
        if 'relation_id' in body:
            vals['relation_id'] = int(body['relation_id']) if body['relation_id'] else False
        if 'deal_id' in body:
            vals['deal_id'] = int(body['deal_id']) if body['deal_id'] else False
        if 'external_attendees' in body:
            vals['external_attendees'] = body['external_attendees'] or False

        if not vals:
            return self._json_response({'error': 'Nessun campo da aggiornare'}, 400)

        try:
            e.write(vals)
            request.env.cr.commit()
        except Exception as ex:
            _logger.exception('Errore update calendar.event %s', eid)
            return self._json_response({'error': str(ex)}, 400)

        return self._json_response({'success': True, 'appointment': self._event_to_dict(e)})

    # ═══════════════════════════════════════════════════════════════
    # DELETE /<id>
    # ═══════════════════════════════════════════════════════════════
    @http.route('/api/v1/admin/appointments/<int:eid>', type='http', auth='none',
                methods=['DELETE', 'OPTIONS'], csrf=False)
    def delete_appointment(self, eid, **kwargs):  # pylint: disable=unused-argument
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        user, err = self._authenticate(require_auth=True)
        if err:
            return err
        if not self._is_strict_admin(user):
            return self._json_response({'error': 'Solo admin'}, 403)

        E = request.env['calendar.event'].sudo()
        e = E.browse(eid)
        if not e.exists():
            return self._json_response({'error': 'not found'}, 404)
        if not e.is_v6_managed:
            return self._json_response({'error': 'Solo eventi V6'}, 403)

        e.unlink()
        request.env.cr.commit()
        return self._json_response({'success': True, 'id': eid})

    # ═══════════════════════════════════════════════════════════════
    # GET /<id>/ics
    # ═══════════════════════════════════════════════════════════════
    @http.route('/api/v1/admin/appointments/<int:eid>/ics', type='http', auth='none',
                methods=['GET', 'OPTIONS'], csrf=False)
    def download_ics(self, eid, **kwargs):  # pylint: disable=unused-argument
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        user, err = self._authenticate(require_auth=True)
        if err:
            return err

        E = request.env['calendar.event'].sudo()
        e = E.browse(eid)
        if not e.exists():
            return self._json_response({'error': 'not found'}, 404)

        try:
            ics_dict = e._get_ics_file() or {}
        except Exception as ex:
            _logger.exception('Errore _get_ics_file %s', eid)
            return self._json_response({'error': str(ex)}, 500)

        # _get_ics_file ritorna dict {id_evento: bytes}
        ics_content = b''
        if isinstance(ics_dict, dict) and ics_dict:
            ics_content = list(ics_dict.values())[0]
        elif isinstance(ics_dict, bytes):
            ics_content = ics_dict

        if not ics_content:
            return self._json_response({'error': 'ICS vuoto'}, 500)

        return request.make_response(
            ics_content,
            headers=[
                ('Content-Type', 'text/calendar; charset=utf-8'),
                ('Content-Disposition', f'attachment; filename=event-{eid}.ics'),
            ],
        )

    def _is_strict_admin(self, user):
        return user.has_group('base.group_system')
