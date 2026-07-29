from odoo import api, fields, models


class ConsultingConsultant(models.Model):
    _name = 'erpv6.consulting.consultant'
    _description = 'Consulente'

    partner_id = fields.Many2one('res.partner', string='Persona', required=True)
    brand_id = fields.Many2one('erpv6.consulting.brand', string='Brand', required=True)
    hourly_rate = fields.Float('Tariffa Oraria')
    commission_rate = fields.Float('Provvigione (%)')
    is_active = fields.Boolean('Attivo', default=True)
    fiscal_code = fields.Char('Codice Fiscale')
    vat_number = fields.Char('Partita IVA')
    zone = fields.Char('Zona Geografica')
    languages = fields.Char('Lingue Parlate', help='Es: IT, EN, DE')
    specialties = fields.Char('Specializzazioni', help='Es: Fiscale, Psicologico')
    conversion_rate = fields.Float('Tasso Conversione (%)')

    @api.onchange('brand_id')
    def _onchange_brand_id(self):
        if self.brand_id and not self.hourly_rate:
            self.hourly_rate = self.brand_id.default_hourly_rate
            self.commission_rate = self.brand_id.default_commission_rate
