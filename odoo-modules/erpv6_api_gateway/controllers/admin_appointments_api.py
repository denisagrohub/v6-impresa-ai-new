# pylint: disable=import-error
"""Admin Appointments API — CRUD calendar.event (C1b-agenda-1a).

Riusa _authenticate di APIBaseController.
Sicurezza R2: partner_ids accettati SOLO se V6 interni (group_user).
"""
import base64
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
            # 03/10/2026 (agenda-1b-fix): partner_ids è ciò che il form
            # usa per i checkbox (allineato a res.partner, non a
            # calendar.attendee.id). attendee_ids/names restano per debug.
            'partner_ids': e.partner_ids.ids,
            'attendee_ids': e.attendee_ids.ids,
            'attendee_names': [a.partner_id.name for a in e.attendee_ids],
            # 03/10/2026 (D.1): dettaglio RSVP per ogni attendee.
            'attendees': [
                {
                    'attendee_id': a.id,
                    'partner_id': a.partner_id.id,
                    'user_id': a.partner_id.user_ids[:1].id
                        if a.partner_id.user_ids else None,
                    'name': a.partner_id.name,
                    'email': a.partner_id.email or a.email or '',
                    'state': a.state,
                }
                for a in e.attendee_ids
            ],
            'external_invite_sent_at': self._iso_utc(e.external_invite_sent_at)
                if e.external_invite_sent_at else None,
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
        """Parsing ISO tollerante.

        03/10/2026 (agenda-1b-fix): il frontend ora manda UTC naive
        (toISOString().replace('Z','')). Accettiamo anche varianti con
        'Z' finale o offset '+02:00' per robustezza.
        """
        if not s:
            return False
        s = s.replace('T', ' ')
        # Strip millisecondi se presenti
        if '.' in s:
            s = s.split('.')[0]
        # Strip offset (+02:00, -05:00)
        if '+' in s:
            s = s.split('+')[0].strip()
        # Strip 'Z' finale (UTC)
        if s.endswith('Z'):
            s = s[:-1].strip()
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
        # 03/10/2026 (D-fix): propaga user JWT nell'env. Necessario per
        # audit erpv6_crypto_audit (user_id NOT NULL) che scatta su
        # _get_ics_file() e altre operazioni. Senza questo, audit insert
        # fallisce con NULL e abortisce la transazione.
        request.update_env(user=user.id)

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
        # 03/10/2026 (D-fix): propaga user JWT nell'env. Necessario per
        # audit erpv6_crypto_audit (user_id NOT NULL) che scatta su
        # _get_ics_file() e altre operazioni. Senza questo, audit insert
        # fallisce con NULL e abortisce la transazione.
        request.update_env(user=user.id)

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
        # 03/10/2026 (D-fix): propaga user JWT nell'env. Necessario per
        # audit erpv6_crypto_audit (user_id NOT NULL) che scatta su
        # _get_ics_file() e altre operazioni. Senza questo, audit insert
        # fallisce con NULL e abortisce la transazione.
        request.update_env(user=user.id)

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

        # 03/10/2026 (D.4): email a external_attendees con conferma esplicita.
        external_attendees = vals.get('external_attendees') or ''
        confirm_external_send = bool(body.get('confirm_external_send'))
        if external_attendees and not confirm_external_send:
            return self._json_response({
                'error': 'Conferma richiesta per invio email esterne',
                'requires_confirmation': True,
                'external_recipients': [
                    x.strip() for x in external_attendees.split(',') if x.strip()
                ],
            }, 400)

        try:
            # 03/10/2026 (C1b-agenda-1a): no_mail_to_attendees=True per R2.
            # Il create() di calendar.event chiama _send_invitation_emails()
            # automaticamente. Nel MVP non inviamo email: l'invito è .ics
            # scaricato manualmente.
            e = request.env['calendar.event'].sudo().with_context(
                no_mail_to_attendees=True,
            ).create(vals)
            # 03/10/2026 (B): notifica attendee V6 (Telegram o email)
            # dopo il create. Fuori dalla transazione del create così
            # un fallimento notifica non blocca l'evento.
            try:
                e._notify_attendees()
            except Exception:
                _logger.exception(
                    "Notifica attendee fallita per evento %s", e.id)
            # 03/10/2026 (D.4): invio email esterne (transazionale approved).
            if external_attendees and confirm_external_send:
                try:
                    self._send_external_invites(e)
                except Exception:
                    _logger.exception(
                        "Invio email esterne fallito per evento %s", e.id)
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
        # 03/10/2026 (D-fix): propaga user JWT nell'env. Necessario per
        # audit erpv6_crypto_audit (user_id NOT NULL) che scatta su
        # _get_ics_file() e altre operazioni. Senza questo, audit insert
        # fallisce con NULL e abortisce la transazione.
        request.update_env(user=user.id)

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
        # 03/10/2026 (D-fix): propaga user JWT nell'env. Necessario per
        # audit erpv6_crypto_audit (user_id NOT NULL) che scatta su
        # _get_ics_file() e altre operazioni. Senza questo, audit insert
        # fallisce con NULL e abortisce la transazione.
        request.update_env(user=user.id)
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
        # 03/10/2026 (D-fix): propaga user JWT nell'env. Necessario per
        # audit erpv6_crypto_audit (user_id NOT NULL) che scatta su
        # _get_ics_file() e altre operazioni. Senza questo, audit insert
        # fallisce con NULL e abortisce la transazione.
        request.update_env(user=user.id)

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

    # ═══════════════════════════════════════════════════════════════
    # 03/10/2026 (C1b-agenda-COMPLETE-C): RSVP via link email
    # Pubblico (auth='public'): il link viene cliccato dall'utente
    # anche se non loggato. Token access_token dell'attendee è
    # l'autenticazione.
    # ═══════════════════════════════════════════════════════════════
    @http.route(
        '/api/v1/appointments/rsvp/<int:attendee_id>/<string:token>/<string:action>',
        type='http', auth='public', csrf=False, methods=['GET'],
    )
    def rsvp_by_token(self, attendee_id, token, action, **kwargs):
        if action not in ('accept', 'decline'):
            return request.not_found()
        attendee = request.env['calendar.attendee'].sudo().browse(attendee_id)
        if not attendee.exists():
            return request.not_found()
        # Verifica token
        stored_token = attendee.access_token or ''
        if not stored_token or stored_token != token:
            _logger.warning(
                "RSVP token mismatch: attendee=%s token=%s... atteso=%s...",
                attendee_id, token[:8], stored_token[:8],
            )
            return request.not_found()

        new_state = 'accepted' if action == 'accept' else 'declined'
        if attendee.state not in ('accepted', 'declined'):
            # idempotente: se già deciso, non sovrascrivere
            attendee.write({'state': new_state})

        # Redirect a pagina conferma
        base_url = request.env['ir.config_parameter'].sudo().get_param(
            'web.base.url', 'https://erpv6.it')
        target = (
            f"{base_url}/appointments/rsvp-done?"
            f"state={new_state}&event={attendee.event_id.id}"
        )
        return request.redirect(target)

    def _send_external_invites(self, event):
        """03/10/2026 (D.4): invia email con .ics ai partecipanti esterni.

        Chiamato dal POST dopo conferma esplicita utente
        (confirm_external_send=true). Usa context
        mail_transactional_approved=True per bypassare la whitelist
        R2 (guardrail erpv6_mail_guard).
        """
        externals = [
            x.strip() for x in (event.external_attendees or '').split(',')
            if x.strip() and '@' in x
        ]
        if not externals:
            return

        # Genera .ics
        try:
            ics_dict = event._get_ics_file() or {}
            ics_content = b''
            if isinstance(ics_dict, dict) and ics_dict:
                ics_content = list(ics_dict.values())[0]
            elif isinstance(ics_dict, bytes):
                ics_content = ics_dict
        except Exception:
            _logger.exception("_get_ics_file fallito per evento %s", event.id)
            return

        if not ics_content:
            _logger.warning("ICS vuoto per evento %s", event.id)
            return

        # Attachment .ics
        Attachment = request.env['ir.attachment'].sudo()
        att = Attachment.create({
            'name': f'appuntamento-{event.id}.ics',
            'datas': base64.b64encode(ics_content),
            'mimetype': 'text/calendar',
            'res_model': 'calendar.event',
            'res_id': event.id,
        })

        template = request.env.ref(
            'erpv6_calendar_ext.mail_template_external_invite',
            raise_if_not_found=False,
        )
        if not template:
            _logger.warning("Template email esterno mancante")
            return

        # Una mail per ogni destinatario (privacy: no reciproci visibili)
        for email in externals:
            try:
                # 03/10/2026 (fix 1 + fix allegato): creiamo la mail
                # con force_send=False, alleghiamo il .ics, poi la
                # inviamo esplicitamente. Con force_send=True Odoo la
                # cancella subito (auto_delete) e non possiamo più
                # collegare l'attachment.
                mail_id = template.sudo().with_context(
                    mail_transactional_approved=True,
                ).send_mail(
                    event.id,
                    force_send=False,
                    email_values={'email_to': email},
                )
                if mail_id:
                    mail = request.env['mail.mail'].sudo().browse(mail_id)
                    mail.write({'attachment_ids': [(4, att.id)]})
                    # Invio esplicito (con context transazionale
                    # ereditato dalla send_mail precedente).
                    mail.with_context(
                        mail_transactional_approved=True,
                    ).send()
            except Exception:
                _logger.exception(
                    "_send_external_invites fallito per %s (event %s)",
                    email, event.id,
                )

        event.write({
            'external_invite_sent_at': fields.Datetime.now(),
        })
        _logger.info(
            "Inviti esterni inviati per evento %s → %s",
            event.id, externals,
        )

    def _is_strict_admin(self, user):
        return user.has_group('base.group_system')
