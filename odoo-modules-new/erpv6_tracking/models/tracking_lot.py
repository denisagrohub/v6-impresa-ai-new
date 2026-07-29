import secrets
import string

from odoo import api, fields, models, _


class TrackingLot(models.Model):
    _name = 'erpv6.tracking.lot'
    _description = 'Lotto di Tracciamento'
    _order = 'create_date desc'

    name = fields.Char('Nome Lotto', required=True, readonly=True)
    code = fields.Char('Codice Lotto', required=True, readonly=True, index=True, copy=False)
    tracking_type = fields.Selection([('batch', 'Batch'), ('definitive', 'Definitivo')], default='batch', required=True)
    company_id = fields.Many2one('res.company', default=lambda self: self.env.company, required=True)
    brand_id = fields.Many2one('erpv6.consulting.brand', string='Brand')
    product_id = fields.Many2one('product.template', string='Prodotto')
    quantity = fields.Float('Quantita', default=1.0)
    production_cost = fields.Float('Costo Produzione')
    expiration_date = fields.Date('Scadenza')
    location = fields.Char('Posizione')
    notes = fields.Text('Note')
    production_date = fields.Datetime(default=fields.Datetime.now)
    state = fields.Selection([('draft', 'Bozza'), ('active', 'Attivo'), ('closed', 'Chiuso')], default='draft', tracking=True)

    _sql_constraints = [('code_unique', 'unique(code)', 'Codice univoco!')]

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if not vals.get('code'):
                prefix = 'BATCH' if vals.get('tracking_type', 'batch') == 'batch' else 'DEF'
                date_str = fields.Datetime.now().strftime('%Y%m%d')
                rand = ''.join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(6))
                vals['code'] = f"{prefix}-{date_str}-{rand}"
                vals['name'] = f"Lotto {vals['code']}"
        return super().create(vals_list)

    def action_activate(self):
        self.write({'state': 'active'})

    def action_close(self):
        self.write({'state': 'closed'})

    def action_reset_draft(self):
        self.write({'state': 'draft'})
