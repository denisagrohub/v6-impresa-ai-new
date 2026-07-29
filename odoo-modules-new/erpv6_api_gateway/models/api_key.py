import hashlib
import secrets

from odoo import api, fields, models


class ApiKey(models.Model):
    _name = 'erpv6.api.key'
    _description = 'API Key'
    _order = 'last_used desc'

    name = fields.Char(required=True)
    key = fields.Char(readonly=True, copy=False, required=True)
    key_hash = fields.Char(compute='_compute_hash', store=True)
    user_id = fields.Many2one('res.users', required=True)
    is_active = fields.Boolean(default=True)
    allowed_endpoints = fields.Char(default='*')
    rate_limit_per_minute = fields.Integer(default=60)
    rate_limit_per_day = fields.Integer(default=10000)
    expires_at = fields.Datetime()
    last_used = fields.Datetime(readonly=True)
    usage_count = fields.Integer(default=0, readonly=True)

    _sql_constraints = [('key_unique', 'unique(key)', 'Key univoca!')]

    @api.depends('key')
    def _compute_hash(self):
        for rec in self:
            rec.key_hash = hashlib.sha256(rec.key.encode()).hexdigest() if rec.key else False

    @api.model_create_multi
    def create(self, vals_list):
        for v in vals_list:
            if not v.get('key'):
                v['key'] = f"v6_{secrets.token_urlsafe(32)}"
        return super().create(vals_list)

    def check_endpoint_permission(self, endpoint):
        self.ensure_one()
        if self.allowed_endpoints == '*':
            return True
        for p in (e.strip() for e in self.allowed_endpoints.split(',')):
            if p.endswith('*') and endpoint.startswith(p[:-1]):
                return True
            if endpoint == p:
                return True
        return False
