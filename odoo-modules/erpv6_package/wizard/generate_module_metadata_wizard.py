# -*- coding: utf-8 -*-

from odoo import models, fields, api, _
from odoo.exceptions import UserError, ValidationError
import json
import logging

_logger = logging.getLogger(__name__)


class Erpv6PackageGenerateMetadataWizard(models.TransientModel):
    """
    TASK 2 - Wizard per generare automaticamente metadata di un modulo pacchetto
    a partire da un template Typst, usando l'AI tramite erpv6_omni_bridge.
    """
    _name = 'erpv6.package.generate.metadata.wizard'
    _description = 'Wizard Generazione Metadata Modulo Pacchetto'

    package_module_id = fields.Many2one(
        'erpv6.package.module',
        string='Modulo Pacchetto',
        required=True,
        help='Modulo per cui generare i metadata (required_fields, interview_questions, prompt)'
    )
    typst_template_id = fields.Many2one(
        'erpv6.typst.template',
        string='Template Typst',
        required=True,
        help='Template Typst da analizzare per estrarre i metadata richiesti'
    )

    def action_generate(self):
        """
        Chiama erpv6.omni.bridge.execute_ai_task con task_type='package_metadata_generation'
        per generare:
        (a) required_fields come JSON Schema
        (b) interview_questions come lista di domande in linguaggio naturale
        (c) il testo del prompt di generazione della sezione
        
        Poi scrive i risultati sul package_module_id e crea un record erpv6.kb per il prompt.
        """
        self.ensure_one()
        
        module = self.package_module_id
        template = self.typst_template_id
        
        # Ottieni il sorgente Typst dal template
        try:
            typst_source = template.get_typst_source()
        except Exception as e:
            raise UserError(_("Impossibile ottenere il sorgente Typst: %s") % str(e))
        
        # Prepara il contesto per l'AI
        context_prompt = f"""
Analizza questo template Typst e genera i metadata per un modulo pacchetto ERP V6.

TEMPLATE TYpst:
{typst_source}

Devi restituire UNICAMENTE un JSON strutturato con questa forma esatta:
{{
    "required_fields": {{ ... }},  // JSON Schema dei campi richiesti dal template
    "interview_questions": ["Domanda 1", "Domanda 2", ...],  // Lista di domande in linguaggio naturale
    "generation_prompt": "..."  // Prompt da usare per generare il contenuto di questa sezione
}}

Il JSON Schema deve seguire lo standard JSON Schema Draft 7 o superiore.
Le domande devono essere chiare e mirate a raccogliere i dati necessari per compilare i required_fields.
Il generation_prompt deve istruire un'AI su come generare il contenuto della sezione partendo dai dati raccolti.
"""
        
        # Chiama Omni Bridge per eseguire il task AI
        try:
            omni_bridge = self.env['erpv6.omni.bridge']
            result_json_str = omni_bridge.execute_ai_task(
                task_type='package_metadata_generation',
                prompt=context_prompt,
                context={'template_code': template.code, 'module_code': module.code}
            )
        except Exception as e:
            raise UserError(_("Errore durante la chiamata AI: %s") % str(e))
        
        # Parsing del risultato
        try:
            result = json.loads(result_json_str)
        except json.JSONDecodeError as e:
            raise UserError(_("L'AI non ha restituito un JSON valido: %s. Risposta ricevuta: %s") % (str(e), result_json_str[:500]))
        
        required_fields = result.get('required_fields', {})
        interview_questions_list = result.get('interview_questions', [])
        generation_prompt = result.get('generation_prompt', '')
        
        if not required_fields:
            raise UserError(_("L'AI non ha generato required_fields validi."))
        if not generation_prompt:
            raise UserError(_("L'AI non ha generato un prompt di generazione."))
        
        # Converte lista domande in testo (una per riga)
        interview_questions_text = '\n'.join(interview_questions_list) if interview_questions_list else ''
        
        # Cerca o crea categoria KB per i prompt di generazione documenti
        # DUBBIO: Non esiste una categoria KB predefinita specifica per "prompt_generazione_documenti"
        # Uso la prima categoria disponibile per kb_type='prompt' o ne segnalo la necessità
        kb_category = self.env['erpv6.kb.category'].search([
            ('kb_type', '=', 'prompt')
        ], limit=1)
        
        if not kb_category:
            # Se non esiste, la creo (alternativa: sollevare errore e chiedere all'utente)
            kb_category = self.env['erpv6.kb.category'].create({
                'name': 'Generazione Documenti',
                'kb_type': 'prompt',
                'description': 'Prompt per la generazione automatica di sezioni documento',
                'is_transversal': True,
            })
            _logger.info("Creata categoria KB 'Generazione Documenti' per prompt di generazione")
        
        # Crea il record KB per il prompt di generazione
        kb_record = self.env['erpv6.kb'].create({
            'name': f"Prompt Generazione - {module.name} ({module.code})",
            'description': f"Prompt per generare la sezione '{module.name}' del Business Plan",
            'kb_type': 'prompt',
            'category_id': kb_category.id,
            'content': generation_prompt,
            'content_format': 'text',
            'is_encrypted': False,  # I prompt non sono sensibili, ma si può cambiare
            'access_level': 'consultant',
            'source': 'AI Generated via Wizard',
        })
        
        # Aggiorna il modulo pacchetto con i metadata generati
        module.write({
            'required_fields': required_fields,
            'interview_questions': interview_questions_text,
            'generation_prompt_kb_id': kb_record.id,
            'typst_template_id': template.id,
        })
        
        _logger.info(f"Metadata generati con successo per modulo {module.code}: created KB {kb_record.id}")
        
        return {
            'type': 'ir.actions.client',
            'tag': 'display_notification',
            'params': {
                'title': _('Metadata Generati'),
                'message': _(f"Successo! Creato prompt KB #{kb_record.id} per il modulo {module.name}."),
                'type': 'success',
                'sticky': False,
            }
        }
