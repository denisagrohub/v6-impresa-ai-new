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

    def _all_aliases(self, logs):
        """Estrae caselle uniche dai matched_alias."""
        seen = {}
        for l in logs:
            alias = (l.get('matched_alias') or '').strip()
            if not alias:
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
        mailboxes = self._all_aliases(logs)

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
