import logging

from odoo import models

_logger = logging.getLogger(__name__)


class Erpv6ValidationSessionCoreEngineExt(models.Model):
    """Override del hook _get_analyst_indices() introdotto in erpv6_validation
    (odoo-modules/erpv6_validation/models/validation_session.py): quando la
    sessione riguarda una voce erpv6.kb, l'elenco degli analisti da eseguire
    non e' piu' la lista hardcoded ['1'..'5'] ma i nodi-analista raggiunti da
    un ARCO ATTIVO verso il Gate "Sesto Uomo" nel Circuito 6 Giudici canonico
    del grafo -- questo e' il punto in cui disattivare una freccia nel
    portale visuale cambia davvero quanti analisti girano in una sessione
    reale, non solo l'aspetto del disegno."""
    _inherit = 'erpv6.validation.session'

    def _get_analyst_indices(self):
        self.ensure_one()
        if self.res_model != 'erpv6.kb' or self.validation_mode != 'full_six_judges':
            return super()._get_analyst_indices()
        circuit = self.env.ref('erpv6_core_engine.circuit_six_judges', raise_if_not_found=False)
        if not circuit:
            return super()._get_analyst_indices()
        # Denis, 29/08/2026: circuit_role='gate' e' stato rimosso -- il Gate
        # ora si trova via phase_gate_type (proprieta' del nodo, non piu'
        # legata a is_composite/circuit_role, vedi core_node.py).
        gate = circuit.child_ids.filtered(lambda n: n.phase_gate_type)[:1]
        if not gate:
            return super()._get_analyst_indices()
        active_arcs = gate.input_arc_ids.filtered(
            lambda a: a.action_type == 'data_flow' and a.source_node_id.analyst_index
        ).sorted(lambda a: a.source_node_id.sequence)
        indices = active_arcs.mapped('source_node_id.analyst_index')
        if not indices:
            _logger.warning(
                "Circuito 6 Giudici: nessun arco attivo Analista→Gate nel grafo, "
                "fallback al comportamento di default (5 analisti).")
            return super()._get_analyst_indices()
        return indices
