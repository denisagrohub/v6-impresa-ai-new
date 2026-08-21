import json
import logging

from odoo import _, api, fields, models

_logger = logging.getLogger(__name__)

# Categoria KB CONDIVISA da tutti gli agenti per la loro memoria (aggiunta
# su richiesta esplicita dell'utente il 20/08/2026: "anche l'agente piu'
# semplice deve avere una sua memoria... allocata su KB divisa per agenti
# dentro una stessa categoria ed interrogabile"). Una sola categoria, non
# una per agente: le voci si distinguono per agente tramite un tag
# erpv6.kb.tag col codice dell'agente (get_or_create, stesso pattern gia'
# usato per le categorie), cosi' restano tutte interrogabili insieme O
# filtrate per singolo agente dalla stessa vista KB.
AGENT_MEMORY_CATEGORY_NAME = 'Memoria Agenti'
AGENT_MEMORY_MAX_ENTRIES = 10


class Erpv6AgentConfig(models.Model):
    """Registro degli agenti AI del sistema: base comune estratta da
    kaizen_agent.py (erpv6_kaizen, primo agente reale) su richiesta
    esplicita dell'utente il 20/08/2026 ("gli agenti hanno vita in un
    modulo a se'?"). Un agente qui e' SOLO la sua identita' + dove trova le
    istruzioni (una categoria KB) + quale route erpv6_omni_bridge chiamare.

    context_category_id e pattern_id (aggiunti dopo, stessa sessione, su
    richiesta "Thor sceglie tra pattern gia' pronti e li configura da
    solo"): se un agente ha pattern_id.code='text_proposal' e
    context_category_id valorizzato, _run_generic_text_proposal lo esegue
    SENZA bisogno di nessun codice Python scritto apposta -- vedi
    _cron_run_generic_agents sotto. Kaizen resta sul suo cron dedicato
    (kaizen_agent.py, gia' collaudato) e non usa questo motore generico:
    non toccato per non rischiare di romperlo, ma classificato con lo
    stesso pattern_id per coerenza."""
    _name = 'erpv6.agent.config'
    _description = 'Configurazione Agente AI'
    _order = 'name'

    name = fields.Char(string='Nome', required=True)
    code = fields.Char(string='Codice', required=True, help="Slug tecnico stabile, es. 'kaizen'. Usato dal codice per trovare questo agente.")
    pattern_id = fields.Many2one('erpv6.agent.pattern', string='Pattern')
    instructions_category_id = fields.Many2one(
        'erpv6.kb.category', string='Categoria KB Istruzioni', required=True,
        help="Le voci KB di questa categoria vengono lette come istruzioni di sistema per l'agente "
             "(stesso pattern gia' usato per 'Regole Kaizen').",
    )
    context_category_id = fields.Many2one(
        'erpv6.kb.category', string='Categoria KB Contesto/Fatti',
        help="Solo per pattern 'text_proposal': le voci KB di questa categoria vengono lette come "
             "i fatti/lo stato attuale su cui l'agente deve ragionare (es. per Kaizen sarebbero il "
             "backlog Pareto e l'aggregato Heinrich, ma Kaizen resta sul suo cron dedicato). Un "
             "agente creato da Thor senza codice Python usa SOLO questo campo per sapere di cosa "
             "parlare -- tenerlo aggiornato (a mano o da un altro cron) e' responsabilita' di chi "
             "lo configura.",
    )
    omni_task_type = fields.Char(
        string='Task Type erpv6_omni_bridge', required=True,
        help="task_type della route erpv6.omni.route.config da chiamare per questo agente.",
    )
    persona_kb_id = fields.Many2one(
        'erpv6.kb', string='Persona (tono, professione, capacità)',
        help="UNA voce KB (non una categoria: tono/professione/capacità sono di solito un blocco "
             "coerente, non una lista di regole separate) che descrive chi e' l'agente, come parla, "
             "cosa sa fare. Facoltativa ma consigliata -- senza, l'agente ha istruzioni e contesto "
             "ma nessuna voce propria.",
    )
    active = fields.Boolean(default=True)
    description = fields.Text(string='Descrizione')

    _sql_constraints = [
        ('uniq_code', 'UNIQUE(code)', "Esiste gia' un agente con questo codice."),
    ]

    def _get_memory_tag(self):
        """Tag erpv6.kb.tag col codice di questo agente (get-or-create,
        stesso idioma gia' usato per le categorie KB): distingue le voci di
        AGENT_MEMORY_CATEGORY_NAME appartenenti a questo agente dalle
        altre, senza bisogno di una categoria per agente."""
        self.ensure_one()
        Tag = self.env['erpv6.kb.tag']
        tag = Tag.search([('name', '=', self.code)], limit=1)
        return tag or Tag.create({'name': self.code})

    def _get_memory_kbs(self):
        """Le ultime AGENT_MEMORY_MAX_ENTRIES voci di memoria di questo
        agente, piu' recenti prima -- un tetto fisso perche' la memoria
        cresce ad ogni proposta e non deve far crescere il prompt AI senza
        limite (stesso principio di attenzione alla crescita gia' discusso
        stasera per erpv6.kaizen.detected_signal)."""
        self.ensure_one()
        category = self.env['erpv6.kb.category'].get_or_create(
            AGENT_MEMORY_CATEGORY_NAME, 'metodo_v6', is_transversal=True)
        tag = self._get_memory_tag()
        return self.env['erpv6.kb'].search(
            [('category_id', '=', category.id), ('tag_ids', 'in', tag.id), ('is_active', '=', True)],
            order='create_date desc', limit=AGENT_MEMORY_MAX_ENTRIES)

    def _write_memory(self, summary):
        """Aggiunge una voce alla memoria di questo agente -- chiamata dopo
        ogni proposta generata con successo, cosi' il giro successivo la
        rilegge (vedi _get_memory_kbs) e l'agente diventa via via piu'
        istruito sul proprio storico, non solo su istruzioni/contesto
        statici."""
        self.ensure_one()
        category = self.env['erpv6.kb.category'].get_or_create(
            AGENT_MEMORY_CATEGORY_NAME, 'metodo_v6', is_transversal=True)
        tag = self._get_memory_tag()
        self.env['erpv6.kb'].create({
            'name': "%s - %s" % (self.name, fields.Datetime.now()),
            'kb_type': 'metodo_v6',
            'category_id': category.id,
            'tag_ids': [(6, 0, [tag.id])],
            'agent_config_id': self.id,
            'content': summary,
            'content_format': 'text',
            'access_level': 'ai_only',
            'is_active': True,
        })

    @api.model
    def _cron_run_generic_agents(self):
        """Esegue TUTTI gli agenti configurati per il pattern generico
        'text_proposal' con context_category_id valorizzato -- un solo
        cron condiviso, non uno per agente: un nuovo agente creato da Thor
        viene eseguito automaticamente appena configurato, senza toccare
        nessun file XML di cron."""
        configs = self.search([
            ('active', '=', True),
            ('pattern_id.code', '=', 'text_proposal'),
            ('context_category_id', '!=', False),
        ])
        for config in configs:
            config._run_generic_text_proposal()

    def _run_generic_text_proposal(self):
        """Motore generico del pattern 'text_proposal': legge istruzioni +
        contesto da due categorie KB, chiama l'AI, salva SEMPRE in attesa
        di gate umano (erpv6.agent.proposal) -- mai auto-applicato. Genera
        al massimo UNA proposta per giro, mai una per singola voce KB di
        contesto (stesso principio gia' seguito per il certificato
        consolidato e per l'agente Kaizen: niente spam)."""
        self.ensure_one()
        # is_active=True esplicito su entrambe le ricerche: senza, una voce
        # KB disattivata (es. una regola ritirata) resterebbe comunque letta
        # e applicata dall'agente -- bug reale trovato da un agente di
        # verifica dedicato il 20/08/2026, non solo teorico.
        instructions_kbs = self.env['erpv6.kb'].search(
            [('category_id', '=', self.instructions_category_id.id), ('is_active', '=', True)], order='name')
        if not instructions_kbs:
            _logger.warning("Agente %s: nessuna voce KB di istruzioni, nessuna proposta generata.", self.code)
            return
        context_kbs = self.env['erpv6.kb'].search(
            [('category_id', '=', self.context_category_id.id), ('is_active', '=', True)], order='name')
        if not context_kbs:
            _logger.info("Agente %s: nessuna voce KB di contesto, nessuna proposta da generare.", self.code)
            return
        instructions_text = "\n\n".join("### %s\n%s" % (kb.name, kb.content) for kb in instructions_kbs)
        context_text = "\n\n".join("### %s\n%s" % (kb.name, kb.content) for kb in context_kbs)
        persona_text = self.persona_kb_id.content if self.persona_kb_id else ''
        memory_kbs = self._get_memory_kbs()
        memory_text = "\n\n".join("### %s\n%s" % (kb.name, kb.content) for kb in memory_kbs)

        system_prompt = (
            "Sei l'agente '%(name)s' del sistema erpv6.%(persona)s Applichi le istruzioni sotto per "
            "proporre UNA sola azione concreta basata sui fatti/contesto fornito -- non inventare "
            "nulla che non sia nei fatti, non proporre nulla se i fatti non giustificano un'azione "
            "chiara. Non applichi mai nulla da solo: la tua proposta va sempre a un umano per la "
            "revisione. Rispondi SOLO con un oggetto JSON valido, senza markdown code fence, senza "
            "altro testo: "
            '{"title": "<titolo breve>", "proposal_text": "<proposta in italiano, concreta e '
            'azionabile>", "rule_applied": "<quale istruzione hai applicato>"}\n\n'
            "ISTRUZIONI:\n%(instructions)s%(memory)s"
        ) % {
            'name': self.name,
            'persona': (" " + persona_text) if persona_text else '',
            'instructions': instructions_text,
            'memory': ("\n\nMEMORIA DELLE TUE PROPOSTE PRECEDENTI (piu' recenti prima, usale per non "
                       "ripeterti e per essere coerente col tuo storico):\n%s" % memory_text) if memory_text else '',
        }

        bridge = self.env['erpv6.omni.bridge']
        result = bridge.execute_ai_task(
            task_type=self.omni_task_type,
            payload={
                'temperature': 0.2,
                'messages': [
                    {'role': 'system', 'content': system_prompt},
                    {'role': 'user', 'content': _("CONTESTO/FATTI ATTUALI:\n%s") % context_text},
                ],
            },
            context={'source': 'erpv6_agent:_run_generic_text_proposal', 'agent_code': self.code},
        )
        if not result.get('success'):
            _logger.warning("Agente %s: chiamata AI fallita, nessuna proposta generata: %s", self.code, result.get('error'))
            return
        try:
            content = result['data']['choices'][0]['message']['content']
            parsed = json.loads(content)
        except (KeyError, IndexError, TypeError, json.JSONDecodeError) as e:
            _logger.warning("Agente %s: risposta AI in formato inatteso, nessuna proposta generata: %s", self.code, e)
            return
        if not parsed.get('title') or not parsed.get('proposal_text'):
            _logger.warning("Agente %s: risposta AI incompleta, scartata.", self.code)
            return

        self.env['erpv6.agent.proposal'].create({
            'agent_config_id': self.id,
            'name': parsed['title'],
            'proposal_text': parsed['proposal_text'],
            'based_on': context_text,
            'rule_applied': parsed.get('rule_applied', ''),
            'provider_name': result.get('provider_used', ''),
        })
        self._write_memory(_("Ho proposto: %(title)s — %(text)s") % {
            'title': parsed['title'], 'text': parsed['proposal_text']})
