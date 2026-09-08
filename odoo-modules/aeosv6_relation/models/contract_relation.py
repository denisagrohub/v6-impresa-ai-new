from odoo import fields, models


class Erpv6Contract(models.Model):
    """Estende erpv6.contract (modulo erpv6_contract, invariato) con il
    collegamento al nodo erpv6.tracking.relation -- erpv6_contract resta
    generico e non dipende da questo modulo, e' aeosv6_relation che compone
    sopra, coerente col principio motore/conoscenza di CLAUDE.md."""
    _inherit = 'erpv6.contract'

    relation_id = fields.Many2one(
        'erpv6.tracking.relation', string='Nodo Progetto/Relazione',
    )
