from odoo import models, fields, api

class ConsultingBrand(models.Model):
    _name = 'erpv6.consulting.brand'
    _description = 'Brand di Consulting'
    
    name = fields.Char('Nome Brand', required=True)
    code = fields.Char('Codice Brand', required=True, help='Codice univoco (es: PI, ZS, MR)')
    
    # Configurazione
    active = fields.Boolean('Attivo', default=True)
    color = fields.Char('Colore Primario', default='#1a2744')
    logo_url = fields.Char('URL Logo')
    
    # Configurazione default per questo brand
    default_hourly_rate = fields.Float('Tariffa Oraria Default', default=150.0)
    default_commission_rate = fields.Float('Provvigione Default (%)', default=10.0)
    default_max_discount = fields.Integer('Sconto Max Default (%)', default=5)
    
    # Descrizione
    description = fields.Text('Descrizione')
    
    _sql_constraints = [
        ('code_unique', 'unique(code)', 'Il codice brand deve essere univoco!'),
    ]