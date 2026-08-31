from odoo import _, api, fields, models
from odoo.exceptions import ValidationError


class Erpv6CorePhase(models.Model):
    _name = 'erpv6.core.phase'
    _description = 'Fase -- contenitore temporale Stage-Gate del grafo Adaptive EOSv6'

    name = fields.Char(required=True)
    date_start = fields.Date(string='Inizio periodo')
    date_end = fields.Date(string='Fine periodo')
    # Denis, 29/08/2026: "la fase ha la possibilità di avere più entrate e
    # più uscite, entrambe possono essere sia entrate che in uscita anche
    # contemporanee" -- da M2o singolo a M2m: lo stesso nodo può essere
    # exit_gate di questa Fase ed entry_gate della successiva senza
    # duplicare nulla. Il join AND su entrate multiple è già quello che
    # fanno gli archi (erpv6.core.arc.is_and_join) verso il nodo di
    # entrata -- non serve un meccanismo nuovo qui.
    entry_gate_ids = fields.Many2many(
        'erpv6.core.node', 'erpv6_core_phase_entry_gate_rel', 'phase_id', 'node_id',
        string='Gate di entrata', domain=[('phase_gate_type', '!=', False)])
    exit_gate_ids = fields.Many2many(
        'erpv6.core.node', 'erpv6_core_phase_exit_gate_rel', 'phase_id', 'node_id',
        string='Gate di uscita', domain=[('phase_gate_type', '!=', False)])
    node_ids = fields.Many2many(
        'erpv6.core.node', 'erpv6_core_phase_node_rel', 'phase_id', 'node_id',
        string='Nodi/Circuiti nella Fase')

    @api.constrains('node_ids')
    def _check_single_gate_per_phase(self):
        for rec in self:
            gates = rec.node_ids.filtered('phase_gate_type')
            if len(gates) > 1:
                raise ValidationError(_(
                    "La Fase '%s' ha più di un nodo Gate (%s) -- al massimo un Gate "
                    "per Fase, è l'unica autorità di validazione/escalation."
                ) % (rec.name, ', '.join(gates.mapped('name'))))
