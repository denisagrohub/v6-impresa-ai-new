from odoo import models, fields, api, _
from odoo.exceptions import UserError
import logging
import json
from datetime import timedelta

_logger = logging.getLogger(__name__)


class Erpv6ParentCache(models.Model):
    _name = 'erpv6.parent.cache'
    _description = 'Cache per risposte dal parent SaaS'
    _order = 'fetched_at DESC'

    cache_key = fields.Char(string='Chiave Cache', required=True, index=True)
    content = fields.Text(string='Contenuto (JSON)', help='Risposta JSON serializzata dal parent')
    fetched_at = fields.Datetime(string='Data Fetch', required=True)
    ttl_hours = fields.Integer(string='TTL (ore)', required=True, default=24)
    category = fields.Char(string='Categoria', help='Per raggruppare/pulire cache per tipo')
    
    _sql_constraints = [
        ('cache_key_unique', 'UNIQUE(cache_key)', 'La chiave cache deve essere unica!')
    ]

    def is_valid(self):
        """
        Verifica se la cache è ancora valida rispetto al TTL.
        :return: True se (now - fetched_at) < ttl_hours
        """
        self.ensure_one()
        now = fields.Datetime.now()
        expiry = self.fetched_at + timedelta(hours=self.ttl_hours)
        return now < expiry
    
    def get_data(self):
        """
        Deserializza il contenuto JSON.
        :return: dict o None se non valido
        """
        self.ensure_one()
        try:
            return json.loads(self.content) if self.content else None
        except json.JSONDecodeError:
            _logger.error(f"Errore nel deserializzare cache key {self.cache_key}")
            return None
