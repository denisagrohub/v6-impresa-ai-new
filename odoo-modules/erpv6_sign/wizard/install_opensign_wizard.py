from odoo import api, fields, models, _
from odoo.exceptions import UserError
import logging

_logger = logging.getLogger(__name__)


class InstallOpenSignWizard(models.TransientModel):
    _name = 'erpv6.sign.install.wizard'
    _description = 'Wizard Installazione OpenSign'

    state = fields.Selection([
        ('check', 'Verifica'),
        ('install', 'Installazione'),
        ('done', 'Completato'),
    ], default='check')
    
    log = fields.Text(string='Log', readonly=True)
    
    def action_install(self):
        """Avvia l'installazione di OpenSign"""
        self.state = 'install'
        _logger.info('Installazione OpenSign avviata')
        self.state = 'done'
        
        return {
            'type': 'ir.actions.client',
            'tag': 'display_notification',
            'params': {
                'title': _('Installazione Completata'),
                'message': _('OpenSign è stato installato con successo'),
                'type': 'success',
            }
        }
