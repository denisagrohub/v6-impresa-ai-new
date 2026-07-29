import base64
import json
import logging
import os

from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

from odoo import api, fields, models, _
from odoo.exceptions import UserError

_logger = logging.getLogger(__name__)


class Erpv6CryptoEngine(models.Model):
    _name = 'erpv6.crypto.engine'
    _description = 'Motore di Crittografia V6'

    name = fields.Char(default='Motore Crypto V6')
    active = fields.Boolean(default=True)

    @api.model
    def _get_master_key(self):
        master_password = self.env['ir.config_parameter'].sudo().get_param(
            'crypto.master_password'
        )
        if not master_password:
            raise UserError(_(
                "Master Password non configurata "
                "(crypto.master_password)."
            ))
        salt_param = self.env['ir.config_parameter'].sudo().get_param(
            'crypto.master_salt'
        )
        if not salt_param:
            salt = os.urandom(16)
            salt_param = base64.b64encode(salt).decode()
            self.env['ir.config_parameter'].sudo().set_param(
                'crypto.master_salt', salt_param
            )
        else:
            salt = base64.b64decode(salt_param)
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(), length=32,
            salt=salt, iterations=100000,
        )
        return base64.urlsafe_b64encode(kdf.derive(master_password.encode()))

    @api.model
    def encrypt(self, data, context=None, double=False):
        if not data:
            return False
        if isinstance(data, (dict, list)):
            data = json.dumps(data, ensure_ascii=False)
        elif not isinstance(data, str):
            data = str(data)

        primary_id, secondary_id = self.env['erpv6.crypto.key'].get_active_key_pair()
        primary_key = self.env['erpv6.crypto.key'].browse(primary_id)
        secondary_key = self.env['erpv6.crypto.key'].browse(secondary_id)

        f1 = Fernet(primary_key.get_plain_key())
        layer1 = f1.encrypt(data.encode('utf-8'))
        result = {
            'data': base64.b64encode(layer1).decode(),
            'key_version_primary': primary_key.version,
            'double': False,
        }
        if double:
            f2 = Fernet(secondary_key.get_plain_key())
            layer2 = f2.encrypt(layer1)
            result['data'] = base64.b64encode(layer2).decode()
            result['key_version_secondary'] = secondary_key.version
            result['double'] = True

        self.env['erpv6.crypto.audit'].sudo().create({
            'user_id': self.env.user.id, 'operation': 'encrypt',
            'context': context or '', 'data_length': len(data),
            'ip_address': self.env.context.get('ip_address', ''),
        })
        return json.dumps(result, ensure_ascii=False)

    @api.model
    def decrypt(self, encrypted_data, context=None):
        if not encrypted_data:
            return False
        try:
            payload = json.loads(encrypted_data)
        except json.JSONDecodeError:
            raise UserError(_('Formato dati cifrato non valido: JSON malformato.'))

        for f in ('data', 'key_version_primary'):
            if f not in payload:
                raise UserError(_('Campo "%s" mancante nel payload cifrato.') % f)

        try:
            is_double = payload.get('double', False)
            if is_double:
                if 'key_version_secondary' not in payload:
                    raise UserError(_('Campo "key_version_secondary" mancante.'))
                ks = self.env['erpv6.crypto.key'].search([
                    ('version', '=', payload['key_version_secondary']),
                    ('key_type', '=', 'secondary'),
                ], limit=1)
                if not ks:
                    raise UserError(_('Chiave secondaria v%s non trovata') % payload['key_version_secondary'])
                layer1 = Fernet(ks.get_plain_key()).decrypt(base64.b64decode(payload['data']))
            else:
                layer1 = base64.b64decode(payload['data'])

            kp = self.env['erpv6.crypto.key'].search([
                ('version', '=', payload['key_version_primary']),
                ('key_type', '=', 'primary'),
            ], limit=1)
            if not kp:
                raise UserError(_('Chiave primaria v%s non trovata') % payload['key_version_primary'])

            decrypted = Fernet(kp.get_plain_key()).decrypt(layer1).decode('utf-8')

            self.env['erpv6.crypto.audit'].sudo().create({
                'user_id': self.env.user.id, 'operation': 'decrypt',
                'context': context or '', 'data_length': len(decrypted),
                'ip_address': self.env.context.get('ip_address', ''),
            })

            try:
                return json.loads(decrypted)
            except json.JSONDecodeError:
                return decrypted

        except UserError:
            raise
        except Exception as e:
            _logger.error("Errore decrittazione: %s", e)
            raise UserError(_('Errore durante la decrittazione dei dati.'))

    @api.model
    def rotate_keys(self):
        last = self.env['ir.config_parameter'].sudo().get_param(
            'crypto.last_rotation_type', 'secondary'
        )
        if last == 'primary':
            self.env['erpv6.crypto.key'].create_new_key('secondary')
            self.env['ir.config_parameter'].sudo().set_param('crypto.last_rotation_type', 'secondary')
        else:
            self.env['erpv6.crypto.key'].create_new_key('primary')
            self.env['ir.config_parameter'].sudo().set_param('crypto.last_rotation_type', 'primary')

        self.env['erpv6.crypto.audit'].sudo().create({
            'user_id': self.env.user.id, 'operation': 'rotate',
            'context': 'Rotazione chiavi completata',
            'ip_address': self.env.context.get('ip_address', ''),
        })
        _logger.info('Rotazione chiavi completata.')
        return True
