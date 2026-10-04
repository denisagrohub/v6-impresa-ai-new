# pylint: disable=import-error
"""Admin Mail Whitelist API (C5-mail-whitelist-dinamica).

04/10/2026: endpoint di debug/visibilita per la whitelist R2 a 5
livelli definita in erpv6_mail_guard. Ritorna chi e' whitelistato
e perche'. Solo admin.
"""
import logging

from odoo import http
from odoo.http import request

from .consultant_api import ConsultantAPIController

_logger = logging.getLogger(__name__)


class AdminMailWhitelistAPIController(ConsultantAPIController):

    @http.route(
        '/api/v1/admin/mail/whitelist-entries',
        type='http', auth='none', methods=['GET', 'OPTIONS'], csrf=False,
    )
    def whitelist_entries(self, **kwargs):  # pylint: disable=unused-argument
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        user, err = self._authenticate(require_auth=True)
        if err:
            return err
        if not user.has_group('base.group_system'):
            return self._json_response({'error': 'Solo admin'}, 403)

        ICP = request.env['ir.config_parameter'].sudo()
        entries = []

        # Livello 1: manuale
        manual = (ICP.get_param('mail.test_whitelist', '') or '')
        for e in [x.strip() for x in manual.split(',') if x.strip()]:
            entries.append({
                'email': e.lower(),
                'reason': 'manual',
                'details': 'mail.test_whitelist',
            })

        # Livello 2: domini
        domains_raw = ICP.get_param(
            'mail.whitelist_domains',
            'v6impresa.it,agrohubitalia.it') or ''
        domains = [d.strip().lower() for d in domains_raw.split(',') if d.strip()]
        for d in domains:
            entries.append({
                'email': '*@' + d,
                'reason': 'domain',
                'details': 'mail.whitelist_domains',
            })

        # Livelli 3/4/5: utenti V6 interni con gruppo
        group_ids = []
        for xid in (
            'erpv6_core.group_consulente',
            'erpv6_core.group_chief_projects',
            'erpv6_core.group_chief_bandi',
            'erpv6_core.group_chief_accounting',
            'erpv6_core.group_chief_marketing',
            'erpv6_core.group_chief_kb',
            'base.group_system',
        ):
            g = request.env.ref(xid, raise_if_not_found=False)
            if g:
                group_ids.append(g.id)

        U = request.env['res.users'].sudo()
        users = U.search([
            ('active', '=', True),
            ('groups_id', 'in', group_ids),
        ])
        for u in users:
            if u.email_slug:
                entries.append({
                    'email': '%s@v6impresa.it' % u.email_slug,
                    'reason': 'email_slug',
                    'details': '%s (uid=%d)' % (u.name, u.id),
                })
            if u.login and '@' in u.login:
                entries.append({
                    'email': u.login.strip().lower(),
                    'reason': 'login',
                    'details': '%s (uid=%d)' % (u.name, u.id),
                })
            pemail = u.partner_id.email
            if pemail and '@' in pemail:
                entries.append({
                    'email': pemail.strip().lower(),
                    'reason': 'partner.email',
                    'details': '%s (uid=%d)' % (u.name, u.id),
                })

        # Dedup per email, mantieni primo reason (priorita')
        seen = {}
        for e in entries:
            k = e['email']
            if k not in seen:
                seen[k] = e

        return self._json_response({
            'entries': list(seen.values()),
            'total': len(seen),
        })
