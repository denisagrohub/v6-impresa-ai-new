from odoo import models, fields, api, _
import logging
import requests
import json

_logger = logging.getLogger(__name__)


class Erpv6SetupWizard(models.TransientModel):
    _name = 'erpv6.setup.wizard'
    _description = 'ERP V6 Setup Wizard'

    state = fields.Selection([
        ('choose_vertical', 'Scegli Verticale'),
        ('installing', 'Installazione'),
        ('done', 'Completato')
    ], string='Stato', default='choose_vertical')
    
    parent_url = fields.Char(string='URL Parent', required=True, 
                             help="URL del gateway parent, es. https://api.v6impresa.it")
    api_key = fields.Char(string='API Key', required=True, 
                          help="API Key fornita per questo tenant")
    verticale_selezionato = fields.Char(string='Verticale Selezionato')
    available_verticals = fields.Text(string='Verticali Disponibili', readonly=True)
    log = fields.Text(string='Log Installazione', readonly=True)

    @api.model
    def action_fetch_verticals(self):
        """
        Chiama l'endpoint del parent per ottenere l'elenco verticali disponibili.
        """
        self.ensure_one()
        
        try:
            url = f"{self.parent_url.rstrip('/')}/api/v1/saas/verticals"
            headers = {
                'Authorization': f'Bearer {self.api_key}',
                'Content-Type': 'application/json'
            }
            
            response = requests.get(url, headers=headers, timeout=10)
            response.raise_for_status()
            
            data = response.json()
            
            # Formatta la lista verticali per visualizzazione
            verticals_list = []
            for v in data.get('verticals', []):
                verticals_list.append(f"- {v.get('verticale')}: {v.get('name')}")
            
            self.available_verticals = '\n'.join(verticals_list) if verticals_list else _('Nessun verticale disponibile')
            
            return {
                'type': 'ir.actions.client',
                'tag': 'display_notification',
                'params': {
                    'title': _('Verticali caricati'),
                    'message': _('Elenco verticali aggiornato con successo.'),
                    'type': 'success',
                    'sticky': False,
                }
            }
            
        except requests.exceptions.RequestException as e:
            _logger.error(f"Errore nel fetch verticali: {e}")
            self.log = f"ERRORE fetch verticali: {str(e)}\n" + (self.log or '')
            return {
                'type': 'ir.actions.client',
                'tag': 'display_notification',
                'params': {
                    'title': _('Errore'),
                    'message': _('Impossibile contattare il parent: %s') % str(e),
                    'type': 'danger',
                    'sticky': True,
                }
            }

    @api.model
    def action_install_verticale(self):
        """
        Installa i moduli del verticale selezionato.
        """
        self.ensure_one()
        
        if not self.verticale_selezionato:
            return {
                'type': 'ir.actions.client',
                'tag': 'display_notification',
                'params': {
                    'title': _('Attenzione'),
                    'message': _('Seleziona un verticale prima di procedere.'),
                    'type': 'warning',
                    'sticky': False,
                }
            }
        
        self.state = 'installing'
        log_lines = []
        
        try:
            # Ottieni lista moduli dal parent
            url = f"{self.parent_url.rstrip('/')}/api/v1/saas/verticals/{self.verticale_selezionato}/modules"
            headers = {
                'Authorization': f'Bearer {self.api_key}',
                'Content-Type': 'application/json'
            }
            
            response = requests.get(url, headers=headers, timeout=10)
            response.raise_for_status()
            
            data = response.json()
            modules = data.get('modules', [])
            
            log_lines.append(f"Moduli da installare per '{self.verticale_selezionato}': {', '.join(modules)}")
            
            # Installa ogni modulo
            for module_name in modules:
                try:
                    module_rec = self.env['ir.module.module'].search([('name', '=', module_name)], limit=1)
                    if module_rec:
                        if module_rec.state == 'installed':
                            log_lines.append(f"[SKIP] {module_name}: già installato")
                        elif module_rec.state == 'to_upgrade':
                            log_lines.append(f"[SKIP] {module_name}: in aggiornamento")
                        else:
                            log_lines.append(f"[INSTALL] {module_name}: installazione avviata")
                            module_rec.button_immediate_install()
                    else:
                        log_lines.append(f"[NOT FOUND] {module_name}: modulo non presente nel sistema")
                        
                except Exception as e:
                    log_lines.append(f"[ERRORE] {module_name}: {str(e)}")
                    # Continua con gli altri moduli senza bloccare
            
            self.log = '\n'.join(log_lines) + '\n' + (self.log or '')
            self.state = 'done'
            
            return {
                'type': 'ir.actions.client',
                'tag': 'display_notification',
                'params': {
                    'title': _('Installazione completata'),
                    'message': _('Verifica il log per i dettagli.'),
                    'type': 'success',
                    'sticky': False,
                }
            }
            
        except requests.exceptions.RequestException as e:
            _logger.error(f"Errore nell'installazione verticale: {e}")
            error_msg = f"ERRORE installazione: {str(e)}\n"
            self.log = error_msg + (self.log or '')
            self.state = 'choose_vertical'
            return {
                'type': 'ir.actions.client',
                'tag': 'display_notification',
                'params': {
                    'title': _('Errore'),
                    'message': _('Impossibile completare l\'installazione: %s') % str(e),
                    'type': 'danger',
                    'sticky': True,
                }
            }
