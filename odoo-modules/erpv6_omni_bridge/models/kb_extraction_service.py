import base64
import io
import json
import logging

from odoo import api, models, _
from odoo.exceptions import UserError

from odoo.addons.erpv6_kb.models.kb_knowledge import KB_TYPE_SELECTION

_logger = logging.getLogger(__name__)

MAX_RAW_CHARS = 40000

EXTRACTION_SYSTEM_PROMPT = """Sei un motore di estrazione dati per la Knowledge Base aziendale di V6 Impresa.
Ti viene fornito il contenuto grezzo di un documento (tabellare o testuale) caricato da un consulente.
Estrai le voci di conoscenza strutturate SENZA inventare contenuto che non è presente nel testo fornito.
Se una riga/sezione non contiene conoscenza utile (es. intestazioni vuote), ignorala.

Per ogni voce identificabile produci un oggetto JSON con questi campi:
- "name": titolo breve della voce
- "kb_type": uno tra questi valori esatti, scegli il più adatto al contenuto: {kb_types}
  Se il contenuto non è chiaramente riconducibile a nessuno di questi, usa "metodo_v6".
- "category": nome breve di categoria (es. "IVA agricola", "Comunicazione DISC")
- "content": il testo completo della voce, fedele all'originale, non riassunto se non necessario

{extra_notes}

Rispondi SOLO con un array JSON valido (anche vuoto se non trovi nulla di utile), senza markdown code fence, senza altro testo."""


class Erpv6KbExtractionService(models.AbstractModel):
    """Motore condiviso: documento grezzo -> voci erpv6.kb strutturate via AI.

    Riusato sia dal wizard manuale (erpv6.kb.import.wizard) sia dal trigger
    automatico su erpv6.library.document (categoria 'kb_source') -- unica
    implementazione, nessuna duplicazione della logica di parsing/prompt/creazione.
    """
    _name = 'erpv6.kb.extraction.service'
    _description = 'Servizio di Estrazione KB da Documento (AI)'

    @api.model
    def extract_raw_text(self, file_data_b64, filename):
        if not file_data_b64:
            raise UserError(_("Nessun file fornito."))
        data = base64.b64decode(file_data_b64)
        filename = (filename or '').lower()

        if filename.endswith(('.xlsx', '.xlsm')):
            try:
                from openpyxl import load_workbook
            except ImportError:
                raise UserError(_("Libreria openpyxl non disponibile sul server."))
            wb = load_workbook(io.BytesIO(data), read_only=True, data_only=True)
            lines = []
            for sheet in wb.worksheets:
                lines.append(f"--- Foglio: {sheet.title} ---")
                for row_idx, row in enumerate(sheet.iter_rows(values_only=True), start=1):
                    cells = [str(c) for c in row if c is not None and str(c).strip()]
                    if cells:
                        lines.append(f"Riga {row_idx}: " + " | ".join(cells))
            return "\n".join(lines)

        try:
            return data.decode('utf-8')
        except UnicodeDecodeError:
            return data.decode('latin-1', errors='replace')

    @api.model
    def extract_kb_entries(self, file_data_b64, filename, notes=None):
        """Ritorna una lista di dict {name, kb_type, category, content} estratti via AI.

        Solleva UserError se l'estrazione fallisce (nessun provider attivo,
        risposta non valida, ecc.) -- il chiamante decide come gestirlo
        (mostrare all'utente nel wizard, o loggarlo nel chatter del documento).
        """
        raw_text = self.extract_raw_text(file_data_b64, filename)
        if not raw_text.strip():
            raise UserError(_("Nessun contenuto leggibile trovato nel documento."))

        truncated = raw_text[:MAX_RAW_CHARS]
        extra_notes = f"Note aggiuntive dell'utente: {notes}" if notes else ""
        system_prompt = EXTRACTION_SYSTEM_PROMPT.format(
            kb_types=", ".join(f'"{k}"' for k, _label in KB_TYPE_SELECTION),
            extra_notes=extra_notes,
        )

        payload = {
            'model': 'gpt-4-turbo',
            'temperature': 0.1,
            'messages': [
                {'role': 'system', 'content': system_prompt},
                {'role': 'user', 'content': truncated},
            ],
        }

        bridge = self.env['erpv6.omni.bridge']
        result = bridge.execute_ai_task(
            task_type='kb_extraction',
            payload=payload,
            context={'source': 'kb_extraction_service'},
        )

        if not result.get('success'):
            raise UserError(_(
                "Estrazione AI fallita: %s\n\n"
                "Nota: se nessun provider AI (OpenAI/Anthropic/Groq) ha una API Key attiva "
                "configurata in Impostazioni > V6 Impresa AI > OmniRoute > Provider, questo "
                "errore è atteso finché non ne viene attivato almeno uno."
            ) % result.get('error', 'errore sconosciuto'))

        raw_content = result.get('data', {})
        try:
            message_content = raw_content['choices'][0]['message']['content']
        except (KeyError, IndexError, TypeError):
            raise UserError(_(
                "Risposta AI in un formato inatteso, non riconducibile a una chat completion "
                "standard. Risposta grezza: %s"
            ) % json.dumps(raw_content)[:1000])

        message_content = message_content.strip()
        if message_content.startswith('```'):
            message_content = message_content.strip('`')
            if message_content.lower().startswith('json'):
                message_content = message_content[4:]
            message_content = message_content.strip()

        try:
            entries = json.loads(message_content)
        except json.JSONDecodeError as e:
            raise UserError(_(
                "L'AI non ha risposto con un JSON valido: %s\n\nContenuto ricevuto: %s"
            ) % (e, message_content[:1000]))

        if not isinstance(entries, list):
            raise UserError(_("L'AI non ha restituito un array di voci."))

        valid_kb_types = {k for k, _label in KB_TYPE_SELECTION}
        cleaned = []
        for entry in entries:
            if not isinstance(entry, dict):
                continue
            kb_type = entry.get('kb_type') if entry.get('kb_type') in valid_kb_types else 'metodo_v6'
            cleaned.append({
                'name': entry.get('name') or _('Senza titolo'),
                'kb_type': kb_type,
                'category': entry.get('category') or _('Generale'),
                'content': entry.get('content') or '',
            })
        return cleaned

    @api.model
    def create_kb_records(self, entries, source_label=None):
        """Crea (o riusa) le erpv6.kb.category necessarie e crea le erpv6.kb.

        :param entries: lista di dict {name, kb_type, category, content}
        :param source_label: valore per il campo 'source' di erpv6.kb
        :return: recordset erpv6.kb creati
        """
        category_model = self.env['erpv6.kb.category']
        kb_model = self.env['erpv6.kb']
        created = self.env['erpv6.kb']

        for entry in entries:
            category = category_model.search([
                ('name', '=', entry['category']),
                ('kb_type', '=', entry['kb_type']),
            ], limit=1)
            if not category:
                category = category_model.create({
                    'name': entry['category'],
                    'kb_type': entry['kb_type'],
                    'is_transversal': True,
                })
            kb = kb_model.create({
                'name': entry['name'],
                'kb_type': entry['kb_type'],
                'category_id': category.id,
                'content': entry['content'],
                'content_format': 'text',
                'source': source_label or 'kb_extraction_service',
                # Mai attiva subito: deve passare da erpv6_validation (6 Giudici)
                # prima di essere raggiungibile da find_best_for() -- vedi
                # erpv6_production/models/validation_session.py, dove
                # action_human_approve() la riattiva su res_model='erpv6.kb'.
                'is_active': False,
            })
            created |= kb
        return created
