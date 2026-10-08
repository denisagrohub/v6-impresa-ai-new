# pylint: disable=import-error
"""Log immutabile accessi record-level (C-security-audit FASE 2).

Registra OGNI decisione di check_record_access: granted o denied.
Non modificabile da utenti (ACL readonly), cancellabile solo da admin.
"""
from odoo import api, fields, models
from odoo.http import request as http_request


class Erpv6ApiAccessLog(models.Model):
    _name = 'erpv6.api.access.log'
    _description = 'Log immutabile accessi API record-level'
    _order = 'create_date desc'

    user_id = fields.Many2one(
        'res.users', string='Utente',
        required=True, index=True, ondelete='cascade')

    route = fields.Char(string='Route API', required=True, index=True)
    method = fields.Char(string='Metodo HTTP', required=True, size=10)

    model = fields.Char(string='Modello', required=True, index=True)
    record_id = fields.Integer(string='ID record', required=True, index=True)

    granted = fields.Boolean(
        string='Concesso', required=True, index=True)
    reason = fields.Char(string='Motivo', required=True, size=64)

    ip_address = fields.Char(string='IP')
    user_agent = fields.Char(string='User agent', size=200)

    @api.model
    def log_access(self, user, route, method, model, record_id,
                   granted, reason):
        """Scrive il log. Best-effort: un errore non deve mai
        rompere la richiesta HTTP.
        """
        try:
            ip = None
            ua = None
            try:
                if http_request and hasattr(http_request, 'httprequest'):
                    ip = http_request.httprequest.remote_addr
                    ua_raw = http_request.httprequest.user_agent
                    ua = ua_raw.string[:200] if ua_raw else None
            except Exception:
                pass

            return self.sudo().create({
                'user_id': user.id,
                'route': route[:200] if route else '',
                'method': (method or '')[:10],
                'model': (model or '')[:80],
                'record_id': int(record_id or 0),
                'granted': bool(granted),
                'reason': (reason or '')[:64],
                'ip_address': ip,
                'user_agent': ua,
            })
        except Exception:
            # Fail-safe: mai rompere l'endpoint per un log fallito.
            import logging
            logging.getLogger(__name__).exception(
                'log_access fallito (route=%s record=%s/%s)',
                route, model, record_id)
            return False
