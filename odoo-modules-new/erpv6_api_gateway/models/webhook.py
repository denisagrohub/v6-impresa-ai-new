import hashlib
import hmac
import json
import logging
import secrets

import requests as req_lib
from odoo import api, fields, models

_logger = logging.getLogger(__name__)


class Webhook(models.Model):
    _name = 'erpv6.webhook'
    _description = 'Webhook'

    name = fields.Char(required=True)
    url = fields.Char(required=True)
    is_active = fields.Boolean(default=True)
    events = fields.Selection([
        ('kb.article.created', 'KB Creato'), ('kb.article.updated', 'KB Aggiornato'),
        ('booking.token.booked', 'Token Prenotato'), ('lead.created', 'Lead Creato'),
    ], required=True)
    secret = fields.Char(required=True, copy=False)

    @api.model_create_multi
    def create(self, vals_list):
        for v in vals_list:
            if not v.get('secret'):
                v['secret'] = secrets.token_urlsafe(32)
        return super().create(vals_list)

    def trigger(self, event_data):
        self.ensure_one()
        if not self.is_active:
            return False
        payload = json.dumps(event_data, sort_keys=True, default=str)
        sig = hmac.new(self.secret.encode(), payload.encode(), hashlib.sha256).hexdigest()
        try:
            req_lib.post(self.url, data=payload, headers={
                'Content-Type': 'application/json', 'X-Webhook-Signature': sig,
            }, timeout=10)
            return True
        except Exception as e:
            _logger.error("Webhook %s error: %s", self.name, e)
            return False
