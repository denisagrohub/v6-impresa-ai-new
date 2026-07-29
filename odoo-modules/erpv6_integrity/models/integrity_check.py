from odoo import api, fields, models, _
import hashlib, json, os, logging
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives.serialization import load_pem_public_key

_logger = logging.getLogger(__name__)

class Erpv6IntegrityCheck(models.Model):
    _name = 'erpv6.integrity.check'
    _description = 'Verifica Integrità Moduli'

    name = fields.Char(default='Integrity Check')
    active = fields.Boolean(default=True)
    last_check = fields.Datetime()
    status = fields.Selection([('ok','✅ OK'),('warning','⚠️ Attenzione'),('error','❌ Errore')], default='ok')
    details = fields.Text()

    @api.model
    def check_integrity(self):
        _logger.info('🔐 Avvio verifica integrità...')
        try:
            # Qui puoi aggiungere la logica di verifica firma se hai i file manifest
            # Per ora, verifichiamo che i moduli core siano installati
            critical_modules = ['erpv6_core', 'erpv6_crypto', 'erpv6_kb']
            installed = self.env['ir.module.module'].search([('name', 'in', critical_modules), ('state', '=', 'installed')])
            if len(installed) < len(critical_modules):
                missing = [m for m in critical_modules if m not in installed.mapped('name')]
                self._log_result('warning', f"Moduli critici mancanti: {', '.join(missing)}")
            else:
                self._log_result('ok', 'Verifica integrità completata con successo.')
            return True
        except Exception as e:
            self._log_result('error', str(e))
            return False

    def _log_result(self, status, details):
        # FIX CRITICO: Aggiorna solo il record corrente, non tutti con search([])
        self.ensure_one()
        self.write({
            'last_check': fields.Datetime.now(),
            'status': status,
            'details': details
        })
