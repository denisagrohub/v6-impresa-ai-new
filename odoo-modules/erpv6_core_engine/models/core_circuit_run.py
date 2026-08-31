from odoo import _, api, fields, models
from odoo.exceptions import UserError


class Erpv6CoreCircuitRun(models.Model):
    _name = 'erpv6.core.circuit.run'
    _description = 'Istanza reale di esecuzione di un Circuito del grafo Adaptive EOSv6'
    _order = 'create_date desc'

    circuit_id = fields.Many2one('erpv6.core.node', required=True, domain=[('is_composite', '=', True)])
    validation_session_id = fields.Many2one('erpv6.validation.session', ondelete='cascade')
    status = fields.Selection([
        ('running', 'In esecuzione'),
        ('passed_gate', 'Gate superato'),
        ('pid_activated', 'PID attivato'),
        ('human_gate_pending', 'In attesa Gate umano'),
        ('failed', 'Fallito'),
    ], default='running')
    node_run_ids = fields.One2many('erpv6.core.circuit.run.node', 'run_id')

    @api.model
    def run_six_judges_for_kb(self, kb_id):
        """Wrapper del pilota: NON reimplementa _run_round, chiama il gate
        reale gia' esistente (erpv6.kb.validation.gate.create_validation_sessions,
        odoo-modules/erpv6_production/models/kb_validation_gate.py) e poi
        mappa il risultato reale sulla traccia del grafo -- nessuna logica
        di decisione duplicata qui."""
        kb = self.env['erpv6.kb'].browse(kb_id)
        if not kb.exists():
            raise UserError(_("Voce KB #%s non trovata.") % kb_id)
        if 'erpv6.kb.validation.gate' not in self.env:
            raise UserError(_("erpv6_production non installato: manca il gate di validazione KB."))
        circuit = self.env.ref('erpv6_core_engine.circuit_six_judges', raise_if_not_found=False)
        if not circuit:
            raise UserError(_("Circuito canonico 'circuit_six_judges' non trovato -- reinstalla erpv6_core_engine."))

        # Validazione PRIMA di avviare chiamate AI reali (Denis, 29/08/2026):
        # un nodo senza KB collegata non deve partire in silenzio con
        # qualunque prompt di default risolva l'hook -- deve bloccare con un
        # errore chiaro, coerente con la regola di attivazione decisa fin
        # dall'inizio ("un nodo scatta solo se ha tutti gli input
        # richiesti"). Controllata qui, non dentro create_validation_sessions,
        # cosi' non si spreca una sessione/chiamata AI reale su un grafo
        # incompleto.
        # Denis, 29/08/2026: circuit_role='gate' e' stato rimosso -- il Gate
        # ora si trova via phase_gate_type (proprieta' del nodo, non piu'
        # legata a is_composite/circuit_role).
        gate = circuit.child_ids.filtered(lambda n: n.phase_gate_type)[:1]
        active_arcs = gate.input_arc_ids.filtered(
            lambda a: a.active and a.action_type == 'data_flow' and a.source_node_id.analyst_index
        ) if gate else self.env['erpv6.core.arc'].browse()
        nodes_to_check = active_arcs.mapped('source_node_id') | gate
        missing = nodes_to_check.filtered(
            lambda n: not n.kb_link_ids or not any(link.resolve_kb() for link in n.kb_link_ids)
        )
        if missing:
            raise UserError(_(
                "Impossibile eseguire: %s senza una KB collegata (rombo mancante)."
            ) % ', '.join(missing.mapped('name')))

        # L'arco retry_loop (Gate -> Circuito) porta il vero limite di round:
        # se presente e attivo, pilota davvero session.max_rounds invece di
        # restare solo un'etichetta sul disegno -- vedi max_iterations su
        # erpv6.core.arc e il parametro aggiunto a create_validation_sessions.
        loop_arc = circuit.input_arc_ids.filtered(
            lambda a: a.active and a.action_type == 'retry_loop' and a.source_node_id.id == gate.id
        )[:1] if gate else self.env['erpv6.core.arc'].browse()
        max_rounds = loop_arc.max_iterations if loop_arc else None

        sessions = self.env['erpv6.kb.validation.gate'].create_validation_sessions(kb, max_rounds=max_rounds)
        session = sessions[:1]
        if not session:
            raise UserError(_("Nessuna sessione di validazione creata per KB #%s.") % kb_id)
        run = self.create({'circuit_id': circuit.id, 'validation_session_id': session.id})
        run._sync_from_session()
        return run

    def _sync_from_session(self):
        """Legge erpv6.validation.round/.analysis GIA' creati da _run_round
        (nessuna logica di decisione duplicata qui) e popola node_run_ids
        mappando analyst_index -> erpv6.core.node.analyst_index."""
        RunNode = self.env['erpv6.core.circuit.run.node']
        for run in self:
            session = run.validation_session_id
            if not session:
                continue
            run.node_run_ids.unlink()
            last_round = session.round_ids[-1] if session.round_ids else False
            analyses = last_round.analysis_ids if last_round else self.env['erpv6.validation.analysis'].browse()
            node_by_analyst = {n.analyst_index: n for n in run.circuit_id.child_ids if n.analyst_index}
            for analysis in analyses:
                node = node_by_analyst.get(analysis.analyst_index)
                RunNode.create({
                    'run_id': run.id,
                    'node_id': node.id if node else False,
                    'analysis_id': analysis.id,
                    'outcome': 'fail' if (last_round and last_round.issues_found) else 'pass',
                    'is_ai_failure': last_round.is_ai_failure if last_round else False,
                })
            if session.status == 'converged':
                run.status = 'passed_gate'
            elif session.status == 'escalated_to_human' and last_round and last_round.is_ai_failure:
                run.status = 'pid_activated'
            elif session.status == 'escalated_to_human':
                run.status = 'human_gate_pending'
            elif session.status == 'approved':
                run.status = 'passed_gate'
            elif session.status == 'rejected':
                run.status = 'failed'
            else:
                run.status = 'running'

    def action_approve_gate(self):
        """Gate umano, davvero (Denis, 29/08/2026: 'finestra con approva/
        rifiuta'): chiama la vera action_human_approve() della sessione,
        non finge nulla -- disponibile solo quando status='human_gate_pending'
        (disaccordo di contenuto reale, mai su un fallimento tecnico)."""
        for run in self:
            if run.status != 'human_gate_pending':
                raise UserError(_("Run #%s non e' in attesa di un gate umano.") % run.id)
            run.validation_session_id.action_human_approve()
            run._sync_from_session()

    def action_reject_gate(self):
        for run in self:
            if run.status != 'human_gate_pending':
                raise UserError(_("Run #%s non e' in attesa di un gate umano.") % run.id)
            run.validation_session_id.action_human_reject()
            run._sync_from_session()


class Erpv6CoreCircuitRunNode(models.Model):
    _name = 'erpv6.core.circuit.run.node'
    _description = 'Esito reale di un singolo Nodo dentro una run di Circuito'

    run_id = fields.Many2one('erpv6.core.circuit.run', required=True, ondelete='cascade')
    node_id = fields.Many2one('erpv6.core.node')
    analysis_id = fields.Many2one('erpv6.validation.analysis')
    outcome = fields.Selection([('pass', 'Passato'), ('fail', 'Fallito')])
    is_ai_failure = fields.Boolean()
