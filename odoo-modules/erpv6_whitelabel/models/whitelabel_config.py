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

    # Identificativo brand/dominio (V6 Impresa, Bando Rapido, V6 Manuali Rapidi, V6 Performance...)
    code = fields.Char(
        string='Codice Brand',
        required=True,
        index=True,
        help="Identificativo univoco del brand/dominio, es: 'v6-impresa', 'v6-bandi', 'v6-manuali', 'v6-performance'"
    )
    domain = fields.Char(
        string='Dominio',
        help="Dominio pubblico associato a questo brand, es: 'v6impresa.it'"
    )

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
        ('unique_brand_code',
         'unique(code)',
         'Il codice brand deve essere univoco! Una company puo avere piu configurazioni brand (una per dominio).')
    ]

    @api.model
    def get_active_config(self, code=None, domain=None, company_id=None):
        """Ottiene la configurazione attiva per brand (code), dominio, o fallback su company_id.

        Ordine di ricerca: code -> domain -> company_id (legacy) -> crea default.
        """
        domain_filters = [('active', '=', True)]

        if code:
            domain_filters.append(('code', '=', code))
        elif domain:
            domain_filters.append(('domain', '=', domain))
        else:
            if not company_id:
                company_id = self.env.company.id
            domain_filters.append(('company_id', '=', company_id))

        config = self.search(domain_filters, limit=1, order='sequence ASC')

        if not config and (code or domain):
            # Nessuna config trovata per questo brand specifico: NON creare un default silenzioso,
            # meglio segnalare esplicitamente che il brand non è configurato.
            return self.browse()

        if not config:
            # Solo il fallback legacy per company_id crea una config default
            config = self.create({
                'name': 'Default Configuration',
                'code': 'default',
                'company_id': company_id or self.env.company.id,
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
