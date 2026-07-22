from odoo import models, fields, api


class ResPartner(models.Model):
    _inherit = 'res.partner'
    _inherits = {'erpv6.tracking.mixin': 'tracking_mixin_id'}

    # Link al mixin di tracciamento
    tracking_mixin_id = fields.Many2one(
        'erpv6.tracking.mixin',
        string='Tracking Mixin',
        required=True,
        ondelete='cascade',
        auto_join=True
    )

    # Flag consulente
    x_is_consultant = fields.Boolean(
        'È un Consulente',
        default=False,
        help='Indica se questo partner è un consulente'
    )
    x_is_referral = fields.Boolean(
        'È un Referral',
        default=False,
        help='Indica se questo partner è un referral'
    )

    # Brand associati (multibrand)
    x_brand_ids = fields.Many2many(
        'erpv6.consulting.brand',
        string='Brand Associati',
        help='Brand per cui questo consulente lavora'
    )

    # Configurazione economica
    x_hourly_rate = fields.Float(
        'Tariffa Oraria (€)',
        default=0.0,
        help='Tariffa oraria del consulente'
    )
    x_commission_rate = fields.Float(
        'Provvigione (%)',
        default=0.0,
        help='Percentuale provvigione su progetti'
    )
    x_max_discount = fields.Integer(
        'Sconto Max Concedibile (%)',
        default=5,
        help='Sconto massimo che il consulente può concedere'
    )

    # Tipo contratto
    x_contract_type = fields.Selection([
        ('percentage', 'Solo % provvigione'),
        ('fixed', 'Solo fisso'),
        ('fixed_plus_percentage', 'Fisso + % provvigione'),
    ], string='Tipo Contratto', default='percentage')

    x_fixed_fee = fields.Float(
        'Fee Fissa (€)',
        default=0.0,
        help='Fee fissa mensile/trimestrale'
    )

    # Specializzazioni
    x_specialties = fields.Char(
        'Specializzazioni',
        help='Aree di specializzazione (separate da virgola)'
    )

    # Stato
    x_consultant_status = fields.Selection([
        ('pending', 'In Attesa'),
        ('active', 'Attivo'),
        ('suspended', 'Sospeso'),
        ('archived', 'Archiviato'),
    ], string='Stato Consulente', default='pending')

    # Metadata
    x_onboarding_date = fields.Date('Data Onboarding')
    x_last_activity = fields.Datetime('Ultima Attività')

    @api.onchange('x_is_consultant')
    def _onchange_is_consultant(self):
        """Quando diventa consulente, imposta valori default"""
        if self.x_is_consultant and not self.x_hourly_rate:
            # Prendi il primo brand e usa i suoi valori default
            if self.x_brand_ids:
                brand = self.x_brand_ids[0]
                self.x_hourly_rate = brand.default_hourly_rate
                self.x_commission_rate = brand.default_commission_rate
                self.x_max_discount = brand.default_max_discount

    @api.model
    def create(self, vals):
        """Crea il mixin di tracciamento automaticamente"""
        if vals.get('x_is_consultant') or vals.get('x_is_referral'):
            # Crea il mixin
            mixin = self.env['erpv6.tracking.mixin'].create({})
            vals['tracking_mixin_id'] = mixin.id
        return super().create(vals)
