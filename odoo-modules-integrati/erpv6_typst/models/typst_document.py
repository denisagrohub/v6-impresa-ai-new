from odoo import api, fields, models, _
from odoo.exceptions import UserError
import base64
import logging

_logger = logging.getLogger(__name__)


class TypstDocument(models.Model):
    _name = 'erpv6.typst.document'
    _description = 'Documento Generato Typst'
    _order = 'create_date desc'

    name = fields.Char(string='Nome Documento', required=True)
    template_id = fields.Many2one('erpv6.typst.template', string='Template', required=True)
    
    # Modello di riferimento
    res_model = fields.Char(string='Modello', required=True)
    res_id = fields.Integer(string='ID Record', required=True)
    
    # Dati usate per la generazione
    data = fields.Text(string='Dati (JSON)')
    
    # File generato
    file_content = fields.Binary(string='File Generato', attachment=True)
    file_name = fields.Char(string='Nome File')
    file_size = fields.Integer(string='Dimensione (bytes)')
    
    # Metadata
    status = fields.Selection([
        ('draft', 'Bozza'),
        ('generated', 'Generato'),
        ('sent', 'Inviato'),
        ('signed', 'Firmato'),
    ], string='Stato', default='draft', tracking=True)
    
    # Blockchain
    blockchain_hash = fields.Char(string='Hash Blockchain')
    blockchain_verified = fields.Boolean(string='Verificato su Blockchain')
    
    # Metadata aggiuntivi
    notes = fields.Text(string='Note')
    
    def _generate_pdf_with_typst(self, typst_content):
    """Genera il PDF usando Typst"""
    import tempfile
    import subprocess
    import os
    import shutil
    
    # Verifica se typst è disponibile
    if not shutil.which('typst'):
        raise UserError(_(
            'Typst non è installato nel container Docker. '
            'Per generare PDF, installa typst nel container con:\n'
            'docker exec -u root odoo apt-get update && docker exec -u root odoo apt-get install -y typst\n'
            'Oppure installa manualmente: https://typst.app/docs/'
        ))
    
    def action_generate(self):
        """Genera il documento dal template"""
        self.ensure_one()
        
        if not self.template_id:
            raise UserError(_('Template non specificato'))
        
        # Carica i dati
        import json
        data = json.loads(self.data) if self.data else {}
        
        # Renderizza il template
        rendered_content = self.template_id._render_template(data)
        
        # Genera il PDF con Typst
        try:
            pdf_content = self._generate_pdf_with_typst(rendered_content)
            
            self.write({
                'file_content': base64.b64encode(pdf_content),
                'file_name': f'{self.name}.pdf',
                'file_size': len(pdf_content),
                'status': 'generated',
            })
            
            # Registra utilizzo template
            self.template_id.action_use()
            
        except Exception as e:
            _logger.error(f'Errore generazione PDF: {e}')
            raise UserError(_('Errore durante la generazione del PDF: %s') % str(e))
    
    def _generate_pdf_with_typst(self, typst_content):
        """Genera il PDF usando Typst"""
        import tempfile
        import subprocess
        import os
        
        # Crea file temporaneo .typ
        with tempfile.NamedTemporaryFile(mode='w', suffix='.typ', delete=False) as f:
            f.write(typst_content)
            typst_file = f.name
        
        try:
            # Compila con typst
            pdf_file = typst_file.replace('.typ', '.pdf')
            
            result = subprocess.run(
                ['typst', 'compile', typst_file, pdf_file],
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if result.returncode != 0:
                raise Exception(f'Typst error: {result.stderr}')
            
            # Leggi il PDF generato
            with open(pdf_file, 'rb') as f:
                pdf_content = f.read()
            
            return pdf_content
            
        finally:
            # Pulisci file temporanei
            if os.path.exists(typst_file):
                os.unlink(typst_file)
            if os.path.exists(pdf_file):
                os.unlink(pdf_file)
    
    def action_send_to_sign(self):
        """Invia il documento per firma"""
        self.ensure_one()
        
        if not self.file_content:
            raise UserError(_('Documento non generato'))
        
        # In produzione: integra con erpv6_sign
        self.write({'status': 'sent'})
        
        return {
            'type': 'ir.actions.client',
            'tag': 'display_notification',
            'params': {
                'title': _('Documento Inviato'),
                'message': _('Il documento è stato inviato per firma'),
                'type': 'success',
            }
        }
