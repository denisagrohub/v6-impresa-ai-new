from odoo import fields, models


class ProductTemplate(models.Model):
    _inherit = 'product.template'

    x_setup_fee = fields.Monetary(
        string='Quota di Setup (una tantum)',
        currency_field='currency_id',
        help='Costo di attivazione una tantum, distinto dal prezzo di vendita ricorrente.',
    )
    x_commission_percentage = fields.Float(
        string='Commissione Variabile (%)',
        digits=(5, 2),
        help='Percentuale di commissione applicata su volumi/vendite (es. canale online), '
             'a titolo informativo: non incide sul prezzo di listino.',
    )
