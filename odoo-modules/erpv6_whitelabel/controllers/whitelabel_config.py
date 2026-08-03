# -*- coding: utf-8 -*-
from odoo import http
from odoo.http import request
import json


class WhiteLabelController(http.Controller):
    """Controller per API White Label"""

    @http.route('/api/whitelabel/config', type='json', auth='public', methods=['POST'])
    def get_config(self, code=None, domain=None, company_id=None):
        """
        Ottiene la configurazione white label attiva per brand/dominio.

        :param code: codice brand (es. 'v6-bandi') - PRIORITARIO, usato dal frontend via header X-Brand-Code
        :param domain: dominio pubblico (es. 'v6bandi.it') - fallback se code non fornito
        :param company_id: ID azienda (legacy fallback)
        :return: Dizionario con configurazione
        """
        try:
            config_model = request.env['erpv6.whitelabel.config'].sudo()
            config = config_model.get_active_config(code=code, domain=domain, company_id=company_id)

            if not config:
                return {'success': False, 'error': f"Nessuna configurazione trovata per brand '{code or domain}'"}

            return {
                'success': True,
                'data': config.get_white_label_data(),
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
            }

    @http.route('/api/whitelabel/update', type='json', auth='user', methods=['POST'])
    def update_config(self, **kwargs):
        """
        Aggiorna la configurazione white label
        
        :param kwargs: Campi da aggiornare
        :return: Conferma aggiornamento
        """
        try:
            config_model = request.env['erpv6.whitelabel.config'].sudo()
            config = config_model.get_active_config()
            
            # Campi consentiti per l'aggiornamento
            allowed_fields = [
                'company_name', 'primary_color', 'secondary_color',
                'success_color', 'warning_color', 'danger_color',
                'font_family', 'border_radius', 'welcome_message',
                'footer_text', 'support_email', 'support_phone',
                'hide_odoo_branding', 'custom_css', 'logo', 'favicon'
            ]
            
            update_values = {}
            for field in allowed_fields:
                if field in kwargs:
                    update_values[field] = kwargs[field]
            
            if update_values:
                config.write(update_values)
            
            return {
                'success': True,
                'data': config.get_white_label_data(),
                'message': 'Configurazione aggiornata con successo',
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
            }

    @http.route('/web/white_label_assets', type='http', auth='public', website=True)
    def white_label_assets(self):
        """
        Restituisce CSS personalizzato per il white labeling
        Utile per integrazione con frontend esterni
        """
        try:
            config_model = request.env['erpv6.whitelabel.config'].sudo()
            config = config_model.get_active_config()
            
            css_content = f"""
            :root {{
                --wl-primary-color: {config.primary_color or '#1a2744'};
                --wl-secondary-color: {config.secondary_color or '#f97316'};
                --wl-success-color: {config.success_color or '#10b981'};
                --wl-warning-color: {config.warning_color or '#f59e0b'};
                --wl-danger-color: {config.danger_color or '#ef4444'};
                --wl-font-family: {config.font_family or "'Inter', sans-serif"};
                --wl-border-radius: {config.border_radius or 6}px;
            }}
            
            body {{
                font-family: var(--wl-font-family);
            }}
            
            .btn-primary {{
                background-color: var(--wl-primary-color) !important;
                border-color: var(--wl-primary-color) !important;
                border-radius: var(--wl-border-radius) !important;
            }}
            
            .btn-secondary {{
                background-color: var(--wl-secondary-color) !important;
                border-color: var(--wl-secondary-color) !important;
                border-radius: var(--wl-border-radius) !important;
            }}
            
            {config.custom_css or ''}
            """
            
            return request.make_response(
                css_content,
                [('Content-Type', 'text/css')]
            )
        except Exception as e:
            return request.make_response(
                f"/* Error: {str(e)} */",
                [('Content-Type', 'text/css')]
            )
