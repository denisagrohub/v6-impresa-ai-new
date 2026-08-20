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

        rules_kbs = self.env['erpv6.kb'].search(
            [('category_id', '=', agent_config.instructions_category_id.id)], order='name')
        if not rules_kbs:
            _logger.warning("Agente Kaizen: nessuna voce KB nella categoria istruzioni configurata, nessuna proposta generata.")
            return
        rules_text = "\n\n".join("### %s\n%s" % (kb.name, kb.content) for kb in rules_kbs)

        heinrich_all = self.env['erpv6.heinrich.indicator'].search([])
        heinrich_summary = _(
            "%(grave)d eventi gravi, %(lieve)d lievi, %(near_miss)d near-miss su %(n)d record monitorati."
        ) % {
            'grave': sum(heinrich_all.mapped('eventi_gravi')),
            'lieve': sum(heinrich_all.mapped('problemi_lievi')),
            'near_miss': sum(heinrich_all.mapped('near_miss_segnalati')),
            'n': len(heinrich_all),
        }
        backlog_text = "\n".join(
            "- %s (punteggio %d, cumulata %.1f%%%s)" % (
                item.name, item.punteggio, item.cumulata_pct,
                " — PRIORITARIO" if item.is_priority else "")
            for item in backlog.item_ids.sorted(key=lambda i: i.punteggio, reverse=True)
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
        memory_kbs = agent_config._get_memory_kbs()
        memory_text = "\n\n".join("### %s\n%s" % (kb.name, kb.content) for kb in memory_kbs)
        system_prompt = (
            "Sei l'agente Kaizen del sistema erpv6.%(persona)s Applichi le regole sotto per proporre "
            "UNA sola azione concreta sul backlog tecnico reale fornito -- non inventare problemi "
            "non presenti nei dati, non proporre nulla se i dati non giustificano un'azione chiara. "
            "Non applichi mai nulla da solo: la tua proposta va sempre a un umano per la revisione. "
            "PRIMA di proporre di creare qualcosa di nuovo, verifica se uno degli strumenti gia' "
            "esistenti sotto lo copre gia' -- se si', la tua proposta deve dire di RIUSARE quello, "
            "mai duplicarlo (principio motore vs conoscenza: non creare un secondo modo di fare la "
            "stessa cosa).\n\nSTRUMENTI GIA' ESISTENTI IN erpv6_kaizen:\n%(tools)s\n\n"
            "Rispondi SOLO con un oggetto JSON valido, senza markdown code fence, senza altro testo: "
            '{"title": "<titolo breve>", "proposal_text": "<proposta in italiano, concreta e azionabile>", '
            '"rule_applied": "<quale regola tra quelle sotto hai applicato>"}\n\n'
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
            parsed = json.loads(content)
        except (KeyError, IndexError, TypeError, json.JSONDecodeError) as e:
            _logger.warning("Agente Kaizen: risposta AI in formato inatteso, nessuna proposta generata: %s", e)
            return
        if not parsed.get('title') or not parsed.get('proposal_text'):
            _logger.warning("Agente Kaizen: risposta AI incompleta (manca titolo o proposta), scartata.")
            return

        proposal = self.env['erpv6.agent.proposal'].create({
            'agent_config_id': agent_config.id,
            'name': parsed['title'],
            'proposal_text': parsed['proposal_text'],
            'based_on': backlog_text + "\n\n" + heinrich_summary,
            'rule_applied': parsed.get('rule_applied', ''),
            'provider_name': result.get('provider_used', ''),
        })
        agent_config._write_memory(_("Ho proposto: %(title)s — %(text)s") % {
            'title': parsed['title'], 'text': parsed['proposal_text']})

        # Stesso resolver del referente KB globale gia' usato ovunque per
        # decidere "chi e' il supervisore" (erpv6.kb._resolve_kb_supervisor
        # non e' chiamabile qui senza un record erpv6.kb concreto: si legge
        # direttamente lo stesso lead di riferimento).
        kb_admin_lead = self.env.ref('erpv6_production.crm_lead_kb_admin', raise_if_not_found=False)
        supervisor = kb_admin_lead.user_id if kb_admin_lead else self.env['res.users']
        if supervisor and supervisor.email:
            default_from = self.env['ir.config_parameter'].sudo().get_param('mail.default.from')
            mail_values = {
                'subject': _("[Kaizen] Nuova proposta: %s") % proposal.name,
                'body_html': _("<p><strong>%(title)s</strong></p><p>%(text)s</p>") % {
                    'title': proposal.name, 'text': proposal.proposal_text.replace("\n", "<br/>")},
                'email_to': supervisor.email,
            }
            if default_from:
                mail_values['email_from'] = '"%s" <%s>' % (self.env.company.name, default_from)
            self.env['mail.mail'].sudo().create(mail_values).send()
            proposal.message_post(body=_("Proposta inviata via email a %s per revisione.") % supervisor.name)
