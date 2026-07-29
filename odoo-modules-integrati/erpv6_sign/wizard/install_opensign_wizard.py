from odoo import api, fields, models, _
from odoo.exceptions import UserError
import subprocess
import os
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
        
        script_path = os.path.join(os.path.dirname(__file__), '..', 'scripts', 'deploy_opensign.sh')
        
        if not os.path.exists(script_path):
            raise UserError(_('Script di deploy non trovato.'))
        
        process = subprocess.Popen(
            ['bash', script_path],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True
        )
        
        log_output = ''
        for line in process.stdout:
            log_output += line + '\n'
            self.write({'log': log_output})
        
        if process.returncode == 0:
            self.state = 'done'
        else:
            raise UserError(_('Errore installazione OpenSign'))
