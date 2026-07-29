from odoo import models, fields

class ResPartner(models.Model):
    _inherit = 'res.partner'

    is_fenice_aderente = fields.Boolean(string='Aderente alla Rete Fattorie della Fenice', default=False)
    data_ammissione = fields.Date(string='Data Ammissione', default=fields.Date.today)
    anno_adesione = fields.Integer(string='Anno di Adesione', default=2025)
    provincia_id = fields.Many2one('res.country.state', string='Provincia Operativa', domain="[('country_id.code', '=', 'IT')]")
    
    tipo_aderente = fields.Selection([
        ('agricola', 'Azienda Agricola (Nucleo Primario)'),
        ('servizi', 'Azienda di Servizi (Strumentale - Max 25%)'),
    ], string='Tipo di Aderente', default='agricola')

    stato_aderente = fields.Selection([
        ('fondatore', 'Socio Fondatore (Quota 500€)'),
        ('espansione', 'Fase Espansione (Quota 1.000€)'),
        ('ordinario', 'Aderente Ordinario (Quota 2.000€)'),
        ('prova', 'In Periodo di Prova'),
        ('sospeso', 'Sospeso (Inattività > 90gg)'),
    ], string='Stato Contrattuale', default='prova')

    partecipa_biocircolo = fields.Boolean(string='Aderente BioCircolo (Conferimento Biomassa)', default=False)

    fenice_livello = fields.Selection([
        ('I', 'Livello I - Terre Venete (50-64 punti)'),
        ('II', 'Livello II - Serenissima (65-79 punti)'),
        ('III', 'Livello III - Leone di San Marco (80-92 punti)'),
        ('IV', 'Livello IV - Fenice / Ambasciatore (93-100 punti)'),
    ], string='Livello Qualità Fenice', default='I')
    
    livello_ecommerce = fields.Selection([
        ('base', 'Base (Fino a 5 referenze)'),
        ('intermedio', 'Intermedio (6-15 referenze)'),
        ('avanzato', 'Avanzato (16-30 referenze)'),
        ('premium', 'Premium (Oltre 30 referenze)'),
    ], string='Livello E-commerce (Modulo C)', default='base')

    prodotti_principali = fields.Text(string='Catalogo Referenze Principali')
    logo_azienda = fields.Image(string='Logo Aziendale', max_width=1024, max_height=1024)
    is_public_profile = fields.Boolean(string='Profilo Pubblico sul Marketplace', default=True)
