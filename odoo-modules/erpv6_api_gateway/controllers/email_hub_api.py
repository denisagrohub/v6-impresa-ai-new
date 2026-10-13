# pylint: disable=import-error
"""AEOS Email Hub API (C-email-hub-1 v1).

Backend aggregato per inbox unificata email. Legge mail.message
con join runtime ai log custom (winwin/project) per risolvere
progetto e contenuto.

Design (Q1-Q6 master):
  - Zero migrazione dati (opzione A)
  - Join runtime 3 path: direct / winwin log / project log
  - Fallback contenuto: se mail.message.subject/from/to/body vuoti,
    leggi dal log collegato
  - Scope: project (default) / personal / system
  - Palette colori progetti (10 mappati + fallback hash)
"""
import json
import logging
import time

from odoo import http
from odoo.http import request

from .consultant_api import ConsultantAPIController

_logger = logging.getLogger(__name__)


# Palette colori default (override via ir.config_parameter.email_hub.colors JSON)
DEFAULT_PROJECT_COLORS = {
    89: '#3B82F6',  # Acquisizione certificati
    88: '#F97316',  # Certificati intermediazione
    5:  '#10B981',  # Progetto TEE
    38: '#8B5CF6',  # Deal alpha-omega
    26: '#92400E',  # GO certificati
    6:  '#06B6D4',  # TEE cliente
    10: '#EC4899',  # TEE trader
    15: '#F59E0B',  # TEE referral
    19: '#84CC16',  # Fotovoltaico
    21: '#A855F7',  # AV illuminazione
}

FALLBACK_COLORS = [
    '#6B7280', '#0891B2', '#7C3AED', '#DB2777', '#059669',
    '#DC2626', '#CA8A04', '#4F46E5', '#0D9488', '#9333EA',
]


class EmailHubAPIController(ConsultantAPIController):

    def _project_color(self, relation_id):
        """Colore progetto: da config (ir.config_parameter) o default o hash."""
        if not relation_id:
            return '#6B7280'
        cfg = request.env['ir.config_parameter'].sudo().get_param('email_hub.colors')
        colors = DEFAULT_PROJECT_COLORS
        if cfg:
            try:
                colors = {int(k): v for k, v in json.loads(cfg).items()}
            except Exception:
                pass
        if relation_id in colors:
            return colors[relation_id]
        return FALLBACK_COLORS[(relation_id * 2654435761) % len(FALLBACK_COLORS)]

    def _resolve_project(self, msg):
        """Risolve il progetto per un mail.message. 3 path:
          A) model='erpv6.tracking.relation' -> res_id diretto
          B) model='erpv6.winwin.email.log' -> log.relation_id
          C) model='erpv6.project.email.log' -> log.relation_id
        Ritorna {id, name, color} o None.
        """
        env = request.env
        if msg.model == 'erpv6.tracking.relation':
            rel = env['erpv6.tracking.relation'].sudo().browse(msg.res_id)
            if rel.exists():
                return {
                    'id': rel.id, 'name': rel.name or '',
                    'color': self._project_color(rel.id),
                }
            return None
        if msg.model in ('erpv6.winwin.email.log', 'erpv6.project.email.log'):
            if msg.model not in env:
                return None
            log = env[msg.model].sudo().browse(msg.res_id)
            if not log.exists():
                return None
            rel = log.relation_id
            if rel:
                return {
                    'id': rel.id, 'name': rel.name or '',
                    'color': self._project_color(rel.id),
                }
        return None

    def _get_linked_log(self, msg):
        """Log custom collegato (se mail.message punta a un log), o None."""
        env = request.env
        if msg.model in ('erpv6.winwin.email.log', 'erpv6.project.email.log'):
            if msg.model in env:
                log = env[msg.model].sudo().browse(msg.res_id)
                if log.exists():
                    return log
        return None

    def _get_content(self, msg, log=None):
        """Fallback contenuto: mail.message se presente, altrimenti log."""
        if log is None:
            log = self._get_linked_log(msg)
        subject = msg.subject or (getattr(log, 'name', '') if log else '')
        email_from = msg.email_from or (getattr(log, 'sender_email', '') if log else '')
        email_to = (getattr(log, 'recipient_emails', '') if log else '') or ''
        # Body: mail.message primario, fallback dal log custom
        body = msg.body or ''
        if not body and log is not None:
            body = (getattr(log, 'body', '')
                    or getattr(log, 'body_html', '')
                    or getattr(log, 'message_body', '')
                    or '')
        return {
            'subject': subject or '(nessun oggetto)',
            'email_from': email_from or '',
            'email_to': email_to,
            'body': body,
        }

    def _message_to_dict(self, msg):
        """Serializza un mail.message per la inbox."""
        log = self._get_linked_log(msg)
        project = self._resolve_project(msg)
        content = self._get_content(msg, log)
        if log and hasattr(log, 'direction'):
            direction = log.direction or ''
        else:
            direction = 'out' if msg.message_type == 'email_outgoing' else 'in'
        attachment_count = request.env['ir.attachment'].sudo().search_count([
            ('res_model', '=', 'mail.message'),
            ('res_id', '=', msg.id),
        ])
        # 13/10/2026 (C-orchestrator-1 STEP B): link esplicito x_v6_*
        x_proj = msg.x_v6_project_id if 'x_v6_project_id' in msg._fields else None
        x_parte = msg.x_v6_parte_id if 'x_v6_parte_id' in msg._fields else None
        return {
            'id': msg.id,
            'subject': content['subject'],
            'email_from': content['email_from'],
            'email_to': content['email_to'],
            'author_name': msg.author_id.name if msg.author_id else '',
            'date': self._iso_utc(msg.date) if msg.date else None,
            'direction': direction,
            'message_type': msg.message_type or '',
            'has_attachments': attachment_count > 0,
            'attachment_count': attachment_count,
            'model': msg.model or '',
            'res_id': msg.res_id or 0,
            'project': project,
            'log_id': log.id if log else None,
            'log_model': log._name if log else None,
            'thread_id': msg.parent_id.id if msg.parent_id else msg.id,
            'x_v6_project_id': x_proj.id if x_proj else None,
            'x_v6_project': ({
                'id': x_proj.id,
                'name': x_proj.name or '',
                'partner_id': x_proj.partner_id.id if x_proj.partner_id else None,
            } if x_proj else None),
            'x_v6_parte_id': x_parte.id if x_parte else None,
            'x_v6_parte': ({
                'id': x_parte.id,
                'name': x_parte.name or '',
                'partner_id': x_parte.partner_id.id if x_parte.partner_id else None,
                'partner_name': x_parte.partner_id.name if x_parte.partner_id else None,
            } if x_parte else None),
        }

    def _base_domain(self, scope, user):
        """Domain base per lo scope."""
        env = request.env
        base = [('message_type', 'in', ['email', 'email_outgoing'])]
        if scope == 'project':
            return base + [('model', '!=', False)]
        if scope == 'personal':
            return base + [
                ('model', '=', False),
                ('author_id', '=', user.partner_id.id),
            ]
        if scope == 'system':
            system_partners = []
            try:
                bot_partner = env.ref('base.partner_root', False)
                if bot_partner:
                    system_partners.append(bot_partner.id)
                public_partner = env.ref('base.public_partner', False)
                if public_partner:
                    system_partners.append(public_partner.id)
            except Exception:
                pass
            if not system_partners:
                return base + [('id', '=', 0)]
            return base + [
                ('model', '=', False),
                ('author_id', 'in', system_partners),
            ]
        return base

    @http.route('/api/v1/admin/email-hub/messages',
                type='http', auth='none', methods=['GET', 'OPTIONS'], csrf=False)
    def list_messages(self, **kwargs):
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        start_time = time.time()

        user, err = self._authenticate(require_auth=True)
        if err:
            return err
        request.update_env(user=user.id)

        args = request.httprequest.args
        scope = (args.get('scope') or 'project').strip()
        project_id = args.get('project_id')
        partner_id = args.get('partner_id')
        search = (args.get('search') or '').strip().lower()
        try:
            limit = min(int(args.get('limit', 50) or 50), 200)
        except (ValueError, TypeError):
            limit = 50
        try:
            offset = max(int(args.get('offset', 0) or 0), 0)
        except (ValueError, TypeError):
            offset = 0

        domain = self._base_domain(scope, user)
        M = request.env['mail.message'].sudo()
        msgs = M.search(domain, order='date desc, id desc', limit=500)

        items = []
        for m in msgs:
            d = self._message_to_dict(m)
            if project_id:
                try:
                    pid = int(project_id)
                    if not d['project'] or d['project']['id'] != pid:
                        continue
                except (ValueError, TypeError):
                    pass
            if partner_id:
                try:
                    ppid = int(partner_id)
                    if not m.author_id or m.author_id.id != ppid:
                        continue
                except (ValueError, TypeError):
                    pass
            if search:
                blob = (d['subject'] + ' ' + d['email_from'] + ' ' + d['email_to']).lower()
                if search not in blob:
                    continue
            items.append(d)

        total = len(items)
        items = items[offset:offset + limit]

        self._log_api_call(
            '/api/v1/admin/email-hub/messages', 'GET', user.id, 200, start_time)
        return self._json_response({
            'success': True,
            'messages': items,
            'total': total,
            'scope': scope,
            'limit': limit,
            'offset': offset,
        })

    @http.route('/api/v1/admin/email-hub/sidebar',
                type='http', auth='none', methods=['GET', 'OPTIONS'], csrf=False)
    def sidebar(self, **kwargs):
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        user, err = self._authenticate(require_auth=True)
        if err:
            return err
        request.update_env(user=user.id)

        M = request.env['mail.message'].sudo()
        n_project = M.search_count(self._base_domain('project', user))
        n_personal = M.search_count(self._base_domain('personal', user))
        n_system = M.search_count(self._base_domain('system', user))

        msgs = M.search(self._base_domain('project', user), limit=1000)
        from collections import Counter
        proj_counts = Counter()
        people_counts = Counter()
        for m in msgs:
            p = self._resolve_project(m)
            if p:
                proj_counts[p['id']] += 1
            if m.author_id:
                people_counts[m.author_id.id] += 1

        projects = []
        Rel = request.env['erpv6.tracking.relation'].sudo()
        for rid, cnt in proj_counts.most_common(30):
            rel = Rel.browse(rid)
            if rel.exists():
                projects.append({
                    'id': rid, 'name': rel.name or '',
                    'color': self._project_color(rid), 'count': cnt,
                })

        people = []
        Partner = request.env['res.partner'].sudo()
        for pid, cnt in people_counts.most_common(20):
            p = Partner.browse(pid)
            if p.exists():
                people.append({
                    'id': pid, 'name': p.name or '', 'count': cnt,
                })

        return self._json_response({
            'success': True,
            'counters': {
                'project': n_project,
                'personal': n_personal,
                'system': n_system,
            },
            'projects': projects,
            'people': people,
        })

    # ═══════════════════════════════════════════════════════════════
    # 12/10/2026 (C-email-hub-1): dettaglio + reply + mark-read.
    # ═══════════════════════════════════════════════════════════════

    def _resolve_reply_from(self, msg, log, user):
        """12/10/2026 (fix C-email-hub-1): From/Reply-To per la risposta.

        Ordine:
          1. msg.model='erpv6.tracking.relation' -> relation.email_alias
          2. log.relation_id.email_alias
          3. Fallback: user.email_slug@v6impresa.it (firma personale)

        Ritorna (from_addr, is_project_alias, relation_name).
        """
        env = request.env
        relation = None
        # Path 1: mail.message diretto a relation
        if msg.model == 'erpv6.tracking.relation' and msg.res_id:
            relation = env['erpv6.tracking.relation'].sudo().browse(msg.res_id)
            if not relation.exists():
                relation = None
        # Path 2: log custom -> relation
        if relation is None and log is not None:
            rel = getattr(log, 'relation_id', None)
            if rel and rel.exists():
                relation = rel

        if relation is not None and relation.email_alias:
            alias_local = relation.email_alias.strip().lower()
            Alias = env['mail.alias'].sudo()
            candidates = Alias.search([
                ('alias_name', '=', alias_local),
                ('alias_model_id.model', '=', 'erpv6.tracking.relation'),
            ])
            chosen = None
            for cand in candidates:
                full = (cand.alias_full_name or '').lower()
                if full.endswith('@v6impresa.it'):
                    chosen = full
                    break
            if not chosen and candidates:
                chosen = (candidates[0].alias_full_name or '').lower()
            if not chosen:
                chosen = '%s@v6impresa.it' % alias_local
            return chosen, True, (relation.name or '')

        # Fallback: slug utente
        slug = getattr(user, 'email_slug', None) or 'denis.deste'
        return '%s@v6impresa.it' % slug, False, ''

    @http.route('/api/v1/admin/email-hub/messages/<int:msg_id>',
                type='http', auth='none', methods=['GET', 'OPTIONS'], csrf=False)
    def message_detail(self, msg_id, **kwargs):
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        user, err = self._authenticate(require_auth=True)
        if err:
            return err
        request.update_env(user=user.id)

        M = request.env['mail.message'].sudo()
        msg = M.browse(msg_id)
        if not msg.exists():
            return self._json_response({'error': 'Messaggio non trovato'}, 404)

        d = self._message_to_dict(msg)
        # Thread: parent (radice) + tutti i figli
        thread = []
        if msg.parent_id:
            thread.append(self._message_to_dict(msg.parent_id))
        thread.append(d)
        children = M.search([('parent_id', '=', msg.id)], order='date asc')
        for c in children:
            thread.append(self._message_to_dict(c))

        # Allegati
        Att = request.env['ir.attachment'].sudo()
        atts = Att.search([
            ('res_model', '=', 'mail.message'),
            ('res_id', '=', msg.id),
        ])
        attachments = [{
            'id': a.id, 'name': a.name or '',
            'size': a.file_size or 0, 'mimetype': a.mimetype or '',
        } for a in atts]

        _log = self._get_linked_log(msg)
        _content = self._get_content(msg, _log)
        return self._json_response({
            'success': True,
            'message': d,
            'body': _content.get('body', ''),
            'thread': thread,
            'attachments': attachments,
        })

    @http.route('/api/v1/admin/email-hub/messages/<int:msg_id>/reply',
                type='http', auth='none', methods=['POST', 'OPTIONS'], csrf=False)
    def reply_message(self, msg_id, **kwargs):
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        user, err = self._authenticate(require_auth=True)
        if err:
            return err
        request.update_env(user=user.id)

        M = request.env['mail.message'].sudo()
        msg = M.browse(msg_id)
        if not msg.exists():
            return self._json_response({'error': 'Messaggio non trovato'}, 404)

        try:
            body = request.httprequest.get_json(force=True, silent=True) or {}
        except Exception:
            body = {}
        body_html = (body.get('body_html') or '').strip()
        if not body_html:
            return self._json_response({'error': 'body_html obbligatorio'}, 400)

        # Log collegato + contenuto
        log = self._get_linked_log(msg)
        content = self._get_content(msg, log)

        # From/Sender = alias progetto o fallback slug utente
        from_addr, is_project_alias, relation_name = self._resolve_reply_from(
            msg, log, user)
        # Destinatario = chi ha inviato l'email originale
        import re as _re
        to_email = ''
        m2 = _re.search(r'[\w\.\-\+]+@[\w\.\-]+', content.get('email_from') or '')
        if m2:
            to_email = m2.group(0)

        # 12/10/2026 (C-email-settings-1): firma a cascata
        # (user > project > company) + logo + disclaimer.
        relation_for_sig = None
        if msg.model == 'erpv6.tracking.relation' and msg.res_id:
            rel = request.env['erpv6.tracking.relation'].sudo().browse(msg.res_id)
            if rel.exists():
                relation_for_sig = rel
        elif log is not None and getattr(log, 'relation_id', None):
            relation_for_sig = log.relation_id
        full_body, sig_logo_att = self._append_email_signature(
            body_html, user=user, relation=relation_for_sig)

        # Threading: In-Reply-To + References
        orig_message_id = msg.message_id or ''
        orig_ref = msg.references or '' if hasattr(msg, 'references') else ''
        refs = (orig_ref + ' ' + orig_message_id).strip() if orig_message_id else orig_ref
        headers = {}
        if orig_message_id:
            headers['In-Reply-To'] = orig_message_id
            headers['References'] = refs

        Mail = request.env['mail.mail'].sudo()
        vals = {
            'subject': 'Re: %s' % (content.get('subject') or ''),
            'body_html': full_body,
            'email_from': from_addr,
            'email_to': to_email or '',
            'reply_to': from_addr,
            'auto_delete': False,
            'headers': json.dumps(headers) if headers else False,
        }
        if sig_logo_att:
            vals['attachment_ids'] = [(4, sig_logo_att.id)]
        try:
            mail = Mail.create(vals)
            mail.send()
        except Exception as e:
            _logger.exception('Reply send failed')
            return self._json_response({'error': str(e)}, 500)

        # Crea mail.message collegato al parent (threading locale)
        try:
            new_msg = M.create({
                'subject': vals['subject'],
                'body': full_body,
                'email_from': from_addr,
                'author_id': user.partner_id.id,
                'message_type': 'email',
                'model': msg.model or False,
                'res_id': msg.res_id or False,
                'parent_id': msg.id,
                'message_id': '<hub-%s-%s@v6impresa.it>' % (msg.id, mail.id),
            })
        except Exception:
            _logger.exception('mail.message create failed (reply)')
            new_msg = None

        return self._json_response({
            'ok': True,
            'mail_id': mail.id,
            'message_id': new_msg.id if new_msg else None,
            'from': from_addr,
            'to': to_email,
            'is_project_alias': is_project_alias,
        })

    @http.route('/api/v1/admin/email-hub/messages/<int:msg_id>/mark-read',
                type='http', auth='none', methods=['POST', 'OPTIONS'], csrf=False)
    def mark_read(self, msg_id, **kwargs):
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        user, err = self._authenticate(require_auth=True)
        if err:
            return err
        request.update_env(user=user.id)

        M = request.env['mail.message'].sudo()
        msg = M.browse(msg_id)
        if not msg.exists():
            return self._json_response({'error': 'Messaggio non trovato'}, 404)

        # is_read è su mail.notification, non su mail.message.
        # Uso mail.notification per user corrente.
        Notif = request.env['mail.notification'].sudo()
        notifs = Notif.search([
            ('mail_message_id', '=', msg_id),
            ('res_partner_id', '=', user.partner_id.id),
        ])
        if notifs:
            notifs.write({'is_read': True})
        return self._json_response({'ok': True})

    @http.route('/api/v1/admin/email-hub/messages/<int:msg_id>/mark-unread',
                type='http', auth='none', methods=['POST', 'OPTIONS'], csrf=False)
    def mark_unread(self, msg_id, **kwargs):
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        user, err = self._authenticate(require_auth=True)
        if err:
            return err
        request.update_env(user=user.id)

        M = request.env['mail.message'].sudo()
        msg = M.browse(msg_id)
        if not msg.exists():
            return self._json_response({'error': 'Messaggio non trovato'}, 404)

        Notif = request.env['mail.notification'].sudo()
        notifs = Notif.search([
            ('mail_message_id', '=', msg_id),
            ('res_partner_id', '=', user.partner_id.id),
        ])
        if notifs:
            notifs.write({'is_read': False})
        return self._json_response({'ok': True})
