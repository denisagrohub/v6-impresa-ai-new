from odoo import api, fields, models


class Erpv6CoreOutputLink(models.Model):
    _name = 'erpv6.core.output_link'
    _description = (
        "Collegamento Nodo->Output: questo nodo usa come input l'output di un "
        "altro nodo, INDIPENDENTEMENTE da un arco diretto tra loro -- e' il "
        "meccanismo che rende un Output riusabile da qualunque punto del grafo, "
        "non solo dal nodo immediatamente a valle (vedi erpv6.core.output)."
    )

    name = fields.Char(compute='_compute_name', store=True)
    target_node_id = fields.Many2one(
        'erpv6.core.node', string='Nodo consumatore', required=True, ondelete='cascade')
    output_id = fields.Many2one(
        'erpv6.core.output', string='Output collegato', required=True, ondelete='cascade')
    format_mismatch = fields.Boolean(
        compute='_compute_format_mismatch', store=True,
        help='True se output_id.output_type e\' diverso dall\'input_format del nodo target -- '
             'stesso identico principio di erpv6.core.kb_link.format_mismatch, esteso qui '
             'perche\' un Output-Link e\' l\'altra fonte reale di input di un Motore (§D: rombo '
             'o Output-Link, mai un terzo canale). Solo segnalazione visiva, NON blocca '
             'l\'esecuzione -- run_process()/run_circuit() invariati.')

    @api.depends('target_node_id.name', 'output_id.name')
    def _compute_name(self):
        for rec in self:
            rec.name = "%s → %s" % (rec.output_id.name or '?', rec.target_node_id.name or '?')

    @api.depends('output_id.output_type', 'target_node_id.input_format')
    def _compute_format_mismatch(self):
        for rec in self:
            rec.format_mismatch = bool(
                rec.target_node_id.input_format and rec.output_id.output_type
                and rec.target_node_id.input_format != rec.output_id.output_type
            )
