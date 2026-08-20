from odoo import fields, models


class Erpv6KnowledgeBase(models.Model):
    """Estende erpv6.kb (motore generico, erpv6_kb) con il collegamento a un
    agente -- usato sia dalla memoria (erpv6.agent.config._write_memory) sia
    dalla conoscenza estratta da documenti (erpv6_agent/models/library_document.py).
    ondelete='cascade' su entrambi i campi: cancellare un agente cancella
    tutta la sua memoria e conoscenza, segnalato dal vivo dall'utente il
    20/08/2026 ("cancello l'agente si cancella tutto")."""
    _name = 'erpv6.kb'
    _inherit = 'erpv6.kb'

    agent_config_id = fields.Many2one(
        'erpv6.agent.config', string='Agente', ondelete='cascade', index=True,
        help="Se valorizzato, questa voce (memoria o conoscenza da documento) appartiene a questo "
             "agente e viene cancellata automaticamente se l'agente viene cancellato.",
    )
    source_document_id = fields.Many2one(
        'erpv6.library.document', string='Documento sorgente', ondelete='cascade', index=True,
        help="Se valorizzato, questa voce e' stata generata da questo documento (categoria "
             "'Conoscenza Agente') e viene cancellata automaticamente se il documento viene "
             "cancellato.",
    )
