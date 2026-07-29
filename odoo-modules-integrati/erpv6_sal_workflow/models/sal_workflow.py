from odoo import models, fields, api, _
from odoo.exceptions import UserError
import hashlib
import json
import requests

class PiSALWorkflow(models.Model):
    _name = 'pi.sal.workflow'
    _description = 'SAL Workflow per Business Plan'
    _inherit = ['mail.thread', 'mail.activity.mixin']

    name = fields.Char(string='Nome SAL', compute='_compute_name', store=True)
    project_id = fields.Many2one('project.project', required=True, tracking=True)
    sal_number = fields.Integer(required=True, tracking=True)
    description = fields.Text(tracking=True)
    amount = fields.Monetary(string='Importo', required=True, tracking=True)
    currency_id = fields.Many2one('res.currency', default=lambda self: self.env.company.currency_id)
    status = fields.Selection([
        ('draft', 'Bozza'),
        ('submitted', 'In attesa approvazione cliente'),
        ('approved', 'Approvato'),
        ('invoiced', 'Fatturato'),
        ('paid', 'Pagato'),
        ('rejected', 'Rifiutato'),
    ], default='draft', tracking=True)
    
    approved_by_client = fields.Many2one('res.partner', string='Approvato da')
    approval_date = fields.Date(string='Data approvazione')
    approval_notes = fields.Text(string='Note approvazione')
    
    invoice_id = fields.Many2one('account.move', string='Fattura')
    payment_id = fields.Many2one('account.payment', string='Pagamento')
    payment_date = fields.Date(string='Data pagamento')
    
    blockchain_hash = fields.Char(string='Hash Blockchain')
    blockchain_tx_id = fields.Char(string='Transazione Blockchain')
    blockchain_verified = fields.Boolean(string='Verificato su Blockchain')

    @api.depends('project_id', 'sal_number')
    def _compute_name(self):
        for record in self:
            record.name = f"{record.project_id.name} - SAL {record.sal_number}"

    def action_submit_to_client(self):
        """Invia SAL al cliente per approvazione"""
        self.ensure_one()
        self.status = 'submitted'
        # Invia email al cliente
        template = self.env.ref('pi_sal_workflow.sal_submission_email')
        if template:
            template.send_mail(self.id, force_send=True)
        self.message_post(body=_("SAL %s inviato al cliente per approvazione") % self.sal_number)

    def action_approve_by_client(self):
        """Approvazione da parte del cliente (via frontend)"""
        self.ensure_one()
        self.status = 'approved'
        self.approval_date = fields.Date.today()
        # Registra su blockchain
        self._register_on_blockchain()
        self.message_post(body=_("SAL %s approvato dal cliente") % self.sal_number)

    def action_reject_by_client(self, reason):
        """Rifiuto da parte del cliente"""
        self.ensure_one()
        self.status = 'rejected'
        self.approval_notes = reason
        self.message_post(body=_("SAL %s rifiutato dal cliente: %s") % (self.sal_number, reason))

    def action_create_invoice(self):
        """Crea fattura per il SAL"""
        self.ensure_one()
        if self.status != 'approved':
            raise UserError(_("Il SAL deve essere approvato prima di fatturare"))
        
        invoice_vals = {
            'partner_id': self.project_id.partner_id.id,
            'invoice_date': fields.Date.today(),
            'move_type': 'out_invoice',
            'invoice_line_ids': [(0, 0, {
                'name': f"{self.project_id.name} - SAL {self.sal_number}: {self.description}",
                'quantity': 1.0,
                'price_unit': self.amount,
            })],
            'ref': f"BP-{self.project_id.id}-SAL-{self.sal_number}",
        }
        invoice = self.env['account.move'].create(invoice_vals)
        self.invoice_id = invoice.id
        self.status = 'invoiced'
        self.message_post(body=_("Fattura %s creata per SAL %s") % (invoice.name, self.sal_number))
        return {
            'type': 'ir.actions.act_window',
            'res_model': 'account.move',
            'res_id': invoice.id,
            'view_mode': 'form',
        }

    def action_mark_paid(self):
        """Marca il SAL come pagato"""
        self.ensure_one()
        if self.status != 'invoiced':
            raise UserError(_("Il SAL deve essere fatturato prima di marcare come pagato"))
        self.status = 'paid'
        self.payment_date = fields.Date.today()
        self.message_post(body=_("SAL %s marcato come pagato") % self.sal_number)

    def _register_on_blockchain(self):
        """Registra l'approvazione su blockchain"""
        import hashlib
        import json
        
        # Crea l'hash del SAL
        data = {
            'project': self.project_id.name,
            'project_id': self.project_id.id,
            'sal': self.sal_number,
            'amount': self.amount,
            'approved_by': self.approved_by_client.name if self.approved_by_client else 'Cliente',
            'date': str(self.approval_date),
            'timestamp': fields.Datetime.now().isoformat(),
        }
        
        hash_data = hashlib.sha256(json.dumps(data, sort_keys=True).encode()).hexdigest()
        self.blockchain_hash = hash_data
        
        # Chiamata al servizio blockchain (via API Next.js)
        try:
            response = requests.post(
                f"{self.env['ir.config_parameter'].sudo().get_param('web.base.url')}/api/blockchain/register",
                json={
                    'type': 'sal_approval',
                    'project_id': self.project_id.id,
                    'sal_id': self.id,
                    'hash': hash_data,
                    'data': data,
                },
                timeout=10
            )
            if response.status_code == 200:
                result = response.json()
                self.blockchain_tx_id = result.get('tx_id')
                self.blockchain_verified = True
        except Exception as e:
            # Log dell'errore ma non blocca il flusso
            self.env['ir.logging'].create({
                'name': 'Blockchain Registration Error',
                'type': 'server',
                'level': 'ERROR',
                'message': f"Errore registrazione blockchain: {str(e)}",
            })
