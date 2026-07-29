import base64

from cryptography.fernet import Fernet
from odoo import api, fields, models


class Erpv6CryptoKey(models.Model):
    _name = 'erpv6.crypto.key'
    _description = 'Chiave di Crittografia Versionata'
    _order = 'version desc'

    version = fields.Integer(required=True, readonly=True)
    key_encrypted = fields.Binary(required=True)
    key_type = fields.Selection([
        ('primary', 'Primaria'), ('secondary', 'Secondaria'),
    ], required=True, default='primary')
    valid_from = fields.Datetime(default=fields.Datetime.now)
    valid_to = fields.Datetime()
    is_active = fields.Boolean(default=False)

    _sql_constraints = [
        ('version_unique', 'unique(version, key_type)', 'Versione unica per tipo!'),
    ]

    @api.model
    def get_active_key_pair(self):
        primary = self.search([('is_active', '=', True), ('key_type', '=', 'primary')], limit=1)
        secondary = self.search([('is_active', '=', True), ('key_type', '=', 'secondary')], limit=1)
        if not primary:
            primary = self.create_new_key('primary')
        if not secondary:
            secondary = self.create_new_key('secondary')
        return primary.id, secondary.id

    @api.model
    def create_new_key(self, key_type='primary'):
        raw_key = Fernet.generate_key()
        master_key = self.env['erpv6.crypto.engine']._get_master_key()
        encrypted_key = Fernet(master_key).encrypt(raw_key)
        last_version = self.search(
            [('key_type', '=', key_type)], order='version desc', limit=1,
        ).version or 0
        record = self.create({
            'version': last_version + 1,
            'key_encrypted': base64.b64encode(encrypted_key).decode(),
            'key_type': key_type,
            'valid_from': fields.Datetime.now(),
            'is_active': True,
        })
        self.search([('id', '!=', record.id), ('key_type', '=', key_type)]).write({'is_active': False})
        self.clear_caches()
        return record

    def get_plain_key(self):
        master_key = self.env['erpv6.crypto.engine']._get_master_key()
        return Fernet(master_key).decrypt(base64.b64decode(self.key_encrypted))
