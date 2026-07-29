# -*- coding: utf-8 -*-
from odoo import models, fields, api, _
from odoo.exceptions import ValidationError
import logging

_logger = logging.getLogger(__name__)


class WhiteLabelConfig(models.Model):
    """Configurazione White Label per personalizzazione branding"""
    _name = 'erpv6.whitelabel.config'
    _description = 'Configurazione White Label'
    _order = 'sequence, id'

    name = fields.Char(string='Nome Configurazione', required=True, default='Default')
    sequence = fields.Integer(string='Sequenza', default=10)
    company_id = fields.Many2one('res.company', string='Azienda', default=lambda self: self.env.company)
    
    # Branding
    company_name = fields.Char(string='Nome Azienda Visualizzato')
    logo = fields.Binary(string='Logo Aziendale', attachment=True)
    logo_small = fields.Binary(string='Logo Piccolo', attachment=True)
    favicon = fields.Binary(string='Favicon', attachment=True)
    
    # Colori brand
    primary_color = fields.Char(string='Colore Primario', default='#1a2744', 
                                help="Colore principale del brand (es. header, bottoni)")
    secondary_color = fields.Char(string='Colore Secondario', default='#f97316',
                                  help="Colore secondario per accenti")
    success_color = fields.Char(string='Colore Successo', default='#10b981')
    warning_color = fields.Char(string='Colore Avviso', default='#f59e0b')
    danger_color = fields.Char(string='Colore Errore', default='#ef4444')
    
    # Font e stile
    font_family = fields.Char(string='Font Family', default="'Inter', sans-serif")
    border_radius = fields.Float(string='Border Radius (px)', default=6.0)
    
    # Testi personalizzati
    welcome_message = fields.Text(string='Messaggio di Benvenuto')
    footer_text = fields.Char(string='Testo Footer')
    support_email = fields.Char(string='Email Supporto')
    support_phone = fields.Char(string='Telefono Supporto')
    
    # Impostazioni avanzate
    hide_odoo_branding = fields.Boolean(string='Nascondi branding Odoo', default=False)
    custom_css = fields.Text(string='CSS Personalizzato')
    active = fields.Boolean(string='Attivo', default=True)
    
    _sql_constraints = [
        ('unique_company_config', 
         'unique(company_id)', 
         'Può esistere una sola configurazione white label per azienda!')
    ]

    @api.model
    def get_active_config(self, company_id=None):
        """Ottiene la configurazione attiva per l'azienda specificata"""
        if not company_id:
            company_id = self.env.company.id
        
        config = self.search([
            ('company_id', '=', company_id),
            ('active', '=', True)
        ], limit=1, order='sequence ASC')
        
        if not config:
            # Crea configurazione default se non esiste
            config = self.create({
                'name': 'Default Configuration',
                'company_id': company_id,
                'primary_color': '#1a2744',
                'secondary_color': '#f97316',
            })
        
        return config

    @api.model
    def get_white_label_data(self):
        """Restituisce i dati di configurazione per il frontend"""
        config = self.get_active_config()
        return {
            'company_name': config.company_name or self.env.company.name,
            'logo': config.logo,
            'logo_small': config.logo_small,
            'favicon': config.favicon,
            'primary_color': config.primary_color,
            'secondary_color': config.secondary_color,
            'success_color': config.success_color,
            'warning_color': config.warning_color,
            'danger_color': config.danger_color,
            'font_family': config.font_family,
            'border_radius': config.border_radius,
            'welcome_message': config.welcome_message,
            'footer_text': config.footer_text,
            'support_email': config.support_email,
            'support_phone': config.support_phone,
            'hide_odoo_branding': config.hide_odoo_branding,
            'custom_css': config.custom_css,
        }

    def action_preview(self):
        """Apre un wizard di anteprima"""
        self.ensure_one()
        return {
            'type': 'ir.actions.act_window',
            'name': _('Anteprima White Label'),
            'res_model': 'erpv6.whitelabel.preview',
            'view_mode': 'form',
            'target': 'new',
            'context': {'default_config_id': self.id},
        }
