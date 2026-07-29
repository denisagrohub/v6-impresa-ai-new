from odoo import models, fields, api
import logging

_logger = logging.getLogger(__name__)


class DeductionSuggestion(models.Model):
    _name = 'erpv6.deduction.suggestion'
    _description = 'Suggerimento Deduzione Fiscale'
    _order = 'priority desc, tax_savings desc'

    company_id = fields.Many2one(
        'res.company', string='Azienda',
        required=True, default=lambda self: self.env.company
    )

    # Categoria
    category = fields.Selection([
        ('office_supplies', 'Materiale Ufficio'),
        ('company_branding', 'Divise e Branding'),
        ('training', 'Formazione'),
        ('travel', 'Trasferte'),
        ('meals', 'Pasti e Rappresentanza'),
        ('vehicles', 'Veicoli Aziendali'),
        ('technology', 'Tecnologia e Software'),
        ('marketing', 'Marketing'),
        ('consulting', 'Consulenze'),
        ('energy', 'Energia e Utilities'),
        ('insurance', 'Assicurazioni'),
        ('rent', 'Affitti e Locazioni'),
        ('other', 'Altro'),
    ], string='Categoria', required=True)

    # Dati finanziari
    max_deductible = fields.Monetary(
        'Max Deducibile', currency_field='currency_id',
        help='Limite massimo deducibile per questa categoria nell\'anno'
    )
    current_in_stock = fields.Monetary(
        'Valore in Magazzino', currency_field='currency_id',
        help='Valore attuale in magazzino per questa categoria'
    )
    suggested_purchase = fields.Monetary(
        'Acquisto Consigliato', currency_field='currency_id',
        compute='_compute_suggested_purchase', store=True
    )
    tax_savings = fields.Monetary(
        'Risparmio Fiscale', currency_field='currency_id',
        compute='_compute_tax_savings', store=True
    )

    # Deduzione
    deduction_rate = fields.Float(
        '% Deducibile', default=100.0,
        help='Percentuale deducibile (es. 100 = tutto, 75 = parziale)'
    )
    tax_rate = fields.Float(
        'Aliquota Fiscale %', default=24.0,
        help='IRES standard 24%, o altra aliquota'
    )

    # Stato e priorità
    priority = fields.Selection([
        ('high', 'Alta'),
        ('medium', 'Media'),
        ('low', 'Bassa'),
    ], string='Priorità', default='medium')
    status = fields.Selection([
        ('available', 'Disponibile'),
        ('used', 'Utilizzato'),
        ('expired', 'Scaduto'),
    ], string='Stato', default='available')

    # Descrizione
    description = fields.Text('Descrizione')
    deadline = fields.Date('Scadenza')
    
    # Match inventario
    stock_product_ids = fields.Many2many(
        'product.product', string='Prodotti in Magazzino',
        compute='_compute_stock_products'
    )
    stock_quantity = fields.Float(
        'Quantità in Magazzino', compute='_compute_stock_products'
    )
    stock_value = fields.Monetary(
        'Valore Magazzino', currency_field='currency_id',
        compute='_compute_stock_products', store=True
    )

    currency_id = fields.Many2one(
        'res.currency', string='Valuta',
        default=lambda self: self.env.company.currency_id
    )

    @api.depends('max_deductible', 'current_in_stock')
    def _compute_suggested_purchase(self):
        """Calcola acquisto consigliato = max deducibile - in magazzino"""
        for rec in self:
            rec.suggested_purchase = max(0, rec.max_deductible - rec.current_in_stock)

    @api.depends('suggested_purchase', 'deduction_rate', 'tax_rate')
    def _compute_tax_savings(self):
        for rec in self:
            deductible_amount = rec.suggested_purchase * (rec.deduction_rate / 100)
            rec.tax_savings = deductible_amount * (rec.tax_rate / 100)

    @api.depends('category')
    def _compute_stock_products(self):
        """Trova prodotti in magazzino che matchano la categoria"""
        category_map = {
            'office_supplies': ['Ufficio', 'Cancelleria'],
            'technology': ['Elettronica', 'Informatica', 'Hardware'],
            'company_branding': ['Abbigliamento', 'Merchandising'],
            'marketing': ['Marketing', 'Pubblicità'],
            'energy': ['Energia'],
        }
        
        for rec in self:
            search_terms = category_map.get(rec.category, [])
            if search_terms:
                # Costruisce un dominio OR: [('categ_id.complete_name', 'ilike', 'Ufficio'), '|', ('categ_id.complete_name', 'ilike', 'Cancelleria'), ...]
                domain = []
                for i, term in enumerate(search_terms):
                    if i > 0:
                        domain.append('|')
                    domain.append(('categ_id.complete_name', 'ilike', term))
                
                products = self.env['product.product'].search(domain, limit=50)
                # Filtra solo prodotti con stock > 0
                products = products.filtered(lambda p: p.qty_available > 0)
                
                rec.stock_product_ids = products
                rec.stock_quantity = sum(products.mapped('qty_available'))
                rec.stock_value = sum(p.qty_available * p.standard_price for p in products)
            else:
                rec.stock_product_ids = self.env['product.product']
                rec.stock_quantity = 0
                rec.stock_value = 0

    def action_create_purchase_order(self):
        """Crea ordine di acquisto dal suggerimento"""
        self.ensure_one()
        
        # Crea ordine di acquisto
        po = self.env['purchase.order'].create({
            'partner_id': self.company_id.partner_id.id,
            'company_id': self.company_id.id,
            'notes': f'Ordine da suggerimento fiscale: {self.category}',
        })
        
        # Aggiungi righe ordine basate sui prodotti in magazzino
        for product in self.stock_product_ids[:5]:  # Max 5 prodotti
            self.env['purchase.order.line'].create({
                'order_id': po.id,
                'product_id': product.id,
                'name': product.name,
                'product_qty': max(1, 10 - product.qty_available),
                'price_unit': product.standard_price,
            })
        
        self.status = 'used'
        
        return {
            'type': 'ir.actions.act_window',
            'res_model': 'purchase.order',
            'res_id': po.id,
            'view_mode': 'form',
        }
