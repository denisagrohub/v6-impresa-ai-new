import logging

from odoo import api, fields, models

_logger = logging.getLogger(__name__)


class Erpv6IntegrityCheck(models.Model):
    _name = 'erpv6.integrity.check'
    _description = 'Verifica Integrita'

    name = fields.Char(default='Integrity Check')
    active = fields.Boolean(default=True)
    last_check = fields.Datetime()
    status = fields.Selection([('ok', 'OK'), ('warning', 'Warning'), ('error', 'Error')], default='ok')
    details = fields.Text()

    @api.model
    def check_integrity(self):
        record = self.search([], limit=1)
        if not record:
            record = self.create({'name': 'Integrity Check'})
        try:
            missing = []
            for m in ['erpv6_core', 'erpv6_crypto', 'erpv6_kb']:
                if not self.env['ir.module.module'].search([('name', '=', m), ('state', '=', 'installed')]):
                    missing.append(m)
            if missing:
                record.write({'last_check': fields.Datetime.now(), 'status': 'warning',
                              'details': 'Mancanti: ' + ', '.join(missing)})
            else:
                record.write({'last_check': fields.Datetime.now(), 'status': 'ok', 'details': 'Tutto OK'})
            return True
        except Exception as e:
            record.write({'last_check': fields.Datetime.now(), 'status': 'error', 'details': str(e)})
            return False
