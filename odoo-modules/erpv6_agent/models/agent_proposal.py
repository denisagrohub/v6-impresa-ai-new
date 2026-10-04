import json
import logging
from datetime import timedelta

from odoo import _, api, fields, models

_logger = logging.getLogger(__name__)


class Erpv6AgentProposal(models.Model):
    """Proposta generata da un qualunque agente registrato (erpv6.agent.config):
    SEMPRE in attesa di revisione umana, mai auto-applicata -- stesso
    principio del gate umano gia' seguito ovunque in questo progetto
    (validazione 6 Giudici, README auto-fix mai costruito: 'il merge lo fai
    sempre tu'). Generalizzato da erpv6.kaizen.ai_proposal (erpv6_kaizen,
    primo agente reale) il 20/08/2026."""
    _name = 'erpv6.agent.proposal'
    _description = 'Proposta Agente AI'
    _inherit = ['mail.thread', 'mail.activity.mixin']
    _order = 'create_date desc'

    # ondelete='cascade': cancellare un agente deve cancellare tutto cio'
    # che gli appartiene -- segnalato dal vivo dall'utente il 20/08/2026
    # ("cancello l'agente si cancella tutto"). Senza questo, required=True
    # senza ondelete esplicito avrebbe fatto fallire la cancellazione
    # dell'agente con un errore di integrita' referenziale appena esisteva
    # anche una sola proposta.
    agent_config_id = fields.Many2one('erpv6.agent.config', string='Agente', required=True, index=True, ondelete='cascade')
    name = fields.Char(string='Titolo', required=True, tracking=True)
    proposal_text = fields.Text(string='Proposta', required=True, tracking=True)
    based_on = fields.Text(string='Basata su', help="Riepilogo dei dati usati per generare la proposta.")
    rule_applied = fields.Char(string='Regola applicata', help="Riferimento alla voce KB di istruzioni citata dall'AI.")
    provider_name = fields.Char(string='Provider AI', readonly=True)
    # Aggiunti il 24/08/2026 per la catena Kaizen -> Claudio -> Argus
    # (piano "Claudio+Argus", riconciliato con l'architettura esistente:
    # niente formato di relazione a parte, il testo integrale verificato
    # vive qui come documento, la sintesi/instradamento resta su
    # erpv6.agent.communication). technical_report_id per il caso lungo
    # (comandi eseguiti, output reale, non solo la sintesi in proposal_text);
    # parent_proposal_id per incatenare una proposta alla precedente che sta
    # verificando/correggendo/controllando.
    technical_report_id = fields.Many2one(
        'erpv6.library.document', string='Relazione Tecnica Completa',
        help="Documento (categoria 'agent_knowledge') con la relazione tecnica integrale: "
             "cosa verificato (file:riga, comando, output reale), cosa concluso e perche', "
             "cosa proposto. Opzionale: solo per proposte con verifica lunga/dettagliata, "
             "la sintesi resta comunque in proposal_text/based_on.")
    parent_proposal_id = fields.Many2one(
        'erpv6.agent.proposal', string='Proposta precedente nella catena', ondelete='set null',
        help="Collega la proposta di verifica/correzione (es. Claudio) a quella originale "
             "che sta controllando (es. Kaizen), o quella di verifica finale (es. Argus) a "
             "quella applicata che sta controllando.")
    child_proposal_ids = fields.One2many('erpv6.agent.proposal', 'parent_proposal_id', string='Proposte successive nella catena')
    status = fields.Selection([
        ('pending_review', 'In attesa di revisione'),
        ('accepted', 'Accettata'),
        ('rejected', 'Rifiutata'),
        ('actioned', 'Attuata manualmente'),
        # 04/10/2026 (C5-gate-2a): stati del ciclo L1/L2.
        ('rejected_incomplete', 'Rifiutata: forma incompleta (L1)'),
        ('rejected_by_argus', 'Rifiutata: Argus (L2)'),
        ('rejected_max_attempts', 'Rifiutata: troppi tentativi'),
        # 04/10/2026 (C5-gate-2b-legacy): proposte create prima del
        # formato strutturato (L1). Fuori dal ciclo di validazione.
        ('legacy_no_structured', 'Legacy (senza formato strutturato)'),
    ], string='Stato', default='pending_review', required=True, tracking=True)
    reviewer_id = fields.Many2one('res.users', string='Revisionata da', tracking=True)
    reviewed_at = fields.Datetime(string='Revisionata il', tracking=True)
    review_notes = fields.Text(string='Note del revisore')

    # 04/10/2026 (C5-gate-2a): formato strutturato + ciclo L1/L2.
    structured_data = fields.Text(
        string='Dati strutturati (JSON)',
        help='Payload JSON con schema fisso (title, problem, '
             'proposed_change, files_affected, impact, effort, '
             'risk, test_plan, rationale, target_agent). '
             'Se presente, il validatore L1 lo controlla.',
    )

    revision_attempts = fields.Integer(
        string='Tentativi revisione',
        default=0,
        readonly=True,
        help='Contatore cicli L2 (weak→reformula). Cap a 2.',
    )

    target_agent = fields.Selection([
        ('claudio', 'Claudio'),
        ('alessandro', 'Alessandro'),
        ('auto', 'Auto (router per tipo file)'),
    ], string='Agente target', default='auto', required=True)

    review_verdict = fields.Selection([
        ('pending', 'In attesa'),
        ('ok', 'OK'),
        ('weak', 'Weak — torna al proponente'),
        ('reject', 'Rifiutata'),
        ('skipped', 'Saltata (self)'),
    ], string='Verdetto Argus', default='pending')

    review_notes_json = fields.Text(
        string='Note revisione (JSON)',
        help='Motivazioni e suggerimenti da Argus revisore.',
    )

    # ─── Schema validazione L1 ───
    SCHEMA_REQUIRED = (
        'title', 'problem', 'proposed_change',
        'files_affected', 'impact', 'effort', 'risk',
        'test_plan', 'rationale', 'target_agent',
    )

    SCHEMA_MIN_LENGTH = {
        'title': 10,
        'problem': 50,
        'proposed_change': 50,
        'risk': 20,
        'test_plan': 30,
        'rationale': 30,
    }

    SCHEMA_ENUMS = {
        'impact': ('low', 'medium', 'high'),
        'target_agent': ('claudio', 'alessandro', 'auto'),
    }

    def _validate_structure(self):
        """Valida structured_data contro lo schema fisso.

        Ritorna: (ok: bool, reasons: list[str])
        """
        self.ensure_one()
        if not self.structured_data:
            return False, ['structured_data mancante']

        try:
            data = json.loads(self.structured_data)
        except (json.JSONDecodeError, TypeError) as e:
            return False, ['JSON non valido: %s' % e]

        reasons = []

        # Campi obbligatori
        for field in self.SCHEMA_REQUIRED:
            if field not in data:
                reasons.append('campo mancante: %s' % field)

        if reasons:
            return False, reasons

        # Lunghezze minime
        for field, min_len in self.SCHEMA_MIN_LENGTH.items():
            value = data.get(field, '')
            if not isinstance(value, str) or len(value) < min_len:
                reasons.append(
                    '%s troppo corto (min %d char)' % (field, min_len))

        # Enum
        for field, allowed in self.SCHEMA_ENUMS.items():
            value = data.get(field)
            if value not in allowed:
                reasons.append(
                    '%s non valido: %s (atteso uno di %s)'
                    % (field, value, allowed))

        # files_affected deve essere lista non vuota di stringhe
        files = data.get('files_affected', [])
        if not isinstance(files, list) or not files:
            reasons.append('files_affected deve essere lista non vuota')
        else:
            for f in files:
                if not isinstance(f, str):
                    reasons.append(
                        'files_affected contiene non-stringa: %r' % f)

        return len(reasons) == 0, reasons

    def action_validate_l1(self):
        """Applica validazione L1. Cambia stato a rejected_incomplete
        se fallisce. Non e' un hook: invocabile manualmente."""
        self.ensure_one()
        ok, reasons = self._validate_structure()
        if not ok:
            self.write({
                'status': 'rejected_incomplete',
                'review_notes_json': json.dumps(
                    {'reasons': reasons, 'source': 'L1'},
                    ensure_ascii=False),
            })
        return ok

    # ─── C5-gate-2b: Argus revisore (L2) + loop correzione ───

    _ARGUS_REVIEW_PROMPT_FALLBACK = (
        "Sei Argus, revisore di proposte di miglioramento V6.\n\n"
        "Ricevi una proposta strutturata in JSON. Valuta:\n\n"
        "  1. Il PROBLEMA e' reale, concreto, verificabile?\n"
        "  2. La SOLUZIONE e' chiara, attuabile, specifica?\n"
        "  3. Il TARGET_AGENT e' coerente con i file toccati?\n"
        "  4. L'EFFORT e' realistico?\n"
        "  5. Il TEST_PLAN e' verificabile passo-passo?\n"
        "  6. Il RISK e' dichiarato onestamente?\n\n"
        "Output JSON (nessun altro testo):\n"
        "{\n"
        '  "verdict": "ok" | "weak" | "reject",\n'
        '  "reasons": ["motivo 1", ...],\n'
        '  "suggestions": ["cosa migliorare 1", ...]\n'
        "}\n\n"
        "ok = passa a Denis\n"
        "weak = torna al proponente con motivi (max 2 giri)\n"
        "reject = rifiutata definitivamente"
    )

    def _get_argus_review_prompt(self):
        """Legge il prompt di revisione da KB se configurato su
        agent_config(code=argus).review_prompt_kb_id, altrimenti
        fallback hardcoded."""
        try:
            argus = self.env['erpv6.agent.config'].sudo().search([
                ('code', '=', 'argus')], limit=1)
            if argus and argus.review_prompt_kb_id:
                content = argus.review_prompt_kb_id.content or ''
                if content.strip():
                    return content
        except Exception:  # pylint: disable=broad-except
            _logger.warning(
                'Lettura KB review_prompt fallita, uso fallback')
        return self._ARGUS_REVIEW_PROMPT_FALLBACK

    def _argus_review(self):
        """Argus valuta la proposta. Salta se proposta di Argus
        (self-review vietato).
        Ritorna dict {verdict, reasons, suggestions}."""
        self.ensure_one()

        if self.agent_config_id and self.agent_config_id.code == 'argus':
            return {
                'verdict': 'skipped',
                'reasons': ['self-review vietato'],
                'suggestions': [],
            }

        payload_proposal = {}
        if self.structured_data:
            try:
                payload_proposal = json.loads(self.structured_data)
            except (json.JSONDecodeError, TypeError):
                payload_proposal = {'_raw': self.structured_data}

        user_content = (
            "PROPOSTA DA REVISIONARE:\n"
            + json.dumps(payload_proposal, ensure_ascii=False, indent=2)
        )

        try:
            result = self.env['erpv6.omni.bridge'].sudo().execute_ai_task(
                task_type='proposal_review',
                payload={
                    'temperature': 0.2,
                    'messages': [
                        {'role': 'system', 'content': self._get_argus_review_prompt()},
                        {'role': 'user', 'content': user_content},
                    ],
                },
                context={'source': 'erpv6_agent:_argus_review',
                         'proposal_id': self.id},
            )
        except Exception as e:
            _logger.warning('Argus review failed %s: %s', self.id, e)
            return {
                'verdict': 'reject',
                'reasons': ['errore Argus: %s' % e],
                'suggestions': [],
            }

        if not result.get('success'):
            return {
                'verdict': 'reject',
                'reasons': ['AI call failed: %s' % result.get('error', '')],
                'suggestions': [],
            }

        try:
            raw = result['data']['choices'][0]['message']['content']
        except (KeyError, IndexError, TypeError) as e:
            return {
                'verdict': 'reject',
                'reasons': ['output AI inatteso: %s' % e],
                'suggestions': [],
            }

        # Pulisci eventuale markdown fence
        raw_clean = raw.strip()
        if raw_clean.startswith('```'):
            # Rimuovi prima riga ```json e ultima ```
            lines = raw_clean.split('\n')
            if lines[0].startswith('```'):
                lines = lines[1:]
            if lines and lines[-1].strip() == '```':
                lines = lines[:-1]
            raw_clean = '\n'.join(lines).strip()

        try:
            parsed = json.loads(raw_clean)
        except json.JSONDecodeError:
            _logger.warning(
                'Argus review parse fail %s: %s', self.id, raw_clean[:200])
            return {
                'verdict': 'reject',
                'reasons': ['output non parsabile (JSON malformato)'],
                'suggestions': [],
            }

        verdict = parsed.get('verdict', 'reject')
        if verdict not in ('ok', 'weak', 'reject'):
            verdict = 'reject'
        return {
            'verdict': verdict,
            'reasons': parsed.get('reasons', []) or [],
            'suggestions': parsed.get('suggestions', []) or [],
        }

    def _request_reformulation(self, review):
        """Chiama il proponente per riformulare la proposta (weak).
        Ritorna True se la riformulazione e' avvenuta e JSON valido."""
        self.ensure_one()
        if not self.agent_config_id:
            return False

        task_type = '%s_agent_propose' % self.agent_config_id.code

        reform_prompt = (
            "La tua proposta precedente e' stata valutata 'weak' da Argus.\n\n"
            "Motivi:\n"
            + '\n'.join('- %s' % r for r in review.get('reasons', []))
            + "\n\nSuggerimenti:\n"
            + '\n'.join('- %s' % s for s in review.get('suggestions', []))
            + "\n\nProposta originale (JSON):\n%s\n\n"
            "Riformula la proposta mantenendo ESATTAMENTE lo stesso "
            "schema JSON (title, problem, proposed_change, files_affected, "
            "impact, effort, risk, test_plan, rationale, target_agent). "
            "Rispondi SOLO con il JSON, nessun altro testo."
        ) % (self.structured_data or '{}')

        try:
            result = self.env['erpv6.omni.bridge'].sudo().execute_ai_task(
                task_type=task_type,
                payload={
                    'temperature': 0.3,
                    'messages': [
                        {'role': 'user', 'content': reform_prompt},
                    ],
                },
                context={'source': 'erpv6_agent:_request_reformulation',
                         'proposal_id': self.id},
            )
        except Exception as e:
            _logger.warning('Reformulation failed %s: %s', self.id, e)
            return False

        if not result.get('success'):
            return False

        try:
            raw = result['data']['choices'][0]['message']['content']
        except (KeyError, IndexError, TypeError):
            return False

        raw_clean = raw.strip()
        if raw_clean.startswith('```'):
            lines = raw_clean.split('\n')
            if lines[0].startswith('```'):
                lines = lines[1:]
            if lines and lines[-1].strip() == '```':
                lines = lines[:-1]
            raw_clean = '\n'.join(lines).strip()

        try:
            json.loads(raw_clean)
        except json.JSONDecodeError:
            _logger.warning(
                'Reformulation output non JSON %s', self.id)
            return False

        self.write({'structured_data': raw_clean})
        return True

    def action_process_review(self):
        """Orchestra L1 + L2 + loop correzione (max 2 tentativi).
        Ritorna il verdict finale (stringa)."""
        self.ensure_one()
        MAX_ATTEMPTS = 2

        # ── L1 ──
        if not self.action_validate_l1():
            return 'rejected_incomplete'

        # ── L2 + loop ──
        while self.revision_attempts < MAX_ATTEMPTS:
            review = self._argus_review()
            verdict = review.get('verdict')

            self.write({
                'review_verdict': verdict if verdict in (
                    'ok', 'weak', 'reject', 'skipped') else 'pending',
                'review_notes_json': json.dumps(review, ensure_ascii=False),
            })

            if verdict == 'ok':
                return 'ok'

            if verdict == 'skipped':
                # self-review (Argus) → passa a Denis senza L2
                return 'ok'

            if verdict == 'reject':
                self.write({'status': 'rejected_by_argus'})
                return 'rejected_by_argus'

            if verdict == 'weak':
                self.write({
                    'revision_attempts': self.revision_attempts + 1,
                })
                if self.revision_attempts >= MAX_ATTEMPTS:
                    self.write({'status': 'rejected_max_attempts'})
                    return 'rejected_max_attempts'

                if not self._request_reformulation(review):
                    self.write({'status': 'rejected_by_argus'})
                    return 'rejected_by_argus'

                # Ricicla L1 sulla nuova structured_data
                if not self.action_validate_l1():
                    return 'rejected_incomplete'
            else:
                # verdict inatteso
                self.write({'status': 'rejected_by_argus'})
                return 'rejected_by_argus'

        self.write({'status': 'rejected_max_attempts'})
        return 'rejected_max_attempts'

    def write(self, vals):
        """Bug reale trovato il 24/08/2026 (proposta #18 di Kaizen,
        approvata da Denis nell'interfaccia Odoo, MAI arrivata a Claudio):
        la catena automatica verso Claudio viveva SOLO dentro il gestore
        dei bottoni Telegram (_handle_proposal_decision), non
        nell'accettazione vera e propria -- quindi approvare da Odoo
        (wizard _do_accept) o da qualunque altra via futura non la faceva
        mai scattare. Spostata qui, a livello di modello: qualunque
        scrittura che porta status a 'accepted' la fa scattare, sempre,
        indipendentemente da chi/come ha approvato."""
        was_pending = {p.id: p.status for p in self} if 'status' in vals else {}
        result = super().write(vals)
        if vals.get('status') == 'accepted':
            for proposal in self:
                if was_pending.get(proposal.id) == 'accepted':
                    continue  # gia' accettata prima di questa write, non ricatenare
                proposal._chain_to_next_agent_if_needed()
        return result

    def _next_chain_agent_code(self):
        """Codice dell'agente che si occupera' DAVVERO di questa proposta
        una volta approvata -- UNA sola funzione, usata sia da
        _chain_to_next_agent_if_needed (per decidere a chi incatenare) sia
        da erpv6.agent.telegram.config._handle_proposal_decision (per dire
        a Denis chi se ne occupa), cosi' le due cose non possono
        disallinearsi. Fattorizzata il 25/08/2026 dopo aver trovato dal
        vivo un bug reale in _handle_proposal_decision: il messaggio di
        conferma diceva il nome del CANALE Telegram che aveva approvato
        (es. 'Susanna', che puo' approvare proposte di chiunque) invece
        del nome dell'agente che avrebbe davvero applicato la modifica.

        Caso normale (invariato dal 24/08/2026): il prossimo agente e'
        Claudio. Claudio e Alessandro stessi sono agenti TERMINALI (nessun
        ulteriore incatenamento, se ne occupano loro).

        Caso escalation Alessandro (25/08/2026, design concordato con
        Denis la sera del 24/08/2026, vedi memoria
        project_alessandro_agent_design.md): SE questa proposta appartiene
        a Kaizen E il suo parent_proposal_id appartiene a Claudio,
        significa che e' la proposta di escalation creata da
        erpv6.kaizen.detected_signal._maybe_escalate_to_alessandro quando
        una proposta di Claudio resta bloccata (mai 'actioned') --
        approvarla NON deve rimandare la stessa richiesta a Claudio (si
        bloccherebbe di nuovo per lo stesso motivo, rischio di loop
        silenzioso): il prossimo agente e' invece Alessandro, che ha
        strumenti piu' ampi (ricerca nel codice/nel grafo, azioni non-diff)
        per i casi troppo astratti per un diff su un file nominato."""
        self.ensure_one()
        if self.agent_config_id.code in ('claudio', 'alessandro'):
            return self.agent_config_id.code
        if self.agent_config_id.code == 'kaizen' and self.parent_proposal_id.agent_config_id.code == 'claudio':
            return 'alessandro'
        return 'claudio'

    def _chain_to_next_agent_if_needed(self):
        """Crea (se non esiste gia') una proposta di verifica/applicazione
        per il prossimo agente della catena (vedi _next_chain_agent_code),
        incatenata e gia' accettata, per QUALUNQUE proposta approvata che
        non sia gia' di un agente terminale (Claudio o Alessandro) -- cosi'
        il ciclo automatico (watch_proposals.py, che guarda le proposte
        accettate di Claudio E Alessandro) la trova al giro successivo
        senza altro intervento umano oltre all'approvazione originale.
        Generalizzata il 25/08/2026 da _chain_to_claudio_if_needed per
        includere Alessandro (vedi _next_chain_agent_code per il caso
        escalation)."""
        self.ensure_one()
        if self.agent_config_id.code in ('claudio', 'alessandro'):
            return
        next_code = self._next_chain_agent_code()
        if self.child_proposal_ids.filtered(lambda c: c.agent_config_id.code == next_code):
            return  # gia' incatenata (es. scritta da _handle_proposal_decision in passato)
        next_agent = self.env['erpv6.agent.config'].sudo().search([('code', '=', next_code)], limit=1)
        if not next_agent:
            return
        reviewer = self.reviewer_id or self.env.ref('base.user_admin', raise_if_not_found=False) or self.env.user
        if next_code == 'alessandro':
            proposal_text = _(
                "Denis ha confermato: Claudio non ce l'ha fatta su questa proposta (rimasta "
                "bloccata, mai attuata). Prova tu -- hai strumenti piu' ampi di Claudio: ricerca "
                "nel codice/nel grafo Neo4j per capire DOVE intervenire, ed eventualmente un'azione "
                "non-diff (voce KB, configurazione) se il fix non e' letteralmente un file da "
                "editare. %(text)s"
            ) % {'text': self.proposal_text}
        else:
            proposal_text = _(
                "Denis ha approvato questa proposta di %(agent)s: %(text)s\n\n"
                "Verifica sul codice reale se e come applicarla correttamente, poi applicala davvero."
            ) % {'agent': self.agent_config_id.name, 'text': self.proposal_text}
        self.env['erpv6.agent.proposal'].sudo().create({
            'agent_config_id': next_agent.id,
            'name': _("Verifica e applica: %s") % self.name,
            'proposal_text': proposal_text,
            'parent_proposal_id': self.id,
            'status': 'accepted',
            'reviewer_id': reviewer.id,
            'reviewed_at': fields.Datetime.now(),
        })

    def action_accept(self):
        """Apre il popup di assegnazione invece di accettare direttamente:
        "chi accetta" (fa il gate umano) non e' detto sia "chi esegue" il
        lavoro -- segnalato dal vivo dall'utente il 20/08/2026, vanno scelti
        separatamente. La vera accettazione avviene in _do_accept, chiamata
        dal wizard dopo la scelta dell'assegnatario."""
        self.ensure_one()
        return {
            'type': 'ir.actions.act_window',
            'name': _("Assegna ed accetta"),
            'res_model': 'erpv6.agent.proposal.accept_wizard',
            'view_mode': 'form',
            'target': 'new',
            'context': {'default_proposal_id': self.id},
        }

    def _do_accept(self, assignee):
        """'Accetta' non deve restare un semplice cambio di stato --
        segnalato dal vivo dall'utente il 20/08/2026 ("mi aspettavo piu' di
        un click"): crea SEMPRE un'attivita' To-Do vera assegnata a chi
        esegue davvero (non per forza chi ha accettato), con la proposta
        come nota, PIU' una notifica diretta ("deve apparire un allarme
        popup che dice chi deve fare il lavoro") cosi' l'assegnatario la
        vede subito. Resta comunque un gate umano: non esegue la proposta
        da sola (nessuna scrittura su modelli/schema), solo la trasforma in
        un compito da fare."""
        self.ensure_one()
        self.write({'status': 'accepted', 'reviewer_id': self.env.user.id, 'reviewed_at': fields.Datetime.now()})
        self.activity_schedule(
            'mail.mail_activity_data_todo',
            summary=_("Attuare proposta: %s") % self.name,
            note=self.proposal_text,
            user_id=assignee.id,
            date_deadline=fields.Date.context_today(self) + timedelta(days=3),
        )
        self._notify_assignee(assignee)

    def _notify_assignee(self, assignee):
        """Notifica l'assegnatario via message_notify."""
        self.ensure_one()
        if assignee.partner_id:
            # email_from esplicito: senza, message_notify finirebbe con
            # mittente "OdooBot <odoobot@example.com>" invece del mittente
            # aziendale -- stesso fix gia' applicato piu' volte stanotte
            # (digest, certificato).
            default_from = self.env['ir.config_parameter'].sudo().get_param('mail.default.from')
            notify_kwargs = {}
            if default_from:
                notify_kwargs['email_from'] = '"%s" <%s>' % (self.env.company.name, default_from)
            self.message_notify(
                partner_ids=assignee.partner_id.ids,
                subject=_("Lavoro assegnato: %s") % self.name,
                body=_("%(reviewer)s ti ha assegnato questo lavoro (proposta accettata):\n\n%(text)s") % {
                    'reviewer': self.env.user.name, 'text': self.proposal_text},
                **notify_kwargs,
            )

    def action_reject(self):
        for proposal in self:
            proposal.write({
                'status': 'rejected', 'reviewer_id': self.env.user.id, 'reviewed_at': fields.Datetime.now(),
            })

    def action_mark_actioned(self):
        for proposal in self:
            proposal.write({
                'status': 'actioned', 'reviewer_id': self.env.user.id, 'reviewed_at': fields.Datetime.now(),
            })

    @api.model
    def _cron_process_pending_reviews(self):
        """04/10/2026 (C5-gate-2c-1): processa fino a N pending_review
        per run applicando L1+L2. Solo proposte CON structured_data
        (le legacy sono escluse). Ritorna il numero processate."""
        MAX_PER_RUN = 5
        pending = self.search([
            ('status', '=', 'pending_review'),
            ('structured_data', '!=', False),
        ], limit=MAX_PER_RUN, order='id asc')

        processed = 0
        for p in pending:
            try:
                p.action_process_review()
                processed += 1
            except Exception as e:  # pylint: disable=broad-except
                _logger.warning('Cron review fail #%s: %s', p.id, e)
        return processed
