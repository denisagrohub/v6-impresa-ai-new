import json
import logging

from odoo import _, api, fields, models
from odoo.exceptions import UserError

_logger = logging.getLogger(__name__)


class Erpv6ValidationSessionWinwinGate(models.Model):
    """Estende erpv6.validation.session (motore generico 5 analisti + Sesto
    Uomo) SOLO per far leggere all'analista un prompt diverso da quello di
    default quando la sessione e' il Gate 3B del circuito
    erpv6_winwin_renderdata - stesso pattern di override gia' usato da
    erpv6_production/models/validation_session.py per le voci KB, mai un
    secondo motore di validazione."""
    _inherit = 'erpv6.validation.session'

    winwin_gate_candidate = fields.Json(
        string='Candidato Win-Win da verificare',
        help="Il testo/JSON gia' generato da _run_metodo_ai('winwin') che questa sessione deve "
             "verificare (fact-check contro i dati reali), non rigenerare da zero.")

    def _get_analyst_prompt_template(self, analyst_idx=None):
        """Quando la sessione porta un candidato Win-Win da verificare, gli
        analisti non producono una nuova analisi libera (schema 'findings'
        generico) ma fanno fact-checking del candidato GIA' generato contro
        i dati reali - risposta comunque nello schema generico
        findings/claims_checked/flagged_missing_data richiesto dal motore
        (_run_round, erpv6_validation, hardcoded su queste chiavi): qui
        'findings' e' il verdetto del fact-check, non un'analisi da zero."""
        if self.winwin_gate_candidate:
            # _run_round() (erpv6_validation) chiama .format(destinatario=,
            # scopo=, context_json=) sul template ritornato qui - QUALUNQUE
            # altra graffa nel template (es. dal JSON del candidato
            # incorporato sotto) verrebbe interpretata da .format() come un
            # placeholder e farebbe KeyError (bug reale trovato in test: il
            # candidato conteneva {"azioni_winwin": ...} e .format() cercava
            # una chiave letterale '"azioni_winwin"'). Le graffe del JSON
            # vanno quindi raddoppiate PRIMA di entrare nel template, cosi'
            # .format() le tratta come letterali.
            candidate_json_escaped = json.dumps(
                self.winwin_gate_candidate, ensure_ascii=False
            ).replace('{', '{{').replace('}', '}}')
            template = (
                "Hai ricevuto un elenco di azioni win-win GIA' PROPOSTO da un altro motore per "
                "questa azienda, e i dati reali su cui dovrebbe basarsi. Il tuo compito e' "
                "verificarlo, non crearne uno nuovo.\n\n"
                "Destinatario finale: {destinatario}.\nScopo: {scopo}.\n"
                "Dati reali disponibili (unica fonte ammessa): {context_json}.\n\n"
                "Candidato da verificare:\n" + candidate_json_escaped + "\n\n"
                "REGOLA VINCOLANTE ANTI-ALLUCINAZIONE: per ogni azione proposta nel candidato, verifica "
                "se 'basata_su' cita davvero un dato presente nei dati reali sopra. Se un'azione si "
                "appoggia a un fatto NON presente nei dati reali, e' un'allucinazione: segnalala "
                "esplicitamente. Non inventare tu nuovi fatti per giustificarla.\n\n"
                "Rispondi SOLO con un oggetto JSON valido, senza markdown code fence, con questi campi "
                "esatti:\n"
                '{{"findings": "il tuo verdetto testuale: quali azioni sono ben ancorate ai dati reali, '
                'quali no e perche\'", "claims_checked": [{{"claim": "...", "source_verified": true/false, '
                '"note": "..."}}], "flagged_missing_data": "testo, vuoto se il candidato non ha problemi"}}'
            )
            return template, _("Gate 3B circuito Win-Win RenderData (fact-check candidato)")
        return super()._get_analyst_prompt_template(analyst_idx=analyst_idx)


class Erpv6ProductionOrderGates(models.Model):
    _inherit = 'erpv6.production.order'

    def _winwin_gate_3a_claims_checked(self, render_data):
        """Gate leggero (Fase 3A): diagnosi/criticita'/azioni_urgenti sono
        gia' deterministiche (calcolate dal Motore da dati raccolti in
        intervista, mai generative - vedi aeosv6_dispatch.py) - non serve
        il ciclo pesante 5 analisti + Sesto Uomo, sarebbe uno spreco di
        tempo/budget AI su un controllo gia' garantito a monte dal Motore
        stesso. L'unico controllo sensato qui e' strutturale: ogni voce
        deve avere una 'fonte' tracciabile. Se un'estensione futura del
        Motore ne aggiungesse una senza, questo gate la scarta invece di
        lasciarla passare senza controllo (mai un bypass silenzioso)."""
        self.ensure_one()
        dropped = []

        def _check_list(items, label):
            kept = []
            for item in items:
                if item.get('fonte'):
                    kept.append(item)
                else:
                    dropped.append('%s: %s' % (label, item.get('titolo', '?')))
            return kept

        checked = dict(render_data)
        checked['criticita'] = _check_list(render_data.get('criticita', []), 'criticita')
        checked['azioni_urgenti'] = _check_list(render_data.get('azioni_urgenti', []), 'azioni_urgenti')
        metriche = render_data.get('diagnosi', {}).get('metriche', {})
        kept_metriche = {}
        for key, metrica in metriche.items():
            if metrica.get('fonte'):
                kept_metriche[key] = metrica
            else:
                dropped.append('diagnosi.metriche.%s' % key)
        checked['diagnosi'] = {'metriche': kept_metriche}
        checked['gate_3a_dropped'] = dropped
        if dropped:
            self.message_post(body=_(
                "Gate 3A (claims_checked): %(n)d elemento/i scartato/i dal render_data per "
                "mancanza di fonte tracciabile: %(list)s"
            ) % {'n': len(dropped), 'list': ', '.join(dropped)})
        return checked

    def _winwin_gate_3b_azioni_winwin(self):
        """Gate pesante (Fase 3B): le azioni win-win sono generative (AI
        libera sul contesto reale dell'intervista, mai deterministiche) -
        vanno SEMPRE per il ciclo completo 5 analisti + Sesto Uomo, nessuna
        eccezione per velocita'. Genera il candidato con lo stesso motore
        gia' esistente (_run_metodo_ai-equivalente: stessa KB, stessa
        chiamata AI, stesso parsing - duplicato qui SOLO nella parte
        "chiama e fai il parsing", perche' _run_metodo_ai salva subito un
        erpv6.library.document permanente, cosa che non ha senso fare PRIMA
        che il gate abbia verificato il contenuto - vedi nota nel report
        finale) poi lo fa verificare (fact-check, non rigenerare) dai 5
        analisti + Sesto Uomo via erpv6.validation.session.

        Ritorna (azioni_winwin_o_None, session): azioni_winwin e' None se
        la sessione e' finita in escalation umana (nessun bypass: quella
        sezione resta assente dal render_data finale, notificata per
        revisione umana, come da principio 'FASE' del circuito su dati/
        contenuti bloccanti)."""
        self.ensure_one()
        config = self._METODO_CONFIG['winwin']
        kb = self.env.ref(config['kb_xmlid'], raise_if_not_found=False)
        kb = kb.sudo() if kb else kb
        if not kb or not kb.content:
            raise UserError(_("Prompt del metodo Win-Win non configurato (voce KB mancante)."))

        context_data = self._build_metodo_context_data()
        result = self.env['erpv6.omni.bridge'].execute_ai_task(
            task_type=config['omni_task_type'],
            payload={
                'temperature': 0.3,
                'messages': [
                    {'role': 'system', 'content': kb.content},
                    {'role': 'user', 'content': _(
                        "Dati reali raccolti su questa azienda/produzione (nessun altro dato "
                        "esiste oltre a questi):\n%s"
                    ) % json.dumps(context_data, ensure_ascii=False, indent=2)},
                ],
            },
            context={'source': 'erpv6_winwin_renderdata:_winwin_gate_3b_azioni_winwin', 'order_id': self.id},
        )
        if not result.get('success'):
            raise UserError(_("Generazione candidato Win-Win fallita: %s") % (result.get('error') or _('errore sconosciuto')))
        try:
            ai_content = result['data']['choices'][0]['message']['content']
        except (KeyError, IndexError, TypeError):
            raise UserError(_("Risposta AI in formato inatteso per il candidato Win-Win."))
        candidate = self._parse_metodo_ai_json(ai_content)
        if not candidate or not candidate.get('azioni_winwin'):
            raise UserError(_("Il candidato Win-Win generato non contiene azioni valide (JSON vuoto o malformato)."))

        session = self.env['erpv6.validation.session'].sudo().create({
            'res_model': self._name,
            'res_id': self.id,
            'destinatario': 'Il cliente finale (relazione Win-Win)',
            'scopo': "Verificare che le azioni win-win proposte siano realmente ancorate ai dati "
                     "reali dell'intervista di questa azienda, prima di consegnarle al cliente.",
            'context_data': context_data,
            'validation_mode': 'full_six_judges',
            'winwin_gate_candidate': candidate,
        })
        session.action_start_validation()

        if session.status == 'converged':
            self.message_post(body=_(
                "Gate 3B (azioni win-win): candidato verificato e approvato dopo %(n)d round "
                "(nessuna allucinazione rilevata dai 5 analisti)."
            ) % {'n': len(session.round_ids)})
            return candidate['azioni_winwin'], session
        # escalated_to_human: nessun bypass, la sezione resta assente dal
        # render_data finale - stesso principio 'FASE' del prompt originale
        # per i dati bloccanti mancanti.
        self.message_post(body=_(
            "Gate 3B (azioni win-win): candidato NON approvato dopo %(n)d round (escalation umana, "
            "sessione di validazione #%(sid)s) - sezione azioni win-win assente dal render_data "
            "finché non revisionata a mano."
        ) % {'n': len(session.round_ids), 'sid': session.id})
        return None, session

    def _winwin_build_raccomandazione(self, checked, azioni_winwin, etichetta_quadrante):
        """Prompt 'Roadmap + Raccomandazione' (06/09/2026): assembla un
        template a slot letto da KB (kb_link con categoria 'Frasi Raccomandazione (Win-Win)' sullo
        stesso nodo del circuito) - NON apre una nuova chiamata generativa
        (principio esplicito del prompt). Sceglie tra 3 varianti in base a
        quali elementi sono presenti: elemento bloccante (prima criticita'
        se presente, altrimenti prima azione urgente), prima azione
        win-win approvata dal Gate 3B, ed etichetta del quadrante Kairos
        (sempre disponibile se la matrice esiste). Se non c'e' ne'
        elemento bloccante ne' azione win-win, la raccomandazione resta
        None - nessun template copre onestamente 'non c'e' niente da
        raccomandare', e un placeholder generico violerebbe lo stesso
        principio 'mai un placeholder generico' gia' applicato al resto
        del circuito."""
        self.ensure_one()
        node = self.env.ref('erpv6_winwin_renderdata.node_winwin_renderdata_build')
        link = node.kb_link_ids.filtered(lambda l: l.kb_category_id.name == 'Frasi Raccomandazione (Win-Win)')
        if not link:
            raise UserError(_("Nessun kb_link con categoria 'Frasi Raccomandazione (Win-Win)' configurato sul nodo del circuito."))
        kb = link[0].resolve_kb()
        if not kb or not kb.content:
            raise UserError(_("KB 'frasi_raccomandazione' non risolvibile o vuota."))
        templates = json.loads(kb.content)

        criticita = checked.get('criticita') or []
        urgenti = checked.get('azioni_urgenti') or []
        elemento_bloccante = criticita[0]['titolo'] if criticita else (urgenti[0]['titolo'] if urgenti else None)
        prima_azione_winwin = azioni_winwin[0]['titolo'] if azioni_winwin else None

        if prima_azione_winwin and elemento_bloccante:
            chiave = 'tutti_presenti'
        elif prima_azione_winwin:
            chiave = 'solo_winwin'
        elif elemento_bloccante:
            chiave = 'solo_bloccante'
        else:
            return None

        template = templates.get(chiave)
        if not template:
            return None
        return template.format(
            azione_winwin=prima_azione_winwin or '',
            elemento_bloccante=elemento_bloccante or '',
            quadrante=etichetta_quadrante or '',
        )

    winwin_render_data_final = fields.Json(
        string='RenderData Win-Win Finale (Arco)', copy=False,
        help="Assemblato una sola volta da build_and_validate_render_data() - stesso payload per "
             "entrambe le invocazioni Typst (preview true/false), mai due generazioni indipendenti.")

    def _resolve_consultant_for_booking(self):
        """Risolve il consulente da proporre per la call dalla pagina
        report (06/09/2026, richiesta esplicita: 'il consulente che prende
        il lead usa le regole che gia' abbiamo definito consulente in
        automatico'). Non reimplementa nessuna regola di assegnazione: usa
        SOLO quella gia' esistente in erpv6_production/models/crm_lead.py
        (_auto_assign_consulente/_set_delivery_consulente, che scrive su
        crm.lead.user_id) - qui si legge soltanto il risultato gia' deciso.

        crm.lead.user_id e' un res.users (il "consulente di riferimento"),
        mentre erpv6.booking.token.consultant_id vuole un
        erpv6.consulting.consultant - due modelli diversi, collegati solo
        tramite partner_id (nessun link diretto res.users->
        erpv6.consulting.consultant esiste sul modello). Se il lead non ha
        ancora un consulente assegnato, o l'assegnatario non ha un record
        erpv6.consulting.consultant collegato, ritorna False esplicito -
        mai un consulente indovinato/primo-della-lista.

        Garantisce inoltre che il consulente risolto abbia ALMENO un
        token 'available' non scaduto, generandone uno nuovo (via lo
        stesso erpv6.booking.token.generate_bulk gia' usato dall'endpoint
        POST /api/v1/booking/generate) se necessario - senza questo, la
        pagina /booking/<consultant_id> risulterebbe vuota anche con un
        consulente correttamente assegnato."""
        self.ensure_one()
        user = self.lead_id.user_id
        if not user or not user.partner_id:
            return False
        consultant = self.env['erpv6.consulting.consultant'].sudo().search(
            [('partner_id', '=', user.partner_id.id)], limit=1)
        if not consultant:
            return False

        now = fields.Datetime.now()
        Token = self.env['erpv6.booking.token'].sudo()
        # 06/09/2026 (prompt 'Trigger progetto'): serve un token TRACCIABILE
        # fino a questo progetto (production_order_id, colma il gap
        # confermato in Fase 0: erpv6.booking.token non aveva nessun
        # collegamento a lead/progetto) - un qualunque token 'available' del
        # consulente non basta piu', perche' la pagina /booking/<id> mostra
        # TUTTI i token disponibili e il cliente puo' scegliere un token
        # generico non legato a questo caso. Creazione diretta (non
        # generate_bulk, che non supporta campi extra e non ritorna il
        # record creato) - stesso costrutto interno di generate_bulk
        # (Token.create()), non un meccanismo duplicato.
        linked = Token.search([
            ('consultant_id', '=', consultant.id),
            ('production_order_id', '=', self.id),
            ('status', '=', 'available'),
        ], limit=1).filtered(lambda t: not t.expires_at or t.expires_at > now)
        if not linked:
            # Validita' lunga (90gg): il link nel report puo' essere
            # aperto molto dopo la generazione (fallback email), non ha
            # senso un token che scade prima che il cliente lo apra.
            Token.create({
                'consultant_id': consultant.id,
                'validity_hours': 24 * 90,
                'production_order_id': self.id,
                'lead_id': self.lead_id.id,
            })

        return consultant.id

    def build_and_validate_render_data(self):
        """Arco del circuito (Fase 4, parte sincrona): Motore -> Gate 3A ->
        Gate 3B -> un solo RenderDataFinal, salvato una volta. La parte
        ASINCRONA prevista dal prompt originale (timeout 15-20s, fallback
        email con token, continuazione in background del Gate 3B) NON e'
        implementata qui - richiederebbe un job queue che non esiste in
        questa istanza Odoo (verificato: modulo 'queue_job' non installato/
        non trovato) - vedi report finale per il dettaglio del gap e cosa
        servirebbe per completarlo."""
        self.ensure_one()
        node = self.env.ref('erpv6_winwin_renderdata.node_winwin_renderdata_build')
        motore_output = node.run_process({'production_order_id': self.id}).output_data or {}
        checked = self._winwin_gate_3a_claims_checked(motore_output)

        # diagnosi.metriche: il template Typst (30_diagnosi.typ,
        # diagnosi-metriche()) si aspetta una LISTA di {nome, valore, stato,
        # riferimento}, non il dict {chiave_metrica: {...}} usato
        # internamente dal Motore/Gate 3A (che ha bisogno di 'fonte' e
        # 'soglia' come struttura interna) - trasformazione qui, all'unico
        # punto di confine col template.
        metriche_lista = [
            {
                'nome': nome.upper().replace('_', ' '),
                'valore': ('%sx' % m['valore']) if nome == 'dscr' else ('%s%%' % m['valore']),
                'stato': m['stato'],
                'riferimento': m.get('soglia', {}).get('riferimento', ''),
            }
            for nome, m in checked['diagnosi']['metriche'].items()
        ]

        matrix = self.kairos_matrix_id if hasattr(self, 'kairos_matrix_id') else False
        if not matrix:
            sessions = self.env['erpv6.interview.session'].sudo().search(
                [('lead_id', '=', self.lead_id.id)], order='create_date desc')
            matrix = next((s.kairos_matrix_id for s in sessions if s.kairos_matrix_id), False)
        # Scaling impatto_score/prontezza_totale a 0-100 per il quadrante
        # grafico (20_quadrante.typ, plotting in percentuale) - stimato sui
        # range osservati nei dati reali (impatto_score tipicamente 1-5,
        # prontezza_totale 5-15, vedi erpv6.kairos.matrix esistenti), NON
        # verificato contro un min/max canonico dichiarato dal modello
        # (nessun campo di questo tipo esiste) - approssimazione dichiarata,
        # non un dato inventato: se il quadrante risultasse visivamente
        # tarato male, e' questo il punto da rivedere con un vero min/max.
        if matrix:
            impatto_pct = max(0, min(100, (matrix.impatto_score - 1) / 4 * 100))
            prontezza_pct = max(0, min(100, (matrix.prontezza_totale - 5) / 10 * 100))
            etichetta = matrix.quadrante or ''
        else:
            impatto_pct = prontezza_pct = 0
            etichetta = ''
            checked['missing'] = list(checked.get('missing', [])) + ['kairos_matrix']

        azioni_winwin, gate_3b_session = self._winwin_gate_3b_azioni_winwin()

        raccomandazione = self._winwin_build_raccomandazione(checked, azioni_winwin, etichetta)

        consultant_booking_id = self._resolve_consultant_for_booking()

        fonti = sorted(set(
            [m.get('fonte', '') for m in checked['diagnosi']['metriche'].values()] +
            [c.get('fonte', '') for c in checked['criticita']] +
            [a.get('fonte', '') for a in checked['azioni_urgenti']]
        ) - {''})

        render_data = {
            'preview': True,  # sovrascritto per-invocazione sotto
            'client_info': {
                'tipo_progetto': self.interview_tipo_progetto or '',
                'azienda': self.lead_id.name or '',
                'data': fields.Date.context_today(self).strftime('%d/%m/%Y'),
            },
            'diagnosi': {'metriche': metriche_lista},
            'impatto': impatto_pct,
            'prontezza': prontezza_pct,
            'etichetta_azienda': etichetta,
            'sintesi': None,
            'criticita': checked['criticita'],
            'azioni_urgenti': checked['azioni_urgenti'],
            'schede': azioni_winwin or [],
            'roadmap': motore_output.get('roadmap', []),
            'raccomandazione': raccomandazione,
            'fonti': fonti,
            # Consulente assegnato al lead (regola di assegnazione gia'
            # esistente in crm.lead, non reinventata qui) per il link di
            # prenotazione nella pagina report - False esplicito se il
            # lead non ha un consulente assegnato/collegato, mai un
            # consulente indovinato (vedi _resolve_consultant_for_booking).
            'consultant_booking_id': consultant_booking_id,
            # Non-schema-Typst, solo per audit/debug (il template Typst non
            # li legge, ma restano nel record salvato sotto):
            '_missing': checked.get('missing', []),
            '_gate_3a_dropped': checked.get('gate_3a_dropped', []),
            '_gate_3b_session_id': gate_3b_session.id if gate_3b_session else False,
            '_gate_3b_status': gate_3b_session.status if gate_3b_session else False,
        }
        self.winwin_render_data_final = render_data
        return render_data

    def generate_winwin_documents(self):
        """Seconda meta' dell'Arco: due invocazioni di
        erpv6.typst.engine.generate_document sullo STESSO
        winwin_render_data_final (mai due generazioni indipendenti, solo il
        flag 'preview' cambia) - build_and_validate_render_data() deve
        essere gia' stato chiamato prima."""
        self.ensure_one()
        if not self.winwin_render_data_final:
            raise UserError(_("Nessun render_data validato: chiama prima build_and_validate_render_data()."))
        template = self.env.ref('erpv6_typst.typst_template_ww_std_001', raise_if_not_found=False) \
            or self.env['erpv6.typst.template'].search([('code', '=', 'WW-STD-001')], limit=1)
        if not template:
            raise UserError(_("Template WW-STD-001 non trovato."))

        preview_data = dict(self.winwin_render_data_final, preview=True)
        final_data = dict(self.winwin_render_data_final, preview=False)

        preview_doc = self.env['erpv6.typst.engine'].generate_document(
            template.id, self._name, self.id, data=preview_data)
        final_doc = self.env['erpv6.typst.engine'].generate_document(
            template.id, self._name, self.id, data=final_data)
        return preview_doc, final_doc
