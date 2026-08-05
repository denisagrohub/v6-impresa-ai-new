from odoo import models, fields, api, _
from odoo.exceptions import UserError


class BrandProject(models.Model):
    _name = 'erpv6.brand.project'
    _description = 'Progetto di Branding'
    _inherit = ['mail.thread', 'mail.activity.mixin']

    name = fields.Char(string='Nome Progetto', required=True)
    partner_id = fields.Many2one('res.partner', string='Cliente')
    lead_id = fields.Many2one('crm.lead', string='Lead/Opportunità Collegata')
    
    status = fields.Selection([
        ('draft', 'Bozza'),
        ('candidates_generated', 'Candidati Generati'),
        ('selected', 'Selezionato'),
        ('finalized', 'Finalizzato'),
    ], string='Stato', default='draft', tracking=True)
    
    selected_name = fields.Char(string='Nome Brand Selezionato')
    selected_logo_asset_id = fields.Many2one(
        'erpv6.library.document',
        string='Logo Finale',
        comodel_name='erpv6.library.document',
        help='Riferimento all\'asset logo finale in library'
    )
    selected_palette = fields.Json(
        string='Palette Colori Scelta',
        help='Palette colori scelta (hex codes con ruolo: primary/secondary/accent...)'
    )
    
    naming_candidate_ids = fields.One2many(
        'erpv6.naming.candidate',
        'brand_project_id',
        string='Candidati Naming'
    )

    def action_finalize(self):
        """Imposta lo stato a finalized se status='selected'"""
        self.ensure_one()
        if self.status != 'selected':
            raise UserError(_('Puoi finalizzare solo un progetto con stato "Selezionato".'))
        self.write({'status': 'finalized'})
        return True

