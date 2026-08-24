from odoo import models, fields, api, _
import logging

_logger = logging.getLogger(__name__)


class Erpv6VerticalCatalog(models.Model):
    _name = 'erpv6.vertical.catalog'
    _description = 'ERP V6 Catalogo Verticali'

    verticale = fields.Char(string='Codice Verticale', required=True, unique=True)
    name = fields.Char(string='Nome Verticale', required=True)
    # Non required: questo catalogo ha un doppio uso. Per i verticali
    # provisionati come tenant SaaS (V6 Performance) elenca i moduli
    # erpv6_* da installare (get_modules_for_verticale). Per i verticali
    # usati solo come tassonomia (settore scelto nell'intervista V6
    # Impresa, vincolo su erpv6.kb.category.verticale) non ha senso
    # obbligare moduli che non esistono ancora da installare selettivamente.
    module_names = fields.Text(string='Moduli SaaS (lista separata da virgola)',
                               help='Solo per verticali provisionati come tenant SaaS (V6 Performance): '
                                    'lista di nomi tecnici modulo da installare. Vuoto per i verticali '
                                    'usati solo come tassonomia (KB, intervista pubblica).')
    description = fields.Text(string='Descrizione')
    is_active = fields.Boolean(string='Attivo', default=True)

    # Albero prodotto generico -> variante (aggiunto 23/08/2026 per
    # l'intervista intelligente, erpv6_production/models/interview_engine.py):
    # un padre (parent_id vuoto) rappresenta il "prodotto generico" scelto
    # come radice dell'intervista (es. "Produzioni Agricole Vegetali"), i
    # figli le varianti specifiche di settore (es. "Cerealicole",
    # "Orticole") che condividono lo stesso template/analisi ma cambiano il
    # contenuto raccolto. Riusa questa tabella (gia' la tassonomia
    # verticale/KB) invece di crearne una parallela -- principio "motore vs
    # conoscenza" di CLAUDE.md.
    parent_id = fields.Many2one(
        'erpv6.vertical.catalog', string='Prodotto generico (padre)',
        domain="[('parent_id', '=', False)]", ondelete='restrict',
        help="Vuoto = questo record E' un prodotto generico (radice). Valorizzato = questa e' una "
             "variante specifica di settore del prodotto generico indicato.")
    child_ids = fields.One2many('erpv6.vertical.catalog', 'parent_id', string='Varianti')

    @api.model
    def get_modules_for_verticale(self, verticale):
        """
        Ritorna la lista dei nomi modulo per il verticale richiesto.
        :param verticale: codice del verticale
        :return: lista di stringhe (nomi moduli) o lista vuota se non trovato/non provisionato
        """
        record = self.search([('verticale', '=', verticale), ('is_active', '=', True)], limit=1)
        if not record:
            _logger.warning(f"Verticale '{verticale}' non trovato o non attivo")
            return []
        if not record.module_names:
            return []

        # Split su virgola e trim degli spazi
        modules = [m.strip() for m in record.module_names.split(',') if m.strip()]
        return modules
