# -*- coding: utf-8 -*-
from odoo import _, api, fields, models


class Erpv6LandingProductRoute(models.Model):
    """Mapping prodotto (landing) -> consulente di riferimento (09/09/2026,
    prompt "Candidatura partnership + routing token prodotto + rotazione
    claim homepage", Parte B).

    Verificato prima di scriverlo (CLAUDE.md, "verifica se esiste gia' un
    motore generico riusabile"): nessun campo/tabella prodotto<->consulente
    esisteva - erpv6.consulting.consultant.specialties e' testo libero non
    strutturato ("Es: Fiscale, Psicologico"), non adatto a un match esatto
    per codice prodotto. Una tabella semplice (non un nuovo motore) e'
    la soluzione corretta qui.

    Vive in erpv6_production (non in un modulo aeosv6_* nuovo) perche' e'
    proprio _promote_to_opportunity/_auto_assign_consulente di crm_lead.py,
    entrambi qui, il punto che deve leggerla - nessuna dipendenza
    incrociata nuova."""
    _name = 'erpv6.landing.product.route'
    _description = 'Routing Prodotto Landing -> Consulente'
    _order = 'product_code'

    product_code = fields.Char(
        string='Codice Prodotto', required=True, index=True,
        help="Deve combaciare col parametro ?source=... della landing di prodotto "
             "(es. 'esg', 'business-plan', 'ricambio-generazionale').",
    )
    consultant_user_id = fields.Many2one(
        'res.users', string='Consulente di Riferimento', required=True,
        domain=lambda self: [('groups_id', 'in', self.env.ref('erpv6_core.group_consulente').ids)],
        help="Assegnato DIRETTAMENTE (saltando competenza/storico/zona) a un lead con questo "
             "landing_source_code - vedi crm_lead.py/_promote_to_opportunity.",
    )
    active = fields.Boolean(default=True)
    note = fields.Char(string='Nota')

    _sql_constraints = [
        ('product_code_unique', 'unique(product_code)',
         "Esiste gia' un routing per questo codice prodotto."),
    ]

    @api.model
    def _find_consultant_for_product(self, product_code):
        """Unico punto di lettura (mai una ricerca duplicata altrove):
        None se il codice e' vuoto o non ha un routing attivo, altrimenti
        il res.users da assegnare direttamente."""
        if not product_code:
            return self.env['res.users']
        route = self.sudo().search([
            ('product_code', '=', product_code), ('active', '=', True),
        ], limit=1)
        return route.consultant_user_id if route else self.env['res.users']
