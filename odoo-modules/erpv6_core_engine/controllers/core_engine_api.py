import json

from odoo import http
from odoo.http import request, Response

from ..models.core_node import SAFE_ACTIVATION_TRIGGERS, SAFE_PROCESSES, TIPO_DATO_VOCABOLARIO


def _json_response(data, status=200):
    return Response(json.dumps(data, default=str), content_type='application/json', status=status)


class Erpv6CoreEngineController(http.Controller):
    """API minima per il pilota Adaptive EOSv6: serializza il grafo del
    circuito 6 Giudici per il portale visuale (apps/impresa, altra origine)
    e permette di disattivare un arco / lanciare una run reale.

    auth='public' + sudo() esplicito: il frontend Next.js gira su
    un'origine diversa da Odoo e non ha un cookie di sessione Odoo -- questo
    e' un endpoint interno/admin del PILOTA, non l'API pubblica di prodotto
    (quella e' erpv6_api_gateway, a bearer-token). Da irrobustire con
    un'autenticazione vera (token/header condiviso) prima di qualunque uso
    oltre la verifica locale del pilota -- annotato anche nel piano."""

    @http.route('/api/core-engine/circuit/<string:xmlid>', type='http', auth='public', methods=['GET'], csrf=False)
    def get_circuit(self, xmlid, **kwargs):
        # active_test=False: erpv6.core.node/.arc hanno un campo 'active' --
        # Odoo filtra IN AUTOMATICO i record active=False da ogni search()/
        # lettura di relazione a meno di disattivarlo esplicitamente qui.
        # Senza questo, un arco spento (o un nodo) spariva del tutto dalla
        # risposta invece di comparire come "spento" -- bug reale trovato da
        # Denis il 29/08/2026 (spegnere un arco lo faceva sparire dal
        # pannello, impossibile riaccenderlo dalla UI).
        env = request.env(su=True, context={'active_test': False})
        circuit = env.ref('erpv6_core_engine.%s' % xmlid, raise_if_not_found=False)
        if not circuit or not circuit.exists():
            return _json_response({'error': 'circuito non trovato'}, status=404)

        # Discendenza COMPLETA, non solo i figli diretti -- da quando i nodi
        # possono annidarsi davvero (es. "Diagnostica" reso composito con
        # sotto-azioni, 29/08/2026) un nipote spariva dalla risposta perche'
        # child_ids prende un solo livello.
        all_nodes = circuit
        frontier = circuit
        while frontier:
            frontier = frontier.child_ids
            all_nodes |= frontier

        nodes = [{
            'id': n.id,
            'name': n.name,
            'is_composite': n.is_composite,
            'circuit_role': n.circuit_role or False,
            'analyst_index': n.analyst_index or False,
            'active': n.active,
            'parent_id': n.parent_id.id if n.parent_id else False,
            'cron_id': n.cron_id.id if n.cron_id else False,
            'cron_name': n.cron_id.cron_name if n.cron_id else False,
            'cron_role': n.cron_role or False,
            'cron_active': n.cron_id.active if n.cron_id else False,
            'cron_domain': n.cron_domain or False,
            'cron_domain_model': n.cron_domain_model or False,
            'cron_trigger_key': n.cron_trigger_key or False,
            'cron_severity': n.cron_severity or False,
            'process_key': n.process_key or False,
            'phase_gate_type': n.phase_gate_type or False,
            'output_binding_model': n.output_binding_model or False,
            'output_binding_field': n.output_binding_field or False,
            'last_execution': (lambda ex: {
                'id': ex.id, 'status': ex.status, 'output_data': ex.output_data, 'error_message': ex.error_message,
            } if ex else False)(
                env['erpv6.core.node.execution'].search([('node_id', '=', n.id)], order='id desc', limit=1)
            ),
        } for n in all_nodes]

        # Fasi reali (erpv6.core.phase) i cui node_ids intersecano questo
        # circuito -- il raggruppamento visivo lato frontend legge questi
        # dati veri invece di ricostruirli a mano da analyst_index/circuit_role.
        phases = env['erpv6.core.phase'].search([('node_ids', 'in', all_nodes.ids)])
        phase_data = [{
            'id': p.id,
            'name': p.name,
            'node_ids': p.node_ids.ids,
            'exit_gate_ids': p.exit_gate_ids.ids,
            'entry_gate_ids': p.entry_gate_ids.ids,
        } for p in phases]

        arcs = env['erpv6.core.arc'].search([
            ('source_node_id', 'in', all_nodes.ids), ('target_node_id', 'in', all_nodes.ids),
        ])
        arc_data = [{
            'id': a.id,
            'source_node_id': a.source_node_id.id,
            'target_node_id': a.target_node_id.id,
            'action_type': a.action_type,
            'is_and_join': a.is_and_join,
            'active': a.active,
            'max_iterations': a.max_iterations,
        } for a in arcs]

        kb_links = env['erpv6.core.kb_link'].search([('target_node_id', 'in', all_nodes.ids)])
        kb_link_data = [{
            'id': k.id,
            'target_node_id': k.target_node_id.id,
            'kb_id': k.kb_id.id if k.kb_id else False,
            'kb_name': k.kb_id.name if k.kb_id else False,
            'data_format': k.data_format,
            'format_mismatch': k.format_mismatch,
        } for k in kb_links]

        # Output/rombi Output (Denis, 29/08/2026: "qualsiasi output finito
        # puo' essere un input da un'altra parte, non per forza sequenziali")
        # -- gli output_links NON si filtrano sul nodo produttore: il nodo
        # che consuma (target_node_id) puo' stare in un altro circuito, e'
        # proprio il punto (come i rombi KB, mai vincolati al circuito).
        outputs = env['erpv6.core.output'].search([('source_node_id', 'in', all_nodes.ids)])
        output_data = [{
            'id': o.id,
            'source_node_id': o.source_node_id.id,
            'output_type': o.output_type,
            'library_category_name': o.library_category_name,
            'name': o.name,
        } for o in outputs]

        output_links = env['erpv6.core.output_link'].search([('target_node_id', 'in', all_nodes.ids)])
        output_link_data = [{
            'id': l.id,
            'target_node_id': l.target_node_id.id,
            'output_id': l.output_id.id,
            'output_name': l.output_id.name,
            'output_type': l.output_id.output_type,
            'source_node_id': l.output_id.source_node_id.id,
            'source_node_name': l.output_id.source_node_id.name,
        } for l in output_links]

        test_fixture_id = False
        if circuit.test_fixture_ref:
            fixture = env.ref(circuit.test_fixture_ref, raise_if_not_found=False)
            if fixture:
                test_fixture_id = fixture.id

        return _json_response({
            'nodes': nodes, 'arcs': arc_data, 'kb_links': kb_link_data, 'phases': phase_data,
            'outputs': output_data, 'output_links': output_link_data,
            'test_fixture_id': test_fixture_id,
        })

    @http.route('/api/core-engine/arc/<int:arc_id>/toggle', type='json', auth='public', methods=['POST'], csrf=False)
    def toggle_arc(self, arc_id, **kwargs):
        arc = request.env(su=True)['erpv6.core.arc'].browse(arc_id)
        if not arc.exists():
            return {'error': 'arco non trovato'}
        arc.active = not arc.active
        return {'id': arc.id, 'active': arc.active}

    @http.route('/api/core-engine/arc/<int:arc_id>/max-iterations', type='json', auth='public', methods=['POST'], csrf=False)
    def set_arc_max_iterations(self, arc_id, max_iterations, **kwargs):
        arc = request.env(su=True)['erpv6.core.arc'].browse(arc_id)
        if not arc.exists():
            return {'error': 'arco non trovato'}
        arc.max_iterations = int(max_iterations)
        return {'id': arc.id, 'max_iterations': arc.max_iterations}

    @http.route('/api/core-engine/node', type='json', auth='public', methods=['POST'], csrf=False)
    def create_node(self, name, parent_id=None, is_composite=False, circuit_role=None,
                     engine_model=None, engine_method=None, process_key=None, phase_gate_type=None, **kwargs):
        """Crea un Nodo/Circuito nuovo -- es. trasformare 'Diagnostica' da
        nodo atomico a Circuito composito: crea qui il nuovo nodo con
        parent_id=Diagnostica, poi is_composite su Diagnostica va messo
        True con update_node.

        process_key (Denis, 29/08/2026: "a lato quando faccio nuovo motore
        devo selezionare o motore IPO o motore AIPO, altrimenti non parto
        la logica") -- va scelto qui in creazione, dall'elenco chiuso
        SAFE_PROCESSES, mai testo libero: senza, il nodo resta un
        contenitore senza logica eseguibile."""
        env = request.env(su=True)
        vals = {'name': name, 'is_composite': bool(is_composite)}
        if parent_id:
            parent = env['erpv6.core.node'].browse(int(parent_id))
            if not parent.exists():
                return {'error': 'circuito contenitore non trovato'}
            vals['parent_id'] = parent.id
        if circuit_role:
            vals['circuit_role'] = circuit_role
        if engine_model:
            vals['engine_model'] = engine_model
        if engine_method:
            vals['engine_method'] = engine_method
        if process_key:
            if process_key not in SAFE_PROCESSES:
                return {'error': 'process_key non riconosciuto (elenco chiuso Motori)'}
            vals['process_key'] = process_key
        if phase_gate_type:
            if phase_gate_type not in ('umano', 'ai'):
                return {'error': "phase_gate_type deve essere 'umano' o 'ai'"}
            vals['phase_gate_type'] = phase_gate_type
        try:
            node = env['erpv6.core.node'].create(vals)
        except Exception as e:
            return {'error': str(e)}
        return {'id': node.id, 'name': node.name, 'parent_id': node.parent_id.id if node.parent_id else False}

    @http.route('/api/core-engine/node/<int:node_id>/update', type='json', auth='public', methods=['POST'], csrf=False)
    def update_node(self, node_id, **vals):
        """Modifica un Nodo esistente -- es. is_composite=True per
        trasformarlo in Circuito dopo avergli aggiunto figli con create_node."""
        env = request.env(su=True)
        node = env['erpv6.core.node'].browse(node_id)
        if not node.exists():
            return {'error': 'nodo non trovato'}
        allowed = {'name', 'is_composite', 'circuit_role', 'engine_model', 'engine_method', 'parent_id', 'active',
                   'process_key', 'phase_gate_type', 'output_binding_model', 'output_binding_field',
                   'output_binding_record_key', 'output_binding_value_path'}
        write_vals = {k: v for k, v in vals.items() if k in allowed}
        if 'parent_id' in write_vals and write_vals['parent_id']:
            write_vals['parent_id'] = int(write_vals['parent_id'])
        try:
            node.write(write_vals)
        except Exception as e:
            return {'error': str(e)}
        return {'id': node.id, 'name': node.name, 'is_composite': node.is_composite,
                'circuit_role': node.circuit_role or False}

    @http.route('/api/core-engine/node/<int:node_id>/delete', type='json', auth='public', methods=['POST'], csrf=False)
    def delete_node(self, node_id, **kwargs):
        """Cancella un Nodo -- cascade su figli (parent_id ondelete=cascade)
        e archi collegati (source/target_node_id ondelete=cascade), gia'
        dichiarato nel modello."""
        node = request.env(su=True)['erpv6.core.node'].browse(node_id)
        if not node.exists():
            return {'error': 'nodo non trovato'}
        node.unlink()
        return {'deleted': True, 'id': node_id}

    @http.route('/api/core-engine/phase', type='json', auth='public', methods=['POST'], csrf=False)
    def create_phase(self, name, node_ids=None, entry_gate_ids=None, exit_gate_ids=None, **kwargs):
        env = request.env(su=True)
        vals = {'name': name, 'node_ids': [(6, 0, [int(i) for i in (node_ids or [])])]}
        if entry_gate_ids:
            vals['entry_gate_ids'] = [(6, 0, [int(i) for i in entry_gate_ids])]
        if exit_gate_ids:
            vals['exit_gate_ids'] = [(6, 0, [int(i) for i in exit_gate_ids])]
        try:
            phase = env['erpv6.core.phase'].create(vals)
        except Exception as e:
            return {'error': str(e)}
        return {'id': phase.id, 'name': phase.name, 'node_ids': phase.node_ids.ids}

    @http.route('/api/core-engine/phase/<int:phase_id>/update', type='json', auth='public', methods=['POST'], csrf=False)
    def update_phase(self, phase_id, name=None, node_ids=None, entry_gate_ids=None, exit_gate_ids=None, **kwargs):
        env = request.env(su=True)
        phase = env['erpv6.core.phase'].browse(phase_id)
        if not phase.exists():
            return {'error': 'fase non trovata'}
        vals = {}
        if name is not None:
            vals['name'] = name
        if node_ids is not None:
            vals['node_ids'] = [(6, 0, [int(i) for i in node_ids])]
        if entry_gate_ids is not None:
            vals['entry_gate_ids'] = [(6, 0, [int(i) for i in entry_gate_ids])]
        if exit_gate_ids is not None:
            vals['exit_gate_ids'] = [(6, 0, [int(i) for i in exit_gate_ids])]
        try:
            phase.write(vals)
        except Exception as e:
            return {'error': str(e)}
        return {'id': phase.id, 'name': phase.name, 'node_ids': phase.node_ids.ids}

    @http.route('/api/core-engine/phase/<int:phase_id>/delete', type='json', auth='public', methods=['POST'], csrf=False)
    def delete_phase(self, phase_id, **kwargs):
        phase = request.env(su=True)['erpv6.core.phase'].browse(phase_id)
        if not phase.exists():
            return {'error': 'fase non trovata'}
        phase.unlink()
        return {'deleted': True, 'id': phase_id}

    @http.route('/api/core-engine/arc', type='json', auth='public', methods=['POST'], csrf=False)
    def create_arc(self, source_node_id, target_node_id, action_type='data_flow', is_and_join=True, **kwargs):
        env = request.env(su=True)
        source = env['erpv6.core.node'].browse(int(source_node_id))
        target = env['erpv6.core.node'].browse(int(target_node_id))
        if not source.exists() or not target.exists():
            return {'error': 'nodo di partenza o arrivo non trovato'}
        arc = env['erpv6.core.arc'].create({
            'source_node_id': source.id,
            'target_node_id': target.id,
            'action_type': action_type,
            'is_and_join': is_and_join,
        })
        return {'id': arc.id, 'source_node_id': source.id, 'target_node_id': target.id,
                'action_type': arc.action_type, 'is_and_join': arc.is_and_join, 'active': arc.active}

    @http.route('/api/core-engine/arc/<int:arc_id>/insert-node', type='json', auth='public', methods=['POST'], csrf=False)
    def insert_node_on_arc(self, arc_id, name, **kwargs):
        arc = request.env(su=True)['erpv6.core.arc'].browse(arc_id)
        if not arc.exists():
            return {'error': 'arco non trovato'}
        try:
            new_node, arc_in, arc_out = arc.insert_node_between(name)
        except Exception as e:
            return {'error': str(e)}
        return {'node_id': new_node.id, 'arc_in_id': arc_in.id, 'arc_out_id': arc_out.id}

    @http.route('/api/core-engine/node/<int:node_id>/run-circuit', type='json', auth='public', methods=['POST'], csrf=False)
    def run_circuit(self, node_id, **kwargs):
        node = request.env(su=True)['erpv6.core.node'].browse(node_id)
        if not node.exists():
            return {'error': 'circuito non trovato'}
        try:
            log = node.run_circuit(kwargs)
        except Exception as e:
            return {'error': str(e)}
        return {'log': log}

    @http.route('/api/core-engine/arc/<int:arc_id>/delete', type='json', auth='public', methods=['POST'], csrf=False)
    def delete_arc(self, arc_id, **kwargs):
        arc = request.env(su=True)['erpv6.core.arc'].browse(arc_id)
        if not arc.exists():
            return {'error': 'arco non trovato'}
        arc.unlink()
        return {'deleted': True, 'id': arc_id}

    @http.route('/api/core-engine/node/<int:node_id>/kb-link', type='json', auth='public', methods=['POST'], csrf=False)
    def set_kb_link(self, node_id, kb_id, **kwargs):
        """Crea o aggiorna il rombo KB (fixed_kb) del nodo -- un nodo ha al
        piu' un pin diretto gestito da qui; resolution_mode=dynamic resta
        editabile solo dal form Odoo, non da questo endpoint del pilota."""
        env = request.env(su=True)
        node = env['erpv6.core.node'].browse(node_id)
        if not node.exists():
            return {'error': 'nodo non trovato'}
        kb = env['erpv6.kb'].browse(int(kb_id))
        if not kb.exists():
            return {'error': 'voce KB non trovata'}
        existing = env['erpv6.core.kb_link'].search([
            ('target_node_id', '=', node_id), ('resolution_mode', '=', 'fixed_kb'),
        ], limit=1)
        vals = {'target_node_id': node_id, 'resolution_mode': 'fixed_kb', 'kb_id': kb.id, 'data_format': 'prompt'}
        link = existing or env['erpv6.core.kb_link']
        if existing:
            existing.write(vals)
        else:
            link = env['erpv6.core.kb_link'].create(vals)
        return {'id': link.id, 'target_node_id': node_id, 'kb_id': kb.id, 'kb_name': kb.name}

    @http.route('/api/core-engine/kb-link/<int:link_id>/delete', type='json', auth='public', methods=['POST'], csrf=False)
    def delete_kb_link(self, link_id, **kwargs):
        link = request.env(su=True)['erpv6.core.kb_link'].browse(link_id)
        if not link.exists():
            return {'error': 'collegamento KB non trovato'}
        link.unlink()
        return {'deleted': True, 'id': link_id}

    @http.route('/api/core-engine/node/<int:node_id>/output', type='json', auth='public', methods=['POST'], csrf=False)
    def create_output(self, node_id, library_category_name=None, output_type='documento', **kwargs):
        """Dichiara che questo nodo produce un Output (rettangolo rosso 'a
        documento') -- referenziabile poi da QUALUNQUE altro nodo come
        input, non solo da chi e' collegato con un arco diretto.
        library_category_name obbligatorio (Denis, 29/08/2026: 'tutti i
        circuiti devono dire che tipo di output generano e l'informazione
        deve viaggiare sempre') -- un Output senza etichetta non e'
        dichiarabile, non solo a livello di modello ma gia' qui."""
        env = request.env(su=True)
        node = env['erpv6.core.node'].browse(node_id)
        if not node.exists():
            return {'error': 'nodo non trovato'}
        if output_type not in dict(TIPO_DATO_VOCABOLARIO):
            return {'error': 'output_type non valido'}
        if not library_category_name or not library_category_name.strip():
            return {'error': "library_category_name obbligatorio -- l'Output deve dichiarare la sua etichetta"}
        output = env['erpv6.core.output'].create({
            'source_node_id': node_id, 'output_type': output_type,
            'library_category_name': library_category_name.strip(),
        })
        return {
            'id': output.id, 'source_node_id': node_id, 'output_type': output.output_type,
            'library_category_name': output.library_category_name, 'name': output.name,
            'category_id': output.category_id.id,
        }

    @http.route('/api/core-engine/output/<int:output_id>/delete', type='json', auth='public', methods=['POST'], csrf=False)
    def delete_output(self, output_id, **kwargs):
        output = request.env(su=True)['erpv6.core.output'].browse(output_id)
        if not output.exists():
            return {'error': 'output non trovato'}
        output.unlink()
        return {'deleted': True, 'id': output_id}

    @http.route('/api/core-engine/outputs', type='http', auth='public', methods=['GET'], csrf=False)
    def outputs_catalog(self, **kwargs):
        """Elenco di TUTTI gli Output dichiarati nel sistema (qualunque
        circuito) -- il frontend costruisce da qui il picker per collegare
        un Output a un nodo consumatore anche fuori dal circuito corrente."""
        env = request.env(su=True)
        outputs = env['erpv6.core.output'].search([], order='id desc')
        return _json_response([{
            'id': o.id, 'name': o.name, 'output_type': o.output_type,
            'source_node_id': o.source_node_id.id, 'source_node_name': o.source_node_id.name,
        } for o in outputs])

    @http.route('/api/core-engine/node/<int:node_id>/output-link', type='json', auth='public', methods=['POST'], csrf=False)
    def create_output_link(self, node_id, output_id, **kwargs):
        """Collega questo nodo (consumatore) all'Output di un altro nodo
        (produttore) -- INDIPENDENTE da un arco diretto tra i due, e'
        proprio il punto (Denis, 29/08/2026: 'non per forza sequenziali')."""
        env = request.env(su=True)
        node = env['erpv6.core.node'].browse(node_id)
        if not node.exists():
            return {'error': 'nodo non trovato'}
        output = env['erpv6.core.output'].browse(int(output_id))
        if not output.exists():
            return {'error': 'output non trovato'}
        link = env['erpv6.core.output_link'].create({'target_node_id': node_id, 'output_id': output.id})
        return {'id': link.id, 'target_node_id': node_id, 'output_id': output.id, 'name': link.name}

    @http.route('/api/core-engine/output-link/<int:link_id>/delete', type='json', auth='public', methods=['POST'], csrf=False)
    def delete_output_link(self, link_id, **kwargs):
        link = request.env(su=True)['erpv6.core.output_link'].browse(link_id)
        if not link.exists():
            return {'error': 'collegamento output non trovato'}
        link.unlink()
        return {'deleted': True, 'id': link_id}

    @http.route('/api/core-engine/kb-catalog', type='http', auth='public', methods=['GET'], csrf=False)
    def kb_catalog(self, **kwargs):
        """Voci KB 'destinate ai sei giudici': stessa categoria (Prompts di
        Sistema, xmlid erpv6_production.kb_category_system_prompts) usata
        dai 6 prompt reali gia' wired in erpv6_production/data/kb_prompt_data.xml
        -- non tutte le voci kb_type='prompt' del sistema, solo quelle di
        questa categoria (verificato: oggi sono esattamente le 7 voci dei 6
        Giudici, nessun rumore)."""
        env = request.env(su=True)
        category = env.ref('erpv6_production.kb_category_system_prompts', raise_if_not_found=False)
        domain = [('kb_type', '=', 'prompt')]
        if category:
            domain.append(('category_id', '=', category.id))
        entries = env['erpv6.kb'].search(domain, order='name')
        return _json_response([{'id': e.id, 'name': e.name} for e in entries])

    @http.route('/api/core-engine/processes', type='http', auth='public', methods=['GET'], csrf=False)
    def processes(self, **kwargs):
        """Elenco chiuso dei Processi che un nodo Motore puo' eseguire --
        stesso spirito di cron-triggers, il frontend costruisce la tendina
        da qui, mai un campo testo."""
        return _json_response([{'key': k, 'label': v['label'], 'family': v['family']} for k, v in SAFE_PROCESSES.items()])

    @http.route('/api/core-engine/node/<int:node_id>/run-process', type='json', auth='public', methods=['POST'], csrf=False)
    def run_process(self, node_id, **input_data):
        node = request.env(su=True)['erpv6.core.node'].browse(node_id)
        if not node.exists():
            return {'error': 'nodo non trovato'}
        try:
            execution = node.run_process(input_data)
        except Exception as e:
            return {'error': str(e)}
        return {'id': execution.id, 'status': execution.status, 'output_data': execution.output_data}

    @http.route('/api/core-engine/cron-triggers', type='http', auth='public', methods=['GET'], csrf=False)
    def cron_triggers(self, **kwargs):
        """Elenco chiuso dei trigger sicuri per Cron di ruolo 'attivazione'
        -- il frontend costruisce la tendina da qui, mai un campo testo."""
        return _json_response([
            {'key': k, 'label': v['label'], 'model': v['model'], 'call_style': v['call_style']}
            for k, v in SAFE_ACTIVATION_TRIGGERS.items()
        ])

    @http.route('/api/core-engine/cron-node', type='json', auth='public', methods=['POST'], csrf=False)
    def create_cron_node(self, **vals):
        """Crea un Nodo Cron + il vero ir.cron collegato (sempre
        active=False, va attivato esplicitamente -- vedi
        erpv6.core.node.create_cron_node/action_activate_cron)."""
        try:
            node = request.env(su=True)['erpv6.core.node'].create_cron_node(vals)
        except Exception as e:
            return {'error': str(e)}
        return {'id': node.id, 'name': node.name, 'cron_id': node.cron_id.id}

    @http.route('/api/core-engine/cron-node/wrap', type='json', auth='public', methods=['POST'], csrf=False)
    def wrap_cron_node(self, **vals):
        """PID che rappresenta un ir.cron GIA' ESISTENTE (Denis, 29/08/2026,
        decomposizione erpv6_kaizen) -- non crea un cron parallelo, si
        limita a collegare quello reale. Vedi erpv6.core.node.
        wrap_existing_cron_node."""
        try:
            node = request.env(su=True)['erpv6.core.node'].wrap_existing_cron_node(vals)
        except Exception as e:
            return {'error': str(e)}
        return {'id': node.id, 'name': node.name, 'cron_id': node.cron_id.id}

    @http.route('/api/core-engine/ir-crons', type='http', auth='public', methods=['GET'], csrf=False)
    def ir_crons_catalog(self, **kwargs):
        """Elenco dei veri ir.cron esistenti nel sistema -- il frontend
        costruisce da qui il picker per un PID 'wrapped', mai testo/id
        libero."""
        env = request.env(su=True)
        crons = env['ir.cron'].sudo().search([], order='cron_name')
        return _json_response([{'id': c.id, 'name': c.cron_name, 'active': c.active} for c in crons])

    @http.route('/api/core-engine/node/<int:node_id>/cron/activate', type='json', auth='public', methods=['POST'], csrf=False)
    def activate_cron(self, node_id, **kwargs):
        node = request.env(su=True)['erpv6.core.node'].browse(node_id)
        if not node.exists():
            return {'error': 'nodo non trovato'}
        try:
            node.action_activate_cron()
        except Exception as e:
            return {'error': str(e)}
        return {'id': node.id, 'cron_active': node.cron_id.active}

    @http.route('/api/core-engine/run-six-judges', type='json', auth='public', methods=['POST'], csrf=False)
    def run_six_judges(self, kb_id, **kwargs):
        # Sincrono: puo' richiedere diversi minuti (round reali con chiamate
        # AI vere, vedi verifica del pilota) -- il chiamante deve gestire
        # un'attesa lunga, non e' un endpoint da chiamare fire-and-forget.
        run = request.env(su=True)['erpv6.core.circuit.run'].run_six_judges_for_kb(int(kb_id))
        return {
            'run_id': run.id,
            'status': run.status,
            'session_id': run.validation_session_id.id,
            'session_status': run.validation_session_id.status,
            'node_runs': [{
                'node_id': nr.node_id.id if nr.node_id else False,
                'analyst_index': nr.node_id.analyst_index if nr.node_id else False,
                'outcome': nr.outcome,
                'is_ai_failure': nr.is_ai_failure,
            } for nr in run.node_run_ids],
        }

    def _serialize_run(self, run):
        return {
            'run_id': run.id,
            'status': run.status,
            'session_id': run.validation_session_id.id,
            'session_status': run.validation_session_id.status,
            'node_runs': [{
                'node_id': nr.node_id.id if nr.node_id else False,
                'analyst_index': nr.node_id.analyst_index if nr.node_id else False,
                'outcome': nr.outcome,
                'is_ai_failure': nr.is_ai_failure,
            } for nr in run.node_run_ids],
        }

    @http.route('/api/core-engine/circuit-run/<int:run_id>/approve', type='json', auth='public', methods=['POST'], csrf=False)
    def approve_gate(self, run_id, **kwargs):
        run = request.env(su=True)['erpv6.core.circuit.run'].browse(run_id)
        if not run.exists():
            return {'error': 'run non trovata'}
        try:
            run.action_approve_gate()
        except Exception as e:
            return {'error': str(e)}
        return self._serialize_run(run)

    @http.route('/api/core-engine/circuit-run/<int:run_id>/reject', type='json', auth='public', methods=['POST'], csrf=False)
    def reject_gate(self, run_id, **kwargs):
        run = request.env(su=True)['erpv6.core.circuit.run'].browse(run_id)
        if not run.exists():
            return {'error': 'run non trovata'}
        try:
            run.action_reject_gate()
        except Exception as e:
            return {'error': str(e)}
        return self._serialize_run(run)

    @http.route('/api/core-engine/giro/<string:giro_id>/status', type='http', auth='public', methods=['GET'], csrf=False)
    def giro_status(self, giro_id, **kwargs):
        """render_mimic minimo, SOLO modalita' Circuito (Denis, 30/08/2026,
        prompt #14, §J.2 addendum): legge erpv6.core.gate.log per giro_id,
        gia' scritto davvero dalla morsettiera (prompt #12) -- nessuna
        modalita' Vetrina/mirror.variable qui, fuori scope. Sola lettura:
        non tocca run_process()/run_circuit()/la morsettiera in nessun modo.

        input_snapshot ESCLUSO di default (puo' contenere dati pesanti o,
        in futuro, sensibili -- §I.5 addendum) -- solo con
        ?include_snapshot=1 esplicito."""
        env = request.env(su=True)
        entries = env['erpv6.core.gate.log'].search(
            [('giro_id', '=', giro_id)], order='timestamp asc, id asc')
        if not entries:
            return _json_response({'error': "giro_id '%s' non trovato" % giro_id}, status=404)

        include_snapshot = kwargs.get('include_snapshot') in ('1', 'true', 'True')
        result = []
        for e in entries:
            row = {
                'id': e.id,
                'gate_id': e.gate_id.id,
                'gate_name': e.gate_id.name,
                'esito': e.esito,
                'timestamp': e.timestamp,
                'tipo_dato': e.tipo_dato or False,
            }
            if include_snapshot:
                row['input_snapshot'] = e.input_snapshot
            result.append(row)
        return _json_response(result)
