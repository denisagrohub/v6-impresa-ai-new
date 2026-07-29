# -*- coding: utf-8 -*-
from odoo import models, fields, api


class ResCompany(models.Model):
    """Estensione di res.company per aggiungere campi white label"""
    _inherit = 'res.company'

    whitelabel_config_id = fields.One2many(
        'erpv6.whitelabel.config', 
        'company_id', 
        string='Configurazione White Label'
    )
    
    # Campi quick-access per branding
    brand_primary_color = fields.Char(
        string='Colore Brand Primario', 
        default='#1a2744',
        related='whitelabel_config_id.primary_color',
        readonly=False
    )
    
    brand_secondary_color = fields.Char(
        string='Colore Brand Secondario', 
        default='#f97316',
        related='whitelabel_config_id.secondary_color',
        readonly=False
    )
    
    brand_logo = fields.Binary(
        string='Logo Brand',
        related='whitelabel_config_id.logo',
        readonly=False
    )
