# pylint: disable=import-error
"""Admin Emails API — client Gmail-like multi-casella.

Aggrega i 2 modelli log (erpv6.winwin.email.log + erpv6.project.email.log)
e calcola le "caselle" dai matched_alias. Ogni casella è un alias email
(denis.deste, christian.girardi, progetto-tee, ...) e si auto-crea quando
appare un nuovo alias nei log.

Endpoint:
- GET  /api/v1/admin/emails/mailboxes                       lista caselle + conteggi
- GET  /api/v1/admin/emails?mailbox=X&direction=in|out      lista email filtrata
- GET  /api/v1/admin/emails/<id>?kind=winwin|project        dettaglio
- POST /api/v1/admin/emails/<id>/mark-read                  segna letta
- POST /api/v1/admin/emails/<id>/mark-unread                segna non letta
- POST /api/v1/admin/emails/<id>/archive                    archivia
- POST /api/v1/admin/emails/<id>/unarchive                  ripristina
- POST /api/v1/admin/emails/send                            invia (compose/reply)
"""
import base64
import json
import logging
import time

from odoo import http
from odoo.http import request

from .consultant_api import ConsultantAPIController

_logger = logging.getLogger(__name__)


class AdminEmailsAPIController(ConsultantAPIController):

    def _require_admin(self):
        user, error_response = self._authenticate(require_auth=True)
        if error_response:
            return None, error_response
        if not user.has_group('base.group_system'):
            return None, self._json_response({'error': 'Riservato agli amministratori'}, 403)
        return user, None

    # ================================================================
    # UTILITIES
    # ================================================================
    def _fetch_all_logs(self, domain_winwin=None, domain_project=None):
        """Ritorna lista unificata di dict dai 2 modelli."""
        env = request.env
        result = []

        # winwin (ha is_read, is_archived, recipient_user_id)
        if 'erpv6.winwin.email.log' in env:
            W = env['erpv6.winwin.email.log'].sudo()
            for r in W.search(domain_winwin or []):
                result.append({
                    'id': r.id,
                    'kind': 'winwin',
                    'name': r.name or '',
                    'sender_email': r.sender_email or '',
                    'recipient_emails': r.recipient_emails or '',
                    'cc_emails': r.cc_emails or '',
                    'direction': r.direction or 'ricevuta',
                    'matched_alias': r.matched_alias or '',
                    'match_status': r.match_status or '',
                    'relation_id': r.relation_id.id if r.relation_id else None,
                    'relation_name': r.relation_id.name if r.relation_id else None,
                    'recipient_user_id': r.recipient_user_id.id if r.recipient_user_id else None,
                    'is_read': bool(r.is_read),
                    'is_archived': bool(r.is_archived),
                    'create_date': r.create_date.isoformat() if r.create_date else None,
                })

        # project (ha recipient_relation_id, no is_read/is_archived)
        if 'erpv6.project.email.log' in env:
            P = env['erpv6.project.email.log'].sudo()
            for r in P.search(domain_project or []):
                result.append({
                    'id': r.id,
                    'kind': 'project',
                    'name': r.name or '',
                    'sender_email': r.sender_email or '',
                    'recipient_emails': r.recipient_emails or '',
                    'cc_emails': r.cc_emails or '',
                    'direction': r.direction or 'ricevuta',
                    'matched_alias': r.matched_alias or '',
                    'match_status': r.match_status or '',
                    'relation_id': r.relation_id.id if r.relation_id else None,
                    'relation_name': r.relation_id.name if r.relation_id else None,
                    'recipient_user_id': None,
                    'is_read': True,  # project log non ha is_read: default letto
                    'is_archived': False,
                    'create_date': r.create_date.isoformat() if r.create_date else None,
                })

        # Ordina per data DESC
        result.sort(key=lambda x: x['create_date'] or '', reverse=True)
        return result

    def _is_consultant_alias(self, alias, current_user):
        """Ritorna True SOLO se esiste un utente interno V6 il cui login
        è esattamente `<alias>@v6impresa.it` o `<alias>@v6sviluppoimpresa.it`,
        e questo utente è un consulente (non admin/responsabile, non se stesso).
        In tal caso NON mostriamo la casella (privacy consulente).

        26/09/2026 fix: la ricerca precedente con '=like %@%' era troppo
        larga e crashava. Ora cerchiamo esattamente l'email V6.
        """
        if not alias or '@' in alias:
            return False
        User = request.env['res.users'].sudo()

        # 27/09/2026 fix definitivo: cerca per email_slug (campo V6 custom).
        # email_slug contiene 'christian.girardi', 'martina.garbin', ecc.
        # per ogni utente con alias V6. Se l'alias matcha un utente NON
        # admin/responsabile e diverso dall'utente corrente -> hide.
        u = False
        if 'email_slug' in User._fields:
            u = User.search([('email_slug', '=', alias)], limit=1)
        if not u:
            # Fallback: cerca email V6 esatta
            candidates = [
                f'{alias}@v6impresa.it',
                f'{alias}@v6sviluppoimpresa.it',
            ]
            u = User.search([
                '|',
                ('login', 'in', candidates),
                ('partner_id.email', 'in', candidates),
            ], limit=1)
        if not u:
            return False  # alias non associato a un utente: mostra (progetto)
        if u.id == current_user.id:
            return False
        try:
            is_admin_or_manager = (
                u.has_group('base.group_system') or
                u.has_group('sales_team.group_sale_manager')
            )
        except Exception:
            is_admin_or_manager = False
        return not is_admin_or_manager

    def _all_aliases(self, logs, current_user=None):
        """Estrae caselle uniche dai matched_alias.
        Esclude gli alias di consulenti (privacy): mostra solo
        alias progetti + l'alias dell'admin loggato."""
        seen = {}
        for l in logs:
            alias = (l.get('matched_alias') or '').strip()
            if not alias:
                continue
            if current_user and self._is_consultant_alias(alias, current_user):
                continue
            if alias not in seen:
                seen[alias] = {
                    'alias': alias,
                    'total': 0,
                    'unread': 0,
                    'lastDate': None,
                }
            seen[alias]['total'] += 1
            if not l['is_read'] and not l['is_archived']:
                seen[alias]['unread'] += 1
            if not seen[alias]['lastDate'] or l['create_date'] > seen[alias]['lastDate']:
                seen[alias]['lastDate'] = l['create_date']
        return sorted(seen.values(), key=lambda x: x['lastDate'] or '', reverse=True)

    # ================================================================
    # MAILBOXES
    # ================================================================
    @http.route('/api/v1/admin/emails/mailboxes',
                type='http', auth='none', methods=['GET', 'OPTIONS'], csrf=False)
    def list_mailboxes(self, **kwargs):
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        user, err = self._require_admin()
        if err:
            return err

        logs = self._fetch_all_logs()
        mailboxes = self._all_aliases(logs, current_user=user)

        # Aggiungi "Tutte" come casella speciale
        total_unread = sum(m['unread'] for m in mailboxes)
        total = len(logs)
        mailboxes.insert(0, {
            'alias': '__all__',
            'label': 'Tutte le email',
            'total': total,
            'unread': total_unread,
            'lastDate': logs[0]['create_date'] if logs else None,
        })

        # Aggiungi anche "Inviate" (raggruppa per direzione)
        sent_count = len([l for l in logs if l['direction'] == 'inviata'])
        mailboxes.append({
            'alias': '__sent__',
            'label': 'Inviate',
            'total': sent_count,
            'unread': 0,
            'lastDate': None,
        })

        return self._json_response({
            'success': True,
            'mailboxes': mailboxes,
            'totalUnread': total_unread,
        })

    # ================================================================
    # LIST
    # ================================================================
    @http.route('/api/v1/admin/emails',
                type='http', auth='none', methods=['GET', 'OPTIONS'], csrf=False)
    def list_emails(self, **kwargs):
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        user, err = self._require_admin()
        if err:
            return err

        args = request.httprequest.args
        mailbox = args.get('mailbox', '').strip()
        direction = args.get('direction', '').strip()  # in | out | ''
        unread_only = args.get('unread', '') in ('1', 'true', 'True')
        archived = args.get('archived', '') in ('1', 'true', 'True')
        q = (args.get('q', '') or '').strip().lower()
        limit = int(args.get('limit', 100) or 100)

        logs = self._fetch_all_logs()

        # Filtra consulenti (privacy) — a meno che mailbox specifico
        logs = [l for l in logs
                if not self._is_consultant_alias(l.get('matched_alias') or '', user)]

        # Filtri
        def keep(l):
            if mailbox and mailbox not in ('__all__', '__sent__'):
                if l['matched_alias'] != mailbox:
                    return False
            if mailbox == '__sent__':
                if l['direction'] != 'inviata':
                    return False
            if direction == 'in' and l['direction'] != 'ricevuta':
                return False
            if direction == 'out' and l['direction'] != 'inviata':
                return False
            if unread_only and l['is_read']:
                return False
            if not archived and l['is_archived']:
                return False
            if archived and not l['is_archived']:
                return False
            if q:
                haystack = ' '.join([
                    l['name'] or '', l['sender_email'] or '',
                    l['recipient_emails'] or '', l['matched_alias'] or '',
                ]).lower()
                if q not in haystack:
                    return False
            return True

        filtered = [l for l in logs if keep(l)][:limit]

        return self._json_response({
            'success': True,
            'emails': filtered,
            'total': len(filtered),
            'mailbox': mailbox,
        })

    # ================================================================
    # DETAIL
    # ================================================================
    @http.route('/api/v1/admin/emails/<int:email_id>',
                type='http', auth='none', methods=['GET', 'OPTIONS'], csrf=False)
    def get_email(self, email_id, **kwargs):
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        user, err = self._require_admin()
        if err:
            return err

        kind = request.httprequest.args.get('kind', 'winwin')
        model = 'erpv6.winwin.email.log' if kind == 'winwin' else 'erpv6.project.email.log'
        if model not in request.env:
            return self._json_response({'error': 'modello non trovato'}, 404)

        r = request.env[model].sudo().browse(email_id)
        if not r.exists():
            return self._json_response({'error': 'Email non trovata'}, 404)

        # body: prendi da mail.message collegato (se esiste)
        body_html = ''
        attachments = []
        try:
            if hasattr(r, 'website_message_ids') and r.website_message_ids:
                # prendi il primo messaggio
                msg = r.website_message_ids[0]
                body_html = msg.body or ''
                for att in msg.attachment_ids:
                    attachments.append({
                        'id': att.id,
                        'name': att.name,
                        'size': att.file_size,
                        'mimetype': att.mimetype,
                    })
        except Exception as e:
            _logger.warning('errore lettura body: %s', e)

        return self._json_response({
            'success': True,
            'email': {
                'id': r.id,
                'kind': kind,
                'name': r.name or '',
                'sender_email': r.sender_email or '',
                'recipient_emails': r.recipient_emails or '',
                'cc_emails': r.cc_emails or '',
                'direction': r.direction or 'ricevuta',
                'matched_alias': r.matched_alias or '',
                'relation_id': r.relation_id.id if r.relation_id else None,
                'relation_name': r.relation_id.name if r.relation_id else None,
                'is_read': bool(getattr(r, 'is_read', True)),
                'is_archived': bool(getattr(r, 'is_archived', False)),
                'create_date': r.create_date.isoformat() if r.create_date else None,
                'body_html': body_html,
                'attachments': attachments,
            },
        })

    # ================================================================
    # MARK READ/UNREAD, ARCHIVE, UNARCHIVE
    # ================================================================
    def _get_record(self, email_id, kind):
        model = 'erpv6.winwin.email.log' if kind == 'winwin' else 'erpv6.project.email.log'
        if model not in request.env:
            return None
        r = request.env[model].sudo().browse(email_id)
        return r if r.exists() else None

    @http.route('/api/v1/admin/emails/<int:email_id>/mark-read',
                type='http', auth='none', methods=['POST', 'OPTIONS'], csrf=False)
    def mark_read(self, email_id, **kwargs):
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        user, err = self._require_admin()
        if err:
            return err
        kind = request.httprequest.args.get('kind', 'winwin')
        r = self._get_record(email_id, kind)
        if not r:
            return self._json_response({'error': 'not found'}, 404)
        if 'is_read' in r._fields:
            r.write({'is_read': True})
        return self._json_response({'success': True})

    @http.route('/api/v1/admin/emails/<int:email_id>/mark-unread',
                type='http', auth='none', methods=['POST', 'OPTIONS'], csrf=False)
    def mark_unread(self, email_id, **kwargs):
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        user, err = self._require_admin()
        if err:
            return err
        kind = request.httprequest.args.get('kind', 'winwin')
        r = self._get_record(email_id, kind)
        if not r:
            return self._json_response({'error': 'not found'}, 404)
        if 'is_read' in r._fields:
            r.write({'is_read': False})
        return self._json_response({'success': True})

    @http.route('/api/v1/admin/emails/<int:email_id>/archive',
                type='http', auth='none', methods=['POST', 'OPTIONS'], csrf=False)
    def archive(self, email_id, **kwargs):
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        user, err = self._require_admin()
        if err:
            return err
        kind = request.httprequest.args.get('kind', 'winwin')
        r = self._get_record(email_id, kind)
        if not r:
            return self._json_response({'error': 'not found'}, 404)
        if 'is_archived' in r._fields:
            r.write({'is_archived': True})
        return self._json_response({'success': True})

    @http.route('/api/v1/admin/emails/<int:email_id>/unarchive',
                type='http', auth='none', methods=['POST', 'OPTIONS'], csrf=False)
    def unarchive(self, email_id, **kwargs):
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        user, err = self._require_admin()
        if err:
            return self._json_response({'error': 'Riservato'}, 403)
        kind = request.httprequest.args.get('kind', 'winwin')
        r = self._get_record(email_id, kind)
        if not r:
            return self._json_response({'error': 'not found'}, 404)
        if 'is_archived' in r._fields:
            r.write({'is_archived': False})
        return self._json_response({'success': True})

    # ================================================================
    # SEND / REPLY
    # ================================================================
    @http.route('/api/v1/admin/emails/send',
                type='http', auth='none', methods=['POST', 'OPTIONS'], csrf=False)
    def send_email(self, **kwargs):
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        user, err = self._require_admin()
        if err:
            return err

        try:
            body = json.loads(request.httprequest.get_data(as_text=True) or '{}')
        except json.JSONDecodeError:
            return self._json_response({'error': 'JSON non valido'}, 400)

        to_list = body.get('to') or []
        cc_list = body.get('cc') or []
        if isinstance(to_list, str):
            to_list = [x.strip() for x in to_list.split(',') if x.strip()]
        if isinstance(cc_list, str):
            cc_list = [x.strip() for x in cc_list.split(',') if x.strip()]

        subject = (body.get('subject') or '').strip()
        body_html = body.get('body') or ''
        attachment_ids = body.get('attachmentIds') or []
        project_id = body.get('projectId')

        if not to_list or not subject:
            return self._json_response({'error': 'Destinatario e oggetto obbligatori'}, 400)

        try:
            user_slug = getattr(user, 'email_slug', None) or ''
            from_addr = f'{user_slug}@v6impresa.it' if user_slug else (user.partner_id.email or 'noreply@v6impresa.it')

            relation_id = None
            if project_id:
                Relation = request.env['erpv6.tracking.relation'].sudo().browse(int(project_id))
                if Relation.exists():
                    relation_id = Relation.id
                    project_alias = Relation.email_alias or ''
                    if user_slug and project_alias:
                        from_addr = f'{user_slug}+{project_alias}@v6impresa.it'

            full_body = body_html.replace('\n', '<br/>') if body_html else ''
            if relation_id:
                Relation = request.env['erpv6.tracking.relation'].sudo().browse(relation_id)
                full_body += f'<br/><br/><hr/><p style="color:#999;font-size:11px;">Progetto: <b>{Relation.name}</b></p>'

            Mail = request.env['mail.mail'].sudo()
            vals = {
                'subject': subject,
                'body_html': full_body,
                'email_from': from_addr,
                'email_to': ', '.join(to_list),
                'email_cc': ', '.join(cc_list) if cc_list else False,
                'reply_to': from_addr,
                'state': 'outgoing',
            }
            if attachment_ids:
                vals['attachment_ids'] = [(4, int(aid)) for aid in attachment_ids]

            mail = Mail.create(vals)
            mail.send()

            if 'erpv6.winwin.email.log' in request.env:
                request.env['erpv6.winwin.email.log'].sudo().create({
                    'name': subject,
                    'sender_email': from_addr,
                    'recipient_emails': ', '.join(to_list),
                    'cc_emails': ', '.join(cc_list) if cc_list else '',
                    'direction': 'inviata',
                    'match_status': 'matched' if relation_id else 'alias_riconosciuto_progetto_mancante',
                    'matched_alias': user_slug or 'admin',
                    'recipient_user_id': user.id,
                    'relation_id': relation_id,
                    'is_read': True,
                })

            return self._json_response({
                'success': True,
                'mailId': mail.id,
                'from': from_addr,
                'message': 'Email inviata',
            })
        except Exception as e:
            _logger.exception('Errore invio email')
            return self._json_response({'error': str(e)}, 500)


    # ================================================================
    # SEARCH PARTNERS (autocomplete destinatari)
    # ================================================================
    @http.route('/api/v1/admin/emails/search-partners',
                type='http', auth='none', methods=['GET', 'OPTIONS'], csrf=False)
    def search_partners(self, **kwargs):
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        user, err = self._require_admin()
        if err:
            return err

        q = (request.httprequest.args.get('q') or '').strip()
        if len(q) < 2:
            return self._json_response({'success': True, 'partners': []})

        Partner = request.env['res.partner'].sudo()
        partners = Partner.search([
            '|', '|',
            ('name', 'ilike', q),
            ('email', 'ilike', q),
            ('vat', 'ilike', q),
            ('email', '!=', False),
        ], limit=20)

        result = []
        for p in partners:
            if not p.email:
                continue
            result.append({
                'id': p.id,
                'name': p.name,
                'email': p.email,
                'isCompany': p.is_company,
            })

        return self._json_response({'success': True, 'partners': result})

    # ================================================================
    # SEARCH PROJECTS (dropdown collegamento)
    # ================================================================
    @http.route('/api/v1/admin/emails/search-projects',
                type='http', auth='none', methods=['GET', 'OPTIONS'], csrf=False)
    def search_projects(self, **kwargs):
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        user, err = self._require_admin()
        if err:
            return err

        q = (request.httprequest.args.get('q') or '').strip()

        is_admin = user.has_group('base.group_system')
        Relation = request.env['erpv6.tracking.relation'].sudo()
        domain = [('parent_id', '=', False)]

        if not is_admin:
            domain = ['|',
                ('owner_user_id', '=', user.id),
                ('access_user_ids', 'in', [user.id]),
            ] + domain

        if q:
            domain.append(('name', 'ilike', q))

        projects = Relation.search(domain, limit=50, order='name asc')

        result = [{
            'id': r.id,
            'name': r.name,
            'emailAlias': r.email_alias or '',
        } for r in projects]

        return self._json_response({'success': True, 'projects': result})

    # ================================================================
    # UPLOAD ATTACHMENT
    # ================================================================
    @http.route('/api/v1/admin/emails/upload',
                type='http', auth='none', methods=['POST', 'OPTIONS'], csrf=False)
    def upload_attachment(self, **kwargs):
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        user, err = self._require_admin()
        if err:
            return err

        import base64
        try:
            body = request.httprequest.get_data(as_text=True)
            data = json.loads(body or '{}')
        except json.JSONDecodeError:
            return self._json_response({'error': 'JSON non valido'}, 400)

        name = data.get('name', 'allegato')
        content_b64 = data.get('content', '')
        if not content_b64:
            return self._json_response({'error': 'File vuoto'}, 400)

        try:
            file_data = base64.b64decode(content_b64)
            if len(file_data) > 10 * 1024 * 1024:
                return self._json_response({'error': 'File > 10 MB'}, 400)

            att = request.env['ir.attachment'].sudo().create({
                'name': name,
                'datas': base64.b64encode(file_data),
                'res_model': 'mail.compose.temp',
                'res_id': 0,
            })
            return self._json_response({
                'success': True,
                'attachmentId': att.id,
                'name': name,
                'size': len(file_data),
            })
        except Exception as e:
            _logger.exception('Upload fallito')
            return self._json_response({'error': str(e)}, 500)
