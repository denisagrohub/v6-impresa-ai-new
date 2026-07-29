from odoo import api, fields, models, _
from odoo.exceptions import UserError
import requests
import logging

_logger = logging.getLogger(__name__)


class SignRequest(models.Model):
    _name = 'erpv6.sign.request'
    _description = 'Richiesta di Firma'
    _inherit = ['mail.thread', 'mail.activity.mixin']
    _order = 'create_date desc'

    name = fields.Char(string='Nome Richiesta', required=True, tracking=True)
    contract_id = fields.Many2one('erpv6.contract', string='Contratto')
    document_id = fields.Many2one('erpv6.typst.document', string='Documento')
    partner_id = fields.Many2one('res.partner', string='Firmatario', required=True, tracking=True)
    
    # Stato
    status = fields.Selection([
        ('draft', 'Bozza'),
        ('sent', 'Inviata'),
        ('viewed', 'Visualizzata'),
        ('signed', 'Firmata'),
        ('expired', 'Scaduta'),
        ('declined', 'Rifiutata'),
    ], string='Stato', default='draft', tracking=True)
    
    # OpenSign
    external_id = fields.Char(string='ID OpenSign', readonly=True)
    request_url = fields.Char(string='URL Firma', readonly=True)
    
    # Timestamps
    sent_at = fields.Datetime(string='Inviata il')
    viewed_at = fields.Datetime(string='Visualizzata il')
    signed_at = fields.Datetime(string='Firmata il')
    
    # Firma
    signature_hash = fields.Char(string='Hash Firma', readonly=True)
    signed_document = fields.Binary(string='Documento Firmato', attachment=True, readonly=True)
    
    # Metadata
    notes = fields.Text(string='Note')
    
    def action_send_to_sign(self):
        """Invia la richiesta di firma a OpenSign"""
        self.ensure_one()
        
        if not self.document_id or not self.document_id.file_content:
            raise UserError(_('Documento non disponibile'))
        
        # Config OpenSign
        config = self.env['erpv6.sign.config'].search([('active', '=', True)], limit=1)
        if not config:
            raise UserError(_('Configurazione OpenSign non trovata'))
        
        # Prepara payload per OpenSign
        import base64
        payload = {
            'document': base64.b64decode(self.document_id.file_content).decode('latin-1'),
            'document_name': self.document_id.file_name,
            'signers': [
                {
                    'name': self.partner_id.name,
                    'email': self.partner_id.email,
                    'phone': self.partner_id.phone or '',
                }
            ],
            'callback_url': f"{self.env['ir.config_parameter'].sudo().get_param('web.base.url')}/api/opensign/callback",
        }
        
        try:
            response = requests.post(
                f"{config.opensign_url}/api/document",
                json=payload,
                headers={'Authorization': f'Bearer {config.api_key}'},
                timeout=30
            )
            
            if response.status_code == 200:
                result = response.json()
                self.write({
                    'status': 'sent',
                    'external_id': result.get('document_id'),
                    'request_url': result.get('sign_url'),
                    'sent_at': fields.Datetime.now(),
                })
                
                # Log
                self.env['erpv6.sign.log'].create({
                    'request_id': self.id,
                    'action': 'sent',
                    'details': f'Documento inviato a OpenSign: {result.get("document_id")}',
                })
                
                # Notifica
                self.message_post(body=_("Richiesta di firma inviata a %s") % self.partner_id.name)
                
            else:
                raise UserError(_('Errore OpenSign: %s') % response.text)
                
        except Exception as e:
            _logger.error(f'Errore invio firma: {e}')
            raise UserError(_('Errore durante l\'invio della richiesta: %s') % str(e))
    
    def action_check_status(self):
        """Verifica lo stato della firma su OpenSign"""
        self.ensure_one()
        
        if not self.external_id:
            return
        
        config = self.env['erpv6.sign.config'].search([('active', '=', True)], limit=1)
        if not config:
            return
        
        try:
            response = requests.get(
                f"{config.opensign_url}/api/document/{self.external_id}",
                headers={'Authorization': f'Bearer {config.api_key}'},
                timeout=10
            )
            
            if response.status_code == 200:
                result = response.json()
                status_map = {
                    'pending': 'sent',
                    'viewed': 'viewed',
                    'signed': 'signed',
                    'completed': 'signed',
                    'declined': 'declined',
                    'expired': 'expired',
                }
                
                new_status = status_map.get(result.get('status'), self.status)
                
                if new_status != self.status:
                    self.write({'status': new_status})
                    
                    if new_status == 'viewed':
                        self.write({'viewed_at': fields.Datetime.now()})
                    elif new_status == 'signed':
                        self.write({'signed_at': fields.Datetime.now()})
                        
                        # Scarica documento firmato
                        signed_doc = requests.get(
                            f"{config.opensign_url}/api/document/{self.external_id}/download",
                            headers={'Authorization': f'Bearer {config.api_key}'}
                        )
                        
                        if signed_doc.status_code == 200:
                            import base64
                            self.write({'signed_document': base64.b64encode(signed_doc.content)})
                    
                    # Log
                    self.env['erpv6.sign.log'].create({
                        'request_id': self.id,
                        'action': f'status_{new_status}',
                        'details': f'Stato aggiornato: {new_status}',
                    })
        
        except Exception as e:
            _logger.error(f'Errore verifica stato: {e}')
