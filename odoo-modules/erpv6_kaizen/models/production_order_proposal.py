from odoo import models


class Erpv6ProductionOrderProposal(models.Model):
    """_inherit su erpv6.production.order (definito in erpv6_production,
    dipendenza gia' dichiarata da questo modulo): aggiunge solo il bottone
    per aprire il wizard di proposta prodotto (Compito
    "wizard-prodotto-consulenza", 25/08/2026) - vive qui e non in
    erpv6_production perche' erpv6.kaizen.manual_report/il wizard vivono
    in erpv6_kaizen, e erpv6_production non puo' dipendere da erpv6_kaizen
    (dipendenza inversa gia' esistente: erpv6_kaizen -> erpv6_production)."""
    _inherit = 'erpv6.production.order'

    def action_propose_new_product(self):
        self.ensure_one()
        return {
            'type': 'ir.actions.act_window',
            'res_model': 'erpv6.kaizen.product.proposal.wizard',
            'view_mode': 'form',
            'target': 'new',
            'context': {'default_production_order_id': self.id},
        }
