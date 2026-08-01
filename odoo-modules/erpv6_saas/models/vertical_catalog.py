from odoo import models, fields, api, _
import logging

_logger = logging.getLogger(__name__)


class Erpv6VerticalCatalog(models.Model):
    _name = 'erpv6.vertical.catalog'
    _description = 'ERP V6 Catalogo Verticali'

    verticale = fields.Char(string='Codice Verticale', required=True, unique=True)
    name = fields.Char(string='Nome Verticale', required=True)
    module_names = fields.Text(string='Moduli (lista separata da virgola)', required=True,
                               help='Lista di nomi tecnici modulo separati da virgola')
    description = fields.Text(string='Descrizione')
    is_active = fields.Boolean(string='Attivo', default=True)

    @api.model
    def get_modules_for_verticale(self, verticale):
        """
        Ritorna la lista dei nomi modulo per il verticale richiesto.
        :param verticale: codice del verticale
        :return: lista di stringhe (nomi moduli) o lista vuota se non trovato
        """
        record = self.search([('verticale', '=', verticale), ('is_active', '=', True)], limit=1)
        if not record:
            _logger.warning(f"Verticale '{verticale}' non trovato o non attivo")
            return []
        
        # Split su virgola e trim degli spazi
        modules = [m.strip() for m in record.module_names.split(',') if m.strip()]
        return modules
