import json
import logging

from odoo import _, api, models

from .kaizen_detected_signal import KAIZEN_SHARED_BACKLOG

_logger = logging.getLogger(__name__)

KAIZEN_AGENT_CODE = 'kaizen'


class Erpv6KaizenAgent(models.Model):
    """Agente Kaizen: primo agente registrato sulla base condivisa
    erpv6_agent (erpv6.agent.config/erpv6.agent.proposal, estratta il
    20/08/2026 su richiesta esplicita dell'utente -- "gli agenti hanno vita
    in un modulo a se'?"). Legge SOLO dati gia' raccolti dal sensore (mai
    testo di log libero, stesso principio del cron di rilevamento) e le
    istruzioni configurate per questo agente (voci KB della categoria
    puntata da erpv6.agent.config), chiede all'AI una proposta in
    linguaggio naturale, la salva SEMPRE in attesa di revisione umana. Non
    applica mai nulla da sola -- stesso principio del gate umano gia'
    seguito ovunque nel progetto."""
    _inherit = 'erpv6.kaizen.detected_signal'

    @api.model
    def _cron_kaizen_agent_propose(self):
        """Genera al massimo UNA proposta per giro (non una per item del
        backlog: rischierebbe di spammare come i vecchi certificati per
        categoria, stesso errore gia' corretto stanotte sul certificato).
        Nessun risultato se il backlog e' vuoto, se l'agente non e'
        registrato o se non ha istruzioni -- mai inventare una proposta
        senza dati reali (regola anti-allucinazione del progetto)."""
        agent_config = self.env['erpv6.agent.config'].search(
            [('code', '=', KAIZEN_AGENT_CODE), ('active', '=', True)], limit=1)
        if not agent_config:
            _logger.warning("Agente Kaizen: nessun erpv6.agent.config con code='kaizen' trovato, nessuna proposta generata.")
            return

        backlog = self.env['erpv6.pareto.analysis'].search([
            ('res_model', '=', KAIZEN_SHARED_BACKLOG[0]), ('res_id', '=', KAIZEN_SHARED_BACKLOG[1]),
        ], limit=1)
        if not backlog or not backlog.item_ids:
            _logger.info("Agente Kaizen: backlog Pareto vuoto, nessuna proposta da generare.")
            return

        # is_active=True esplicito: senza, disattivare una regola KB (es.
        # per ritirarla) non avrebbe impedito all'agente di continuare a
        # leggerla e applicarla -- bug reale trovato da un agente di
        # verifica dedicato il 20/08/2026, innocuo solo per coincidenza
        # (nessuna voce era mai stata disattivata finora).
        # 03/10/2026 (C5-P3): fix Groq 413. La categoria ha 39 voci
        # (80.903 char), troppo per il limite Groq. Prendo solo le regole
        # numerate (le 12 + Principio guida) e tronco ciascuna a
        # RULES_MAX_CHARS_PER_KB.
        RULES_MAX_CHARS_PER_KB = 500
        RULES_MAX_ENTRIES = 15
        all_kbs = self.env['erpv6.kb'].search(
            [('category_id', '=', agent_config.instructions_category_id.id),
             ('is_active', '=', True)], order='name')
        if not all_kbs:
            _logger.warning("Agente Kaizen: nessuna voce KB nella categoria istruzioni configurata, nessuna proposta generata.")
            return
        # Priorità: Principio guida + 1-12 numerate
        priority_kbs = all_kbs.filtered(
            lambda k: k.name.startswith('Principio') or
                      any(k.name.startswith(f'{n}.') for n in range(1, 13))
        )[:RULES_MAX_ENTRIES]
        rules_kbs = priority_kbs if priority_kbs else all_kbs[:RULES_MAX_ENTRIES]
        rules_text = "\n\n".join(
            "### %s\n%s" % (kb.name, (kb.content or '')[:RULES_MAX_CHARS_PER_KB])
            for kb in rules_kbs
        )

        heinrich_all = self.env['erpv6.heinrich.indicator'].search([])
        heinrich_summary = _(
            "%(grave)d eventi gravi, %(lieve)d lievi, %(near_miss)d near-miss su %(n)d record monitorati."
        ) % {
            'grave': sum(heinrich_all.mapped('eventi_gravi')),
            'lieve': sum(heinrich_all.mapped('problemi_lievi')),
            'near_miss': sum(heinrich_all.mapped('near_miss_segnalati')),
            'n': len(heinrich_all),
        }
        # 03/10/2026 (C5-P3): top 5 item backlog (era tutti, fino a 20+).
        BACKLOG_TOP_N = 5
        top_items = backlog.item_ids.sorted(
            key=lambda i: i.punteggio, reverse=True)[:BACKLOG_TOP_N]
        backlog_text = "\n".join(
            "- %s (punteggio %d, cumulata %.1f%%%s)" % (
                item.name[:100], item.punteggio, item.cumulata_pct,
                " — PRIORITARIO" if item.is_priority else "")
            for item in top_items
        )

        # Senza questo elenco, la prima proposta reale (20/08/2026) ha
        # suggerito di creare un nuovo modello "ticket Kaizen" senza sapere
        # che erpv6.kaizen.manual_report fa gia' la stessa cosa -- segnalato
        # dal vivo dall'utente ("mi aspettavo che non sbagliasse modulo").
        # Stesso principio "motore vs conoscenza" del progetto (CLAUDE.md),
        # ora reso esplicito anche per l'agente stesso.
        existing_tools = (
            "- erpv6.kaizen.manual_report: segnalazione manuale gia' esistente (titolo, descrizione, "
            "gravita', record collegato via res_model/res_id). NON proporre un nuovo modello ticket: "
            "se serve tracciare una segnalazione, questo modello la copre gia'.\n"
            "- erpv6.heinrich.indicator.log_signal(res_model, res_id, severity, description): metodo "
            "gia' esistente per registrare un segnale (near_miss/lieve/grave) su un record.\n"
            "- erpv6.pareto.analysis.log_item(res_model, res_id, name, frequenza, impatto): metodo "
            "gia' esistente per aggiungere/aggiornare un elemento di backlog.\n"
            "- erpv6.kaizen.detected_signal: registro dedup, un cron gia' lo popola da solo da stati "
            "strutturati (validazioni bloccate, estrazioni KB bloccate).\n"
            "- Pattern generico res_model/res_id (Char+Integer): usato da TUTTI i motori sopra per "
            "agganciarsi a qualsiasi record esistente, mai un nuovo campo di collegamento dedicato."
        )
        # Persona + memoria (aggiunte su richiesta esplicita dell'utente il
        # 20/08/2026, "anche l'agente piu' semplice deve avere una sua
        # memoria... una KB che gli da' il tono/professione/capacita'"):
        # stessi helper condivisi di erpv6.agent.config, cosi' Kaizen (cron
        # dedicato, non passa dal motore generico) si comporta comunque
        # come un agente "di prima classe".
        persona_text = agent_config.persona_kb_id.content if agent_config.persona_kb_id else ''
        # 03/10/2026 (C5-P3): limito la memoria a 3 voci (era 10) per
        # ridurre il payload Groq.
        MEMORY_MAX_ENTRIES = 3
        MEMORY_MAX_CHARS_PER_KB = 300
        memory_kbs = agent_config._get_memory_kbs()[:MEMORY_MAX_ENTRIES]
        memory_text = "\n\n".join(
            "### %s\n%s" % (kb.name, (kb.content or '')[:MEMORY_MAX_CHARS_PER_KB])
            for kb in memory_kbs
        )
        system_prompt = (
            "Sei l'agente Kaizen del sistema erpv6.%(persona)s Applichi le regole sotto per proporre "
            "fino a 3 azioni concrete sul backlog tecnico reale fornito -- non inventare problemi "
            "non presenti nei dati, non proporre nulla se i dati non giustificano un'azione chiara. "
            "Non applichi mai nulla da solo: le tue proposte vanno sempre a un umano per la revisione. "
            "PRIMA di proporre di creare qualcosa di nuovo, verifica se uno degli strumenti gia' "
            "esistenti sotto lo copre gia' -- se si', la tua proposta deve dire di RIUSARE quello, "
            "mai duplicarlo (principio motore vs conoscenza: non creare un secondo modo di fare la "
            "stessa cosa).\n\nSTRUMENTI GIA' ESISTENTI IN erpv6_kaizen:\n%(tools)s\n\n"
            "Output: array JSON (0-3 elementi). Se non trovi problemi reali, ritorna []. "
            "Mai inventare problemi.\n\n"
            "Schema di ogni proposta (campi L1 obbligatori):\n"
            "{\n"
            '  "title": "max 80 char",\n'
            '  "problem": "cosa e rotto, min 50 char",\n'
            '  "proposed_change": "cosa cambiare, min 50 char",\n'
            '  "files_affected": ["odoo-modules/..."],\n'
            '  "impact": "low|medium|high",\n'
            '  "effort": "es: 2h",\n'
            '  "risk": "min 20 char",\n'
            '  "test_plan": "come verificare, min 30 char",\n'
            '  "rationale": "perche e un fix, min 30 char",\n'
            '  "target_agent": "claudio|alessandro|auto",\n'
            '  "rule_applied": "quale regola tra quelle sotto hai applicato"\n'
            "}\n\n"
            "Rispondi SOLO con l'array JSON, nessun markdown code fence, nessun altro testo.\n\n"
            "REGOLE:\n%(rules)s%(memory)s"
        ) % {
            'persona': (" " + persona_text) if persona_text else '',
            'tools': existing_tools,
            'rules': rules_text,
            'memory': ("\n\nMEMORIA DELLE TUE PROPOSTE PRECEDENTI (piu' recenti prima, usale per non "
                       "ripeterti e per essere coerente col tuo storico):\n%s" % memory_text) if memory_text else '',
        }
        user_content = _(
            "BACKLOG PARETO CONDIVISO (ordinato per punteggio):\n%(backlog)s\n\n"
            "AGGREGATO HEINRICH (cultura organizzativa sulla segnalazione):\n%(heinrich)s"
        ) % {'backlog': backlog_text, 'heinrich': heinrich_summary}

        # 03/10/2026 (C5-P3): log dimensione payload per monitoraggio.
        total_chars = len(system_prompt) + len(user_content)
        _logger.info(
            "Kaizen agent prompt: system=%d char, user=%d char, total=%d char",
            len(system_prompt), len(user_content), total_chars,
        )
        if total_chars > 40000:
            _logger.warning(
                "Kaizen agent prompt molto grande (%d char): "
                "rischio 413 su provider come Groq.", total_chars,
            )

        bridge = self.env['erpv6.omni.bridge']
        result = bridge.execute_ai_task(
            task_type=agent_config.omni_task_type,
            payload={
                'temperature': 0.2,
                'messages': [
                    {'role': 'system', 'content': system_prompt},
                    {'role': 'user', 'content': user_content},
                ],
            },
            context={'source': 'erpv6_kaizen:_cron_kaizen_agent_propose'},
        )
        if not result.get('success'):
            _logger.warning("Agente Kaizen: chiamata AI fallita, nessuna proposta generata: %s", result.get('error'))
            return
        try:
            content = result['data']['choices'][0]['message']['content']
        except (KeyError, IndexError, TypeError) as e:
            _logger.warning("Agente Kaizen: risposta AI in formato inatteso: %s", e)
            return

        # 04/10/2026 (C5-gate-2c-2-step8): parse array JSON (0-3)
        # con strip markdown fence, validazione L1, create con structured_data.
        proposals_data = self._parse_proposals_json(content)
        if not proposals_data:
            _logger.info("Agente Kaizen: nessuna proposta JSON valida, fine.")
            return

        Proposal = self.env['erpv6.agent.proposal']
        created = 0
        skipped = 0
        created_records = []
        for pd in proposals_data:
            ok, reasons = Proposal._validate_structured_dict(pd)
            if not ok:
                _logger.info(
                    "Agente Kaizen: proposta scartata L1: %s", reasons)
                skipped += 1
                continue
            try:
                p_rec = Proposal.create({
                    'agent_config_id': agent_config.id,
                    'name': (pd.get('title') or '')[:80],
                    'proposal_text': (
                        (pd.get('problem') or '') + '\n\n'
                        + (pd.get('proposed_change') or '')
                    ),
                    'structured_data': json.dumps(pd, ensure_ascii=False),
                    'target_agent': pd.get('target_agent', 'auto'),
                    'based_on': backlog_text + "\n\n" + heinrich_summary,
                    'rule_applied': pd.get('rule_applied', ''),
                    'provider_name': result.get('provider_used', ''),
                    'status': 'pending_review',
                })
                created_records.append(p_rec)
                created += 1
            except Exception as e:  # pylint: disable=broad-except
                _logger.warning(
                    "Agente Kaizen: creazione proposta fallita: %s", e)

        _logger.info(
            "Agente Kaizen: %d proposte create, %d scartate L1",
            created, skipped,
        )

        # Notifica per ogni proposta creata (email + Telegram se offline)
        for p_rec in created_records:
            try:
                self._notify_kaizen_proposal(p_rec, agent_config)
            except Exception:  # pylint: disable=broad-except
                _logger.exception(
                    "Notifica proposta #%s fallita (non bloccante).", p_rec.id)

        return created

    def _notify_kaizen_proposal(self, proposal, agent_config):
        """Notifica email + Telegram per una proposta Kaizen.
        Estratto in 2c-2-step8 dal vecchio _cron_kaizen_agent_propose."""
        kb_admin_lead = self.env.ref(
            'erpv6_production.crm_lead_kb_admin', raise_if_not_found=False)
        supervisor = kb_admin_lead.user_id if kb_admin_lead else self.env['res.users']
        if not supervisor or not supervisor.email:
            return

        default_from = self.env['ir.config_parameter'].sudo().get_param(
            'mail.default.from')
        mail_values = {
            'subject': _("[Kaizen] Nuova proposta: %s") % proposal.name,
            'body_html': _("<p><strong>%(title)s</strong></p><p>%(text)s</p>") % {
                'title': proposal.name,
                'text': (proposal.proposal_text or '').replace("\n", "<br/>")},
            'email_to': supervisor.email,
        }
        if default_from:
            mail_values['email_from'] = '"%s" <%s>' % (
                self.env.company.name, default_from)
        self.env['mail.mail'].sudo().create(mail_values).send()
        proposal.message_post(body=_(
            "Proposta inviata via email a %s per revisione.") % supervisor.name)

        if supervisor.im_status != 'online':
            try:
                self.env['erpv6.agent.telegram.config'].send_proposal_decision_for_agent(
                    agent_config, proposal.id,
                    _("[Kaizen] Nuova proposta: %(title)s\n\n%(text)s") % {
                        'title': proposal.name,
                        'text': proposal.proposal_text or ''},
                )
            except Exception:  # pylint: disable=broad-except
                _logger.exception(
                    "Invio Telegram fallito per proposta #%s.", proposal.id)

    @api.model
    def _parse_proposals_json(self, raw):
        """04/10/2026 (C5-gate-2c-2-step8): parse robusto della risposta
        LLM. Ritorna array di 0-3 dict. Gestisce markdown fence.
        """
        if not raw:
            return []
        raw = raw.strip()
        if raw.startswith('```'):
            ls = raw.split('\n')
            if ls and ls[0].startswith('```'):
                ls = ls[1:]
            if ls and ls[-1].strip() == '```':
                ls = ls[:-1]
            raw = '\n'.join(ls).strip()
        try:
            data = json.loads(raw)
        except (json.JSONDecodeError, TypeError):
            return []
        if isinstance(data, dict):
            data = [data]
        if not isinstance(data, list):
            return []
        return [x for x in data if isinstance(x, dict)][:3]
