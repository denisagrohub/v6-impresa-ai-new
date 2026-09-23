# pylint: disable=import-error
"""Consultant API Controller - dati reali per la dashboard consulente
(apps/impresa/src/app/consultant/dashboard/page.tsx), Denis 25/08/2026.

erpv6_api_gateway resta agnostico da erpv6_production (stesso pattern
hasattr/"in env" gia' usato in interview_api.py/lead_api.py): se il modulo
non e' installato, gli endpoint rispondono 501 invece di crashare.

Ruoli (stesso schema di /api/v1/auth/login in main.py): Responsabile
(sales_team.group_sale_manager) e Admin (base.group_system) vedono/possono
tutto; un Consulente (erpv6_core.group_consulente) vede/puo' agire solo sul
proprio - il filtro sui DATI resta comunque garantito anche qui esplicitamente
(mai fidarsi solo del frontend che nasconde un bottone)."""
import json
import logging
import time

from odoo import http, SUPERUSER_ID
from markupsafe import Markup
from odoo.exceptions import UserError
from odoo.http import request

from .main import APIBaseController

_logger = logging.getLogger(__name__)


from .consultant_api import ConsultantAPIController


class ConsultantEmailAPIController(ConsultantAPIController):

    @http.route('/api/v1/consultant/emails', type='http', auth='none', methods=['GET', 'OPTIONS'], csrf=False)
    def get_consultant_emails(self, **kwargs):  # pylint: disable=unused-argument
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        start_time = time.time()
        user, error_response = self._authenticate(require_auth=True)
        if error_response:
            return error_response

        env = request.env
        if 'erpv6.winwin.email.log' not in env:
            self._log_api_call('/api/v1/consultant/emails', 'GET', user.id, 501, start_time)
            return self._json_response({'error': 'erpv6_winwin_renderdata non installato'}, 501)

        is_admin = self._is_responsabile_o_admin(user)
        show_all = is_admin and kwargs.get('all') in ('1', 'true', 'True')

        domain = [] if show_all else [('recipient_user_id', '=', user.id)]
        # 22/09/2026: escludi archiviate (o mostra solo archiviate con ?archived=1)
        if kwargs.get('archived') in ('1','true','True'):
            domain.append(('is_archived', '=', True))
        else:
            domain.append(('is_archived', '=', False))
        # opzionale filtro per progetto
        relation_id = kwargs.get('relation_id')
        if relation_id:
            try:
                domain.append(('relation_id', '=', int(relation_id)))
            except (ValueError, TypeError):
                pass

        limit = min(int(kwargs.get('limit') or 50), 200)
        Log = env['erpv6.winwin.email.log'].sudo()
        logs = Log.search(domain, order='create_date desc', limit=limit)

        emails = [{
            'id': l.id,
            'subject': l.name or '(senza oggetto)',
            'sender_email': l.sender_email or '',
            'recipient_emails': l.recipient_emails or '',
            'cc_emails': l.cc_emails or '',
            'match_status': l.match_status,
            'matched_alias': l.matched_alias or '',
            'relation_id': l.relation_id.id if l.relation_id else None,
            'relation_name': l.relation_id.name if l.relation_id else None,
            'recipient_user_id': l.recipient_user_id.id if l.recipient_user_id else None,
            'recipient_user_name': l.recipient_user_id.name if l.recipient_user_id else None,
            'create_date': l.create_date.isoformat() if l.create_date else None,
        } for l in logs]

        self._log_api_call('/api/v1/consultant/emails', 'GET', user.id, 200, start_time)
        return self._json_response({
            'is_admin': is_admin,
            'showing_all': show_all,
            'count': len(emails),
            'emails': emails,
        })

    # ------------------------------------------------------------------
    # Tab "Pagamenti" (21/09/2026): compensi del consulente calcolati dallo
    # split V6 dei progetti dove compare come beneficiario 'consulente'.
    # Fonte: erpv6.tracking.relation.x_v6_revenue_split (JSON).
    # ------------------------------------------------------------------

    @http.route('/api/v1/consultant/emails/unread-count', type='http', auth='none',
                methods=['GET', 'OPTIONS'], csrf=False)
    def get_consultant_emails_unread_count(self, **kwargs):  # pylint: disable=unused-argument
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        user, error_response = self._authenticate(require_auth=True)
        if error_response:
            return error_response

        env = request.env
        if 'erpv6.winwin.email.log' not in env:
            return self._json_response({'unread': 0})

        Log = env['erpv6.winwin.email.log'].sudo()
        count = Log.search_count([
            ('recipient_user_id', '=', user.id),
            ('direction', '=', 'ricevuta'),
            ('is_read', '=', False),
        ])
        return self._json_response({'unread': count})

    @http.route('/api/v1/consultant/emails/<int:email_id>/attachments', type='http', auth='none',
                methods=['GET', 'OPTIONS'], csrf=False)
    def get_consultant_email_attachments(self, email_id, **kwargs):
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        user, err = self._authenticate(require_auth=True)
        if err: return err
        env = request.env
        Log = env['erpv6.winwin.email.log'].sudo()
        log = Log.browse(email_id)
        if not log.exists():
            return self._json_response({'error': 'Email non trovata'}, 404)
        if not self._is_responsabile_o_admin(user) and log.recipient_user_id.id != user.id:
            return self._json_response({'error': 'Non hai accesso'}, 403)
        atts = env['ir.attachment'].sudo().search([
            ('res_model', '=', 'erpv6.winwin.email.log'), ('res_id', '=', log.id),
        ])
        return self._json_response({'attachments': [{
            'id': a.id, 'name': a.name, 'mimetype': a.mimetype,
            'size': a.file_size,
        } for a in atts]})

    @http.route('/api/v1/consultant/emails/<int:email_id>/mark-read', type='http', auth='none',
                methods=['POST', 'OPTIONS'], csrf=False)
    def post_consultant_email_mark_read(self, email_id, **kwargs):  # pylint: disable=unused-argument
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        user, error_response = self._authenticate(require_auth=True)
        if error_response:
            return error_response

        env = request.env
        Log = env['erpv6.winwin.email.log'].sudo()
        log = Log.browse(email_id)
        if not log.exists():
            return self._json_response({'error': 'Email non trovata'}, 404)

        is_admin = self._is_responsabile_o_admin(user)
        if not is_admin and log.recipient_user_id.id != user.id:
            return self._json_response({'error': 'Non hai accesso a questa email'}, 403)

        if not log.is_read:
            log.write({'is_read': True})
        return self._json_response({'success': True})

    @http.route('/api/v1/consultant/emails/<int:email_id>/archive', type='http', auth='none',
                methods=['POST', 'OPTIONS'], csrf=False)
    def post_consultant_email_archive(self, email_id, **kwargs):
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        user, err = self._authenticate(require_auth=True)
        if err: return err
        env = request.env
        Log = env['erpv6.winwin.email.log'].sudo()
        log = Log.browse(email_id)
        if not log.exists():
            return self._json_response({'error': 'Email non trovata'}, 404)
        if not self._is_responsabile_o_admin(user) and log.recipient_user_id.id != user.id:
            return self._json_response({'error': 'Non hai accesso'}, 403)
        log.write({'is_archived': True})
        return self._json_response({'success': True})

    @http.route('/api/v1/consultant/emails/<int:email_id>/unarchive', type='http', auth='none',
                methods=['POST', 'OPTIONS'], csrf=False)
    def post_consultant_email_unarchive(self, email_id, **kwargs):
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        user, err = self._authenticate(require_auth=True)
        if err: return err
        env = request.env
        Log = env['erpv6.winwin.email.log'].sudo()
        log = Log.browse(email_id)
        if not log.exists():
            return self._json_response({'error': 'Email non trovata'}, 404)
        if not self._is_responsabile_o_admin(user) and log.recipient_user_id.id != user.id:
            return self._json_response({'error': 'Non hai accesso'}, 403)
        log.write({'is_archived': False})
        return self._json_response({'success': True})

    @http.route('/api/v1/consultant/emails/<int:email_id>', type='http', auth='none',
                methods=['DELETE', 'OPTIONS'], csrf=False)
    def delete_consultant_email(self, email_id, **kwargs):  # pylint: disable=unused-argument
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        user, error_response = self._authenticate(require_auth=True)
        if error_response:
            return error_response

        env = request.env
        Log = env['erpv6.winwin.email.log'].sudo()
        log = Log.browse(email_id)
        if not log.exists():
            return self._json_response({'error': 'Email non trovata'}, 404)

        is_admin = self._is_responsabile_o_admin(user)
        if not is_admin:
            if log.recipient_user_id.id != user.id:
                return self._json_response({'error': 'Non hai accesso a questa email'}, 403)

        # Rimuovi anche i mail.message collegati (thread)
        try:
            env['mail.message'].sudo().search([
                ('model', '=', 'erpv6.winwin.email.log'),
                ('res_id', '=', log.id),
            ]).unlink()
        except Exception:
            _logger.exception("Cleanup mail.message fallito per log %s", email_id)

        log.unlink()
        return self._json_response({'success': True})

    @http.route('/api/v1/consultant/emails/<int:email_id>', type='http', auth='none',
                methods=['GET', 'OPTIONS'], csrf=False)
    def get_consultant_email_detail(self, email_id, **kwargs):  # pylint: disable=unused-argument
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        start_time = time.time()
        user, error_response = self._authenticate(require_auth=True)
        if error_response:
            return error_response

        env = request.env
        if 'erpv6.winwin.email.log' not in env:
            return self._json_response({'error': 'erpv6_winwin_renderdata non installato'}, 501)

        Log = env['erpv6.winwin.email.log'].sudo()
        log = Log.browse(email_id)
        if not log.exists():
            return self._json_response({'error': 'Email non trovata'}, 404)

        is_admin = self._is_responsabile_o_admin(user)
        # Accesso: admin vede tutto. Consulente vede se e' destinatario
        # oppure se e' nel progetto (relation_id e lui ha accesso).
        if not is_admin:
            is_recipient = log.recipient_user_id.id == user.id
            in_project = False
            if log.relation_id:
                in_project = (
                    log.relation_id.owner_user_id.id == user.id
                    or user.id in log.relation_id.access_user_ids.ids
                )
            if not (is_recipient or in_project):
                return self._json_response({'error': 'Non hai accesso a questa email'}, 403)

        # Body: cerca il mail.message comment (esclude le notification di sistema
        # tipo 'created' che finivano per essere mostrate come corpo email).
        Message = env['mail.message'].sudo()
        msg = Message.search([
            ('model', '=', 'erpv6.winwin.email.log'),
            ('res_id', '=', log.id),
            ('message_type', '=', 'comment'),
        ], order='id desc', limit=1)

        body = ''
        if msg:
            body = msg.body or ''

        self._log_api_call('/api/v1/consultant/emails/detail', 'GET', user.id, 200, start_time)
        return self._json_response({
            'id': log.id,
            'subject': log.name or '(senza oggetto)',
            'sender_email': log.sender_email or '',
            'recipient_emails': log.recipient_emails or '',
            'cc_emails': log.cc_emails or '',
            'relation_id': log.relation_id.id if log.relation_id else None,
            'relation_name': log.relation_id.name if log.relation_id else None,
            'recipient_user_name': log.recipient_user_id.name if log.recipient_user_id else None,
            'create_date': log.create_date.isoformat() if log.create_date else None,
            'body': body,
        })

    # ------------------------------------------------------------------
    # Reply-data: precompila il composer (To/Cc/Subject/From)
    # (21/09/2026)
    # ------------------------------------------------------------------

    @http.route('/api/v1/consultant/emails/<int:email_id>/reply-data', type='http', auth='none',
                methods=['GET', 'OPTIONS'], csrf=False)
    def get_consultant_email_reply_data(self, email_id, **kwargs):  # pylint: disable=unused-argument
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        user, error_response = self._authenticate(require_auth=True)
        if error_response:
            return error_response

        import re as _re
        env = request.env
        if 'erpv6.winwin.email.log' not in env:
            return self._json_response({'error': 'Modulo non installato'}, 501)

        log = env['erpv6.winwin.email.log'].sudo().browse(email_id)
        if not log.exists():
            return self._json_response({'error': 'Email non trovata'}, 404)

        # Check accesso
        is_admin = self._is_responsabile_o_admin(user)
        if not is_admin:
            is_recipient = log.recipient_user_id.id == user.id
            in_project = False
            if log.relation_id:
                in_project = (log.relation_id.owner_user_id.id == user.id
                              or user.id in log.relation_id.access_user_ids.ids)
            if not (is_recipient or in_project):
                return self._json_response({'error': 'Non hai accesso'}, 403)

        # From: la casella su cui e' arrivata (slug@ o slug+progetto@).
        # Il recipient puo' contenere prefissi tecnici (v6impresa-it-*) dai
        # server SMTP - scartiamo tutto cio' che non e' esattamente
        # 'slug@' o 'slug+xxx@'.
        import re as _re2
        user_slug = getattr(user, 'email_slug', None) or ''
        from_email = None
        if user_slug:
            for r in (log.recipient_emails or '').split(','):
                r = r.strip().lower()
                # estrai solo la parte email
                m2 = _re2.search(r'([a-z0-9._+\-]+@v6impresa\.it)', r)
                if not m2:
                    continue
                candidate = m2.group(1)
                local = candidate.split('@')[0]
                # accetta solo 'slug' puro o 'slug+hint'
                if local == user_slug or local.startswith(user_slug + '+'):
                    from_email = candidate
                    break
        if not from_email and user_slug:
            from_email = f'{user_slug}@v6impresa.it'

        # TO: mittente originale
        sender = log.sender_email or ''
        m = _re.search(r'<([^>]+)>', sender)
        to_email = m.group(1).strip() if m else sender.strip()

        # CC: altri destinatari originali (escludo me, catchall, v6impresa/v6sviluppoimpresa)
        cc_list = []
        for r in (log.recipient_emails or '').split(','):
            r = r.strip()
            if not r:
                continue
            low = r.lower()
            if '@v6impresa.it' in low or '@v6sviluppoimpresa.it' in low:
                continue
            cc_list.append(r)
        for r in (log.cc_emails or '').split(','):
            r = r.strip()
            if r and '@v6impresa.it' not in r.lower() and '@v6sviluppoimpresa.it' not in r.lower():
                cc_list.append(r)

        subject = log.name or ''
        if not subject.lower().startswith('re:'):
            subject = 'Re: ' + subject

        original_body = ''
        if log.message_ids:
            comment_msgs = log.message_ids.filtered(lambda m: m.message_type == 'comment')
            original_body = (comment_msgs[0].body if comment_msgs else '') or ''

        return self._json_response({
            'from_email': from_email,
            'to': to_email,
            'cc': ', '.join(cc_list),
            'subject': subject,
            'original_body': original_body,
        })

    # ------------------------------------------------------------------
    # Send: invia email dal consulente. From = stessa casella della
    # reply (slug@ o slug+progetto@). Log in erpv6.winwin.email.log
    # con direction=inviata. (21/09/2026)
    # ------------------------------------------------------------------

    @http.route('/api/v1/consultant/emails/send', type='http', auth='none',
                methods=['POST', 'OPTIONS'], csrf=False)
    def send_consultant_email(self, **kwargs):  # pylint: disable=unused-argument
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        user, error_response = self._authenticate(require_auth=True)
        if error_response:
            return error_response

        env = request.env
        if 'erpv6.winwin.email.log' not in env:
            return self._json_response({'error': 'Modulo non installato'}, 501)

        try:
            data = json.loads(request.httprequest.data or b'{}')
        except json.JSONDecodeError:
            return self._json_response({'error': 'JSON non valido'}, 400)

        to = (data.get('to') or '').strip()
        cc = (data.get('cc') or '').strip()
        bcc = (data.get('bcc') or '').strip()
        attachments = data.get('attachments') or []
        subject = (data.get('subject') or '').strip()
        body = data.get('body') or ''
        in_reply_to_id = data.get('in_reply_to_id')
        from_email = (data.get('from_email') or '').strip()

        if not to or not subject or not body:
            return self._json_response({'error': 'to, subject, body obbligatori'}, 400)

        user_slug = getattr(user, 'email_slug', None) or ''
        if not from_email:
            from_email = f'{user_slug}@v6impresa.it' if user_slug else ''

        # SMTP per v6impresa.it
        mail_server = env['ir.mail_server'].sudo().search(
            [('from_filter', '=', 'v6impresa.it'), ('active', '=', True)], limit=1)
        if not mail_server:
            return self._json_response({'error': 'SMTP v6impresa.it non configurato'}, 500)

        # Contesto: relation_id + matched_alias dalla reply originale
        relation_id = None
        matched_alias = user_slug or None
        recipient_user_id = user.id
        if in_reply_to_id:
            orig = env['erpv6.winwin.email.log'].sudo().browse(int(in_reply_to_id))
            if orig.exists():
                if orig.relation_id:
                    relation_id = orig.relation_id.id
                if orig.matched_alias:
                    matched_alias = orig.matched_alias
                if orig.recipient_user_id:
                    recipient_user_id = orig.recipient_user_id.id

        all_recipients = [to]
        if cc:
            all_recipients += [e.strip() for e in cc.split(',') if e.strip()]

        # 22/09/2026: threading - se e' una reply, prendi il Message-Id originale
        # dal mail.message del log reply-to e mettilo in In-Reply-To/References.
        reply_headers = None
        if in_reply_to_id:
            try:
                orig_log = env['erpv6.winwin.email.log'].sudo().browse(int(in_reply_to_id))
                if orig_log.exists():
                    orig_msg = env['mail.message'].sudo().search([
                        ('model', '=', 'erpv6.winwin.email.log'),
                        ('res_id', '=', orig_log.id),
                    ], order='id desc', limit=1)
                    if orig_msg and orig_msg.message_id:
                        reply_headers = {
                            'In-Reply-To': orig_msg.message_id,
                            'References': orig_msg.message_id,
                        }
            except Exception:
                _logger.exception("Recupero Message-Id originale fallito (threading best-effort).")

        # BCC: Odoo 18 non ha email_bcc, lo passiamo via headers 'Bcc'
        # (RFC 5322: header opzionale, i client lo rispettano).
        if bcc:
            existing_h = reply_headers or {}
            existing_h['Bcc'] = ','.join([e.strip() for e in bcc.split(',') if e.strip()])
            reply_headers = existing_h

        # 23/09/2026: fix spam. Register autentica come catchall@v6impresa.it:
        # allineare il From al mittente tecnico e mettere l'alias consulente
        # in Reply-To. Gmail/Outlook vedono allineamento SMTP <-> From.
        display_name = user.name or 'V6 Impresa'
        header_from = f'"{display_name} via V6" <catchall@v6impresa.it>'

        mail = env['mail.mail'].sudo().create({
            'email_from': header_from,
            'reply_to': from_email,
            'email_to': ','.join(all_recipients),
            'email_cc': ','.join([e.strip() for e in cc.split(',') if e.strip()]) if cc else False,
            # 23/09/2026: Odoo 18 ha rimosso email_bcc da mail.mail. Il BCC
            # viene aggiunto via header nel momento dell'invio SMTP
            # (workaround: se bcc c'e', lo metto negli header).
            'subject': subject,
            'body_html': body,
            'mail_server_id': mail_server.id,
            'auto_delete': False,
            'headers': json.dumps(reply_headers) if reply_headers else False,
        })
        try:
            mail.send()
        except Exception as e:
            _logger.exception("Invio email consulente fallito.")
            return self._json_response({'error': str(e)}, 500)

        # 22/09/2026: allegati (da PC o da Libreria). Ogni file diventa un
        # ir.attachment sul log; se il log ha relation_id crea anche un
        # erpv6.library.document collegato (appare in progetto + libreria).
        if attachments:
            Att = env['ir.attachment'].sudo()
            Lib = env['erpv6.library.document'].sudo() if 'erpv6.library.document' in env else None
            att_ids = []
            for item in attachments:
                try:
                    if item.get('attachmentId'):
                        existing = Att.browse(int(item['attachmentId']))
                        if existing.exists():
                            existing.write({'res_model': 'erpv6.winwin.email.log', 'res_id': log.id})
                            att_ids.append(existing.id)
                        continue
                    fname = item.get('fileName') or 'allegato'
                    mimetype = item.get('mimetype') or 'application/octet-stream'
                    data = item.get('fileBase64') or ''
                    att = Att.create({
                        'name': fname, 'datas': data, 'mimetype': mimetype,
                        'res_model': 'erpv6.winwin.email.log', 'res_id': log.id,
                    })
                    att_ids.append(att.id)
                    if Lib is not None and log.relation_id and data:
                        Lib.create({
                            'name': fname, 'category': 'other', 'origin': 'internal_upload',
                            'file': data, 'file_name': fname,
                            'source_model': 'erpv6.tracking.relation',
                            'source_res_id': log.relation_id.id,
                        })
                except Exception:
                    _logger.exception("Allegato email fallito: %s", item.get('fileName'))
            if att_ids:
                mail.write({'attachment_ids': [(6, 0, att_ids)]})

        log = env['erpv6.winwin.email.log'].sudo().create({
            'name': subject,
            'sender_email': from_email,
            'recipient_emails': ','.join(all_recipients),
            'cc_emails': cc or False,
            # bcc non salvato per privacy (il destinatario finale non deve vederlo nei log condivisi)
            'match_status': 'utente_consulente',
            'matched_alias': matched_alias or '',
            'relation_id': relation_id,
            'recipient_user_id': recipient_user_id,
            'direction': 'inviata',
            'is_read': True,
        })
        try:
            log.message_post(body=Markup(body), subject=subject, message_type='comment',
                              subtype_xmlid='mail.mt_comment',
                              author_id=SUPERUSER_ID, email_from=from_email)
        except Exception:
            _logger.exception("message_post sul log email fallito (invio OK).")

        return self._json_response({'success': True, 'id': log.id})

    # ------------------------------------------------------------------
    # Dettaglio target (21/09/2026): nodo figlio con funzione_progetto='target'.
    # Ritorna azienda, contatto, stage, dossier, email del target, call.
    # Accesso: il consulente deve avere accesso al progetto root.
    # ------------------------------------------------------------------

