from odoo import api, fields, models

class Erpv6PackageModule(models.Model):
    _name = 'erpv6.package.module'
    _description = 'Modulo di servizio'
    _inherit = ['mail.thread']

    name = fields.Char(required=True, tracking=True)
    code = fields.Char(required=True)
    price = fields.Monetary(required=True, tracking=True)
    currency_id = fields.Many2one('res.currency', default=lambda self: self.env.company.currency_id)
    description = fields.Text()
    is_active = fields.Boolean(default=True)
    # Specchio Odoo reale (aggiunto 23/08/2026, richiesto da Denis: "tutto
    # deve essere tracciabile") - erpv6.package.module resta la fonte di
    # verita' del contenuto (prezzo, intervista, template collegato),
    # product_id e' il record vendibile/fatturabile standard di Odoo, cosi'
    # questi "prodotti" hanno uno storico reale (magazzino/vendite/
    # fatturazione) invece di restare solo una riga interna. Creato/
    # sincronizzato automaticamente in create()/write(), mai a mano.
    product_id = fields.Many2one('product.product', string='Prodotto Odoo', copy=False, readonly=True,
                                  tracking=True)

    # TASK 1 - Estensione per integrazione con erpv6_typst e erpv6_kb
    required_fields = fields.Json(
        string='Schema Campi Richiesti',
        help='JSON Schema dei dati necessari per generare questa sezione'
    )
    interview_questions = fields.Text(
        string='Domande Intervista',
        help='Domande in linguaggio naturale, una per riga, derivate da required_fields'
    )
    generation_prompt_kb_id = fields.Many2one(
        'erpv6.kb',
        string='Prompt di Generazione',
        domain="[('kb_type','=','prompt')]",
        help='Prompt KB da usare per generare il contenuto di questa sezione'
    )
    typst_template_id = fields.Many2one(
        'erpv6.typst.template',
        string='Template Typst Collegato'
    )

    @api.model_create_multi
    def create(self, vals_list):
        records = super().create(vals_list)
        for record in records:
            record._ensure_product()
        return records

    def write(self, vals):
        result = super().write(vals)
        if 'name' in vals or 'price' in vals or 'code' in vals:
            for record in self:
                record._ensure_product()
        return result

    def _ensure_product(self):
        """Crea il product.product collegato se manca, altrimenti
        sincronizza nome/prezzo/codice - mai due volte lo stesso prodotto
        per lo stesso package_module (product_id e' la chiave)."""
        self.ensure_one()
        vals = {'name': self.name, 'list_price': self.price, 'default_code': self.code,
                'type': 'service', 'sale_ok': True}
        if self.product_id:
            self.product_id.sudo().write(vals)
            return self.product_id
        product = self.env['product.product'].sudo().create(vals)
        self.product_id = product.id
        self.message_post(body="Prodotto Odoo #%d creato e collegato automaticamente." % product.id)
        return product
