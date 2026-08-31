from odoo import api, fields, models


class Erpv6CoreArc(models.Model):
    _name = 'erpv6.core.arc'
    _description = 'Arco/Azione tra due Nodi/Circuiti del grafo Adaptive EOSv6'

    name = fields.Char(compute='_compute_name', store=True)
    source_node_id = fields.Many2one('erpv6.core.node', string='Da', required=True, ondelete='cascade')
    target_node_id = fields.Many2one('erpv6.core.node', string='A', required=True, ondelete='cascade')
    active = fields.Boolean(
        default=True,
        help='Disattivare un arco lo esclude dal join AND in ingresso al nodo target -- vedi '
             'erpv6.validation.session._get_analyst_indices() (in questo modulo) per il caso '
             'reale in cui questo cambia davvero l\'esecuzione, non solo il disegno.')
    action_type = fields.Selection([
        ('data_flow', 'Flusso dati'),
        ('trigger', 'Attivazione'),
        ('gate_check', 'Verifica di Gate'),
        ('pid_fallback', 'Attivazione PID di fallback'),
        ('retry_loop', 'Loop di retry (nuovo round)'),
    ], required=True, default='data_flow', help='Determina forma/colore dell\'arco nel frontend.')
    is_and_join = fields.Boolean(
        default=True,
        help='True: il nodo target scatta solo se TUTTI gli archi attivi in ingresso con '
             'is_and_join=True sono soddisfatti (AND, non OR sul primo che arriva).')
    max_iterations = fields.Integer(
        string='Massimo numero di loop', default=5,
        help='Solo per action_type=retry_loop: quante volte al massimo il loop puo\' ripetersi '
             'prima di fermarsi (poi tocca al Gate/escalation umana). Pilota realmente '
             'erpv6.validation.session.max_rounds quando questo arco appartiene al circuito 6 '
             'Giudici -- vedi erpv6.core.circuit.run.run_six_judges_for_kb -- non e\' solo '
             'un\'etichetta sul disegno.')

    @api.depends('source_node_id.name', 'target_node_id.name', 'action_type')
    def _compute_name(self):
        for rec in self:
            rec.name = "%s → %s (%s)" % (
                rec.source_node_id.name or '?', rec.target_node_id.name or '?', rec.action_type or '')

    def insert_node_between(self, name):
        """Inserisce un Nodo nuovo a meta' di QUESTO arco (Denis, 29/08/2026:
        "voglio crearne una nuova e posizionarla tra quelle esistenti" --
        farlo a mano con 3 chiamate separate dal frontend aveva gia' lasciato
        un arco cancellato e nessuno ricreato, stato rotto a meta'). Tutto in
        una sola transazione Odoo: se qualcosa fallisce, rollback automatico
        a fine richiesta, mai piu' uno stato a meta'."""
        self.ensure_one()
        source, target = self.source_node_id, self.target_node_id
        parent = source.parent_id or target.parent_id
        new_node = self.env['erpv6.core.node'].create({
            'name': name,
            'parent_id': parent.id if parent else False,
        })
        action_type, is_and_join = self.action_type, self.is_and_join
        self.unlink()
        arc_in = self.create({
            'source_node_id': source.id, 'target_node_id': new_node.id,
            'action_type': action_type, 'is_and_join': is_and_join,
        })
        arc_out = self.create({
            'source_node_id': new_node.id, 'target_node_id': target.id,
            'action_type': action_type, 'is_and_join': is_and_join,
        })
        return new_node, arc_in, arc_out
