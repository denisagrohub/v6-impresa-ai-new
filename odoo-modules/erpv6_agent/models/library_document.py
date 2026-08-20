import json
import logging

from odoo import _, api, fields, models
from odoo.exceptions import UserError

_logger = logging.getLogger(__name__)


class LibraryDocument(models.Model):
    """Estende erpv6.library.document (categoria 'agent_knowledge' aggiunta
    direttamente in erpv6_library, stesso schema gia' seguito per
    kb_source/kb_case_study) con l'agganciamento a un agente e l'estrazione
    automatica in voci KB -- richiesto dal vivo dall'utente il 20/08/2026:
    "documenti che servono per creare e dare capacita' ed intelletto agli
    agenti... referenziati per agente... se viene cancellato il documento
    sparisce anche tutta la KB correlata" (vedi ondelete='cascade' su
    erpv6.kb.source_document_id, kb_knowledge.py)."""
    _name = 'erpv6.library.document'
    _inherit = ['erpv6.library.document', 'mail.thread']

    agent_config_id = fields.Many2one(
        'erpv6.agent.config', string='Agente', ondelete='cascade',
        help="Obbligatorio per la categoria 'Conoscenza Agente': a quale agente questo documento "
             "da' capacita'. Cancellare l'agente cancella anche questo documento.",
    )

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            # 'Progetto' (project_id, in realta' un crm.lead) resta
            # required=True a livello di campo (erpv6_library) ma per un
            # documento di conoscenza agente non ha alcun senso chiederlo:
            # nessun cliente coinvolto. Stesso schema gia' seguito per
            # kb_source/kb_case_study in erpv6_production (lead dedicato
            # per documento), qui pero' senza dipendere da erpv6_production:
            # user_id e' semplicemente chi carica il documento.
            if vals.get('category') == 'agent_knowledge' and not vals.get('project_id'):
                new_lead = self.env['crm.lead'].sudo().create({
                    'name': _("Conoscenza Agente — %s") % (vals.get('name') or _('Documento senza nome')),
                    'type': 'opportunity',
                    'user_id': self.env.user.id,
                })
                vals['project_id'] = new_lead.id
        documents = super().create(vals_list)
        for document in documents:
            if document.category == 'agent_knowledge' and document.file and document.agent_config_id:
                document.action_extract_agent_knowledge()
        return documents

    def action_extract_agent_knowledge(self):
        """Legge il documento e lo trasforma in una o piu' voci KB
        collegate all'agente (categoria = instructions_category_id
        dell'agente) e al documento sorgente (source_document_id, cascade).
        Chiamata singola non a chunk (i documenti di conoscenza agente sono
        tipicamente istruzioni/materiale di riferimento, non fogli di
        centinaia di righe come l'estrazione KB business -- stesso livello
        di complessita' gia' accettato per _generate_case_study_interview)."""
        self.ensure_one()
        if not self.agent_config_id:
            raise UserError(_("Seleziona un agente prima di elaborare questo documento."))
        service = self.env['erpv6.kb.extraction.service']
        try:
            doc_text = service.extract_raw_text(self.file, self.file_name)
        except Exception as e:
            self.message_post(body=_("Impossibile leggere il documento: %s") % e)
            return

        system_prompt = _(
            "Leggi questo documento e trasformalo in una o piu' voci di conoscenza riusabili per "
            "istruire l'agente AI '%s' -- ogni voce deve essere un blocco autonomo di conoscenza o "
            "istruzione applicabile, non un riassunto narrativo del documento. Non inventare nulla "
            "che non sia nel testo. Rispondi SOLO con un oggetto JSON valido, senza markdown code "
            "fence, senza altro testo: "
            '{"entries": [{"title": "<titolo breve>", "content": "<voce di conoscenza>"}, ...]}'
        ) % self.agent_config_id.name

        bridge = self.env['erpv6.omni.bridge']
        result = bridge.execute_ai_task(
            task_type='agent_knowledge_extraction',
            payload={
                'temperature': 0.1,
                'messages': [
                    {'role': 'system', 'content': system_prompt},
                    {'role': 'user', 'content': doc_text[:12000]},
                ],
            },
            context={'source': 'erpv6_agent:action_extract_agent_knowledge', 'document_id': self.id},
        )
        if not result.get('success'):
            self.message_post(body=_("Estrazione conoscenza agente fallita: %s") % result.get('error'))
            return
        try:
            content = result['data']['choices'][0]['message']['content']
            parsed = json.loads(content)
            entries = parsed.get('entries', [])
        except (KeyError, IndexError, TypeError, json.JSONDecodeError) as e:
            self.message_post(body=_("Risposta AI in formato inatteso: %s") % e)
            return
        if not entries:
            self.message_post(body=_("Nessuna voce di conoscenza estratta dal documento."))
            return

        created = self.env['erpv6.kb']
        for entry in entries:
            if not entry.get('title') or not entry.get('content'):
                continue
            created |= self.env['erpv6.kb'].create({
                'name': entry['title'],
                'kb_type': 'metodo_v6',
                'category_id': self.agent_config_id.instructions_category_id.id,
                'content': entry['content'],
                'content_format': 'text',
                'access_level': 'ai_only',
                'is_active': True,
                'source_document_id': self.id,
                'agent_config_id': self.agent_config_id.id,
            })
        self.message_post(body=_("%(n)d voci di conoscenza create per l'agente '%(agent)s' da questo documento.") % {
            'n': len(created), 'agent': self.agent_config_id.name})
