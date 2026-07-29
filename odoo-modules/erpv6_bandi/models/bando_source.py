# -*- coding: utf-8 -*-
from odoo import models, fields, api, _
from odoo.exceptions import UserError
import logging

_logger = logging.getLogger(__name__)


class Erpv6BandoSource(models.Model):
    _name = 'erpv6.bando.source'
    _description = 'Fonte Scraping Bandi'
    _order = 'name'

    name = fields.Char(string='Nome Fonte', required=True)
    url = fields.Char(string='URL Base', required=True)
    source_type = fields.Selection([
        ('ministero', 'Ministero'),
        ('regione', 'Regione'),
        ('ue', 'Unione Europea'),
        ('invitalia', 'Invitalia'),
        ('custom', 'Custom'),
    ], string='Tipo Fonte', required=True)
    active = fields.Boolean(string='Attiva', default=True)
    last_scrape = fields.Datetime(string='Ultimo Scraping')
    scrape_interval_hours = fields.Integer(string='Intervallo Scraping (ore)', default=6)
    api_endpoint = fields.Char(string='API Endpoint')
    api_key = fields.Char(string='API Key')

    def action_scrape_now(self):
        """Chiama erpv6_deep_source per fare scraping"""
        self.ensure_one()
        
        # Cerca il modulo deep_source
        deep_source = self.env['erpv6.deep.source'].search([], limit=1)
        if not deep_source:
            raise UserError(_("erpv6_deep_source non installato o configurato"))
        
        # Chiama lo scraping
        try:
            results = deep_source.search_bandi(self.url, self.source_type)
            
            for result in results:
                existing = self.env['erpv6.bando'].search([
                    ('code', '=', result.get('code'))
                ], limit=1)
                
                if not existing:
                    self.env['erpv6.bando'].create({
                        'name': result.get('title', 'Senza titolo'),
                        'code': result.get('code', f"UNKNOWN-{self.id}"),
                        'ente': result.get('ente', self.name),
                        'importo_max': result.get('amount', 0.0),
                        'scadenza_domanda': result.get('deadline'),
                        'settori_target': ','.join(result.get('sectors', [])),
                        'source_id': self.id,
                        'tipo_agevolazione': 'misto',
                    })
            
            self.last_scrape = fields.Datetime.now()
            _logger.info(f"Scraping completato per {self.name}: {len(results)} risultati")
        except Exception as e:
            _logger.error(f"Errore scraping {self.name}: {str(e)}")
            raise UserError(_('Errore durante lo scraping: %s') % str(e))
        
        return True

    @api.model
    def _cron_scrape_all(self):
        """Cron job che fa scraping di tutte le fonti attive"""
        sources = self.search([('active', '=', True)])
        _logger.info(f"Cron scraping bandi: {len(sources)} fonti attive")
        
        for source in sources:
            try:
                source.action_scrape_now()
            except Exception as e:
                _logger.error(f"Errore cron scraping {source.name}: {str(e)}")
        
        return True
