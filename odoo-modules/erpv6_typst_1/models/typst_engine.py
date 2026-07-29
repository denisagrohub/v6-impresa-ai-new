from odoo import api, fields, models, _
from odoo.exceptions import UserError
import logging

_logger = logging.getLogger(__name__)


class TypstEngine(models.Model):
    _name = 'erpv6.typst.engine'
    _description = 'Motore Typst'

    name = fields.Char(default='Typst Engine')
    active = fields.Boolean(default=True)
    typst_path = fields.Char(
        string='Percorso Typst',
        default='typst',
        help='Percorso al binario typst (es: /usr/local/bin/typst)'
    )
    
    @api.model
    def check_typst_installed(self):
        """Verifica se Typst è installato"""
        import subprocess
        
        try:
            result = subprocess.run(
                ['typst', '--version'],
                capture_output=True,
                text=True,
                timeout=5
            )
            return result.returncode == 0
        except:
            return False
    
    @api.model
    def generate_document(self, template_id, res_model, res_id, data=None):
        """Genera un documento da un template"""
        template = self.env['erpv6.typst.template'].browse(template_id)
        
        if not template.exists():
            raise UserError(_('Template non trovato'))
        
        # Crea il documento
        document = self.env['erpv6.typst.document'].create({
            'name': f'{template.name} - {res_model} #{res_id}',
            'template_id': template_id,
            'res_model': res_model,
            'res_id': res_id,
            'data': data or '{}',
        })
        
        # Genera il PDF
        document.action_generate()
        
        return document
