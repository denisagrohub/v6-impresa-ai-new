from odoo import fields, models


class Erpv6LibraryDocumentCoreEngineExt(models.Model):
    """Estende erpv6.library.document (definito in erpv6_library) in modo
    ADDITIVO (Denis, 29/08/2026, decomposizione erpv6_library): category
    (Selection chiusa, letta come stringa da 4 moduli diversi -- erpv6_agent/
    marketing/production/kaizen) resta identica, mai toccata. category_id
    e' un catalogo vero parallelo, che i circuiti fanno crescere dichiarando
    nuove etichette (vedi core_library_category.py / Motore label_output),
    senza rompere nessun confronto esistente sul campo legacy."""
    _inherit = 'erpv6.library.document'

    category_id = fields.Many2one(
        'erpv6.core.library_category', string='Categoria (catalogo EAOSv6)',
        help="Popolato dal Motore 'etichettatrice' (label_output) quando un circuito "
             "dichiara un'etichetta per il suo Output -- parallelo al campo category "
             "legacy, mai un suo sostituto.")
