import base64
import io
import json
import logging
import time

from odoo import api, models, _
from odoo.exceptions import UserError

from odoo.addons.erpv6_kb.models.kb_knowledge import KB_TYPE_SELECTION

_logger = logging.getLogger(__name__)


class _ChunkTruncatedError(Exception):
    """Interna: il modello ha troncato l'output (finish_reason='length')
    prima di chiudere il JSON. Diversa da un JSONDecodeError generico --
    qui la causa e' nota (output troppo lungo per il blocco) e riprovabile
    dimezzando il blocco, non un problema di formato/contenuto."""

# Groq tier gratuito impone un limite di 8000 token/minuto su openai/gpt-oss-120b
# (verificato dal vivo: la soglia "Requested" di Groq conta input + max_tokens
# riservato per l'output, non solo l'input effettivo -- una singola chiamata con
# troppo testo va in 413 "tokens per minute", una con testo moderato ma senza
# max_tokens esplicito si vede accorciare l'output a meta' JSON, invalido).
# Per documenti piu' grandi di un chunk, il testo viene spezzato ed elaborato
# a piu' chiamate sequenziali (l'utente ha scelto questa strada gratuita invece
# di un upgrade a pagamento del piano Groq).
CHUNK_MAX_CHARS = 8000
CHUNK_MAX_OUTPUT_TOKENS = 4000
# Il limite Groq e' una finestra scorrevole di 60s condivisa da tutte le chiamate
# dell'organizzazione: senza un piano a pagamento non c'e' altro modo per restare
# sotto soglia che aspettare che la chiamata precedente "esca" dalla finestra.
CHUNK_PACING_SECONDS = 65
# Se un blocco e' particolarmente denso (tante righe -> tante voci KB), il JSON
# di output puo' superare CHUNK_MAX_OUTPUT_TOKENS prima di chiudersi: il modello
# lo tronca a meta' stringa (finish_reason='length', non un problema di rate
# limit ne' di formato). SPLIT_MAX_DEPTH limita quante volte un blocco del
# genere viene dimezzato e riprovato prima di arrendersi con l'errore reale
# (evita di dimezzare all'infinito un blocco che fallisce per un'altra ragione).
CHUNK_SPLIT_MAX_DEPTH = 3

EXTRACTION_SYSTEM_PROMPT = """Sei un motore di estrazione dati per la Knowledge Base aziendale di V6 Impresa.
Ti viene fornito il contenuto grezzo di un documento (tabellare o testuale) caricato da un consulente.
Estrai le voci di conoscenza strutturate SENZA inventare contenuto che non è presente nel testo fornito.
Non fare allusioni, inferenze implicite o supposizioni: riporta solo ciò che è esplicitamente scritto nel testo, senza sottintendere, ipotizzare o suggerire informazioni non dichiarate.
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

        if filename.endswith('.pdf'):
            try:
                from PyPDF2 import PdfReader
            except ImportError:
                raise UserError(_("Libreria PyPDF2 non disponibile sul server."))
            reader = PdfReader(io.BytesIO(data))
            pages = [(page.extract_text() or '') for page in reader.pages]
            text = "\n".join(pages).strip()
            if not text:
                raise UserError(_(
                    "Il PDF non contiene testo estraibile (probabile scansione/immagine "
                    "senza OCR): questo server non ha un motore OCR configurato."
                ))
            return text

        if filename.endswith('.docx'):
            import zipfile
            from xml.etree import ElementTree
            try:
                with zipfile.ZipFile(io.BytesIO(data)) as z:
                    xml_bytes = z.read('word/document.xml')
            except (zipfile.BadZipFile, KeyError):
                raise UserError(_("File .docx non valido o corrotto."))
            ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
            root = ElementTree.fromstring(xml_bytes)
            paragraphs = []
            for p in root.iter(f"{{{ns['w']}}}p"):
                texts = [t.text or '' for t in p.iter(f"{{{ns['w']}}}t")]
                paragraphs.append(''.join(texts))
            return "\n".join(paragraphs)

        try:
            text = data.decode('utf-8')
        except UnicodeDecodeError:
            text = data.decode('latin-1', errors='replace')

        # Formati testuali generici (csv, xml, txt, md, ...) arrivano qui e
        # vanno bene cosi' come stringa grezza -- il prompt AI a valle decide
        # come interpretarli. Ma un file binario non riconosciuto sopra
        # (immagine, .doc legacy, ecc.) decodificato "a forza" con latin-1
        # produce sempre una stringa (non solleva mai UnicodeDecodeError),
        # quindi senza questo controllo verrebbe inviato all'AI come testo
        # illeggibile, sprecando la chiamata e producendo voci KB spazzatura.
        printable_ratio = sum(1 for c in text if c.isprintable() or c in '\n\r\t') / max(len(text), 1)
        if printable_ratio < 0.85:
            raise UserError(_(
                "Formato file non supportato per l'estrazione automatica del testo "
                "(probabile immagine o binario senza un parser dedicato). Formati "
                "supportati oggi: testo semplice, CSV, XML, .xlsx/.xlsm, .pdf (con testo, "
                "non scansioni), .docx."
            ))
        return text

    @api.model
    def _split_into_chunks(self, text, max_chars):
        """Spezza su un a-capo vicino al limite quando possibile, per non
        tagliare una riga di tabella a meta' e confondere il modello."""
        chunks = []
        start = 0
        length = len(text)
        while start < length:
            end = min(start + max_chars, length)
            if end < length:
                newline_pos = text.rfind('\n', start, end)
                if newline_pos > start:
                    end = newline_pos + 1
            chunks.append(text[start:end])
            start = end
        return chunks

    @api.model
    def estimate_extraction_plan(self, file_data_b64, filename):
        """Stima blocchi/tempo attesi PRIMA di lanciare l'estrazione vera e
        propria (sincrona, vedi extract_kb_entries) -- usata dal chiamante
        (erpv6_production/models/library_document.py) per notificare
        subito l'utente di quanto durera' probabilmente, invece di lasciarlo
        senza segnali per diversi minuti su un documento grande. Riusa
        extract_raw_text/_split_into_chunks (stessa logica di
        extract_kb_entries, nessuna duplicazione) -- solleva la stessa
        UserError di extract_raw_text se il file non e' leggibile; il
        chiamante puo' ignorarla e lasciare che extract_kb_entries la
        risollevi (parsing di un file e' economico, non ripete alcuna
        chiamata AI)."""
        raw_text = self.extract_raw_text(file_data_b64, filename)
        chunk_count = len(self._split_into_chunks(raw_text, CHUNK_MAX_CHARS))
        return {
            'chunk_count': chunk_count,
            'estimated_seconds': chunk_count * CHUNK_PACING_SECONDS,
        }

    @api.model
    def _resolve_route_and_model(self):
        # Il payload viene inviato cosi' com'e' al provider che il bridge sceglie
        # (vedi erpv6.omni.bridge.execute_ai_task, che non adatta 'model' in base
        # al provider effettivo) -- usiamo il modello del provider primario di
        # QUESTA route invece di un default fisso, cosi' almeno il percorso
        # primario ha un nome di modello valido. Se il primario fallisce e il
        # bridge passa a un fallback, quel provider potrebbe non avere questo
        # stesso modello -- gap noto nel bridge, non risolvibile da qui senza
        # cambiare execute_ai_task per ogni altra route che lo usa.
        route = self.env['erpv6.omni.route.config'].search([
            ('task_type', '=', 'kb_extraction'), ('is_active', '=', True),
        ], limit=1)
        model = route.primary_provider_id.get_optimal_model('kb_extraction') if route and route.primary_provider_id else None
        return model or 'gpt-4-turbo'

    @api.model
    def _call_and_parse_chunk(self, system_prompt, chunk_text, model, chunk_label):
        payload = {
            'model': model,
            'temperature': 0.1,
            'max_tokens': CHUNK_MAX_OUTPUT_TOKENS,
            'messages': [
                {'role': 'system', 'content': system_prompt},
                {'role': 'user', 'content': chunk_text},
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
                "Estrazione AI fallita (%(chunk)s): %(error)s\n\n"
                "Nota: se nessun provider AI (OpenAI/Anthropic/Groq) ha una API Key attiva "
                "configurata in Impostazioni > V6 Impresa AI > OmniRoute > Provider, questo "
                "errore è atteso finché non ne viene attivato almeno uno."
            ) % {'chunk': chunk_label, 'error': result.get('error', 'errore sconosciuto')})

        raw_content = result.get('data', {})
        try:
            choice = raw_content['choices'][0]
            message_content = choice['message']['content']
        except (KeyError, IndexError, TypeError):
            raise UserError(_(
                "Risposta AI in un formato inatteso (%(chunk)s), non riconducibile a una chat "
                "completion standard. Risposta grezza: %(raw)s"
            ) % {'chunk': chunk_label, 'raw': json.dumps(raw_content)[:1000]})

        # finish_reason='length' (schema OpenAI-compatibile, valido anche per
        # Groq) e' l'unico segnale affidabile che l'output e' stato tagliato
        # per CHUNK_MAX_OUTPUT_TOKENS -- serve a distinguere questo caso
        # (riprovabile dimezzando il blocco) da un JSON davvero malformato
        # (finish_reason='stop', errore reale non riprovabile allo stesso modo).
        truncated_by_length = choice.get('finish_reason') == 'length'

        message_content = message_content.strip()
        if message_content.startswith('```'):
            message_content = message_content.strip('`')
            if message_content.lower().startswith('json'):
                message_content = message_content[4:]
            message_content = message_content.strip()

        try:
            entries = json.loads(message_content)
        except json.JSONDecodeError as e:
            if truncated_by_length:
                raise _ChunkTruncatedError(
                    f"{chunk_label}: output troncato per limite lunghezza (finish_reason=length)")
            raise UserError(_(
                "L'AI non ha risposto con un JSON valido (%(chunk)s): %(err)s\n\n"
                "Contenuto ricevuto: %(raw)s"
            ) % {'chunk': chunk_label, 'err': e, 'raw': message_content[:1000]})

        if not isinstance(entries, list):
            raise UserError(_("L'AI non ha restituito un array di voci (%s).") % chunk_label)

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
    def _extract_chunk_with_split_retry(self, system_prompt, chunk_text, model, chunk_label, call_state, depth=0):
        """Chiama _call_and_parse_chunk con pacing condiviso (call_state['calls']
        conta le chiamate AI reali fatte finora in questa estrazione, per
        rispettare CHUNK_PACING_SECONDS anche tra le sotto-chiamate di uno split,
        non solo tra i blocchi di primo livello). Su troncamento per lunghezza
        (_ChunkTruncatedError) dimezza il blocco e riprova ricorsivamente fino a
        CHUNK_SPLIT_MAX_DEPTH: un blocco denso si adatta da solo invece di far
        fallire l'intera estrazione per un limite di output, non di contenuto."""
        if call_state['calls'] > 0:
            _logger.info(
                "Estrazione KB: pausa di %ss prima di %s (limite gratuito Groq)",
                CHUNK_PACING_SECONDS, chunk_label)
            time.sleep(CHUNK_PACING_SECONDS)
        call_state['calls'] += 1

        try:
            return self._call_and_parse_chunk(system_prompt, chunk_text, model, chunk_label)
        except _ChunkTruncatedError:
            if depth >= CHUNK_SPLIT_MAX_DEPTH or len(chunk_text) < 500:
                raise UserError(_(
                    "L'AI continua a troncare l'output per %(chunk)s anche dopo %(depth)d "
                    "tentativi di dimezzamento del blocco: il contenuto in questa porzione "
                    "del documento è troppo denso per il limite di output configurato. "
                    "Valuta di caricare questa parte del documento separatamente, in un file "
                    "più piccolo."
                ) % {'chunk': chunk_label, 'depth': depth})
            half = max(len(chunk_text) // 2, 1)
            sub_chunks = self._split_into_chunks(chunk_text, half)
            _logger.info(
                "Estrazione KB: %s troncato per lunghezza, diviso in %d sotto-blocchi (tentativo %d/%d)",
                chunk_label, len(sub_chunks), depth + 1, CHUNK_SPLIT_MAX_DEPTH)
            entries = []
            for sub_idx, sub_text in enumerate(sub_chunks, start=1):
                sub_label = f"{chunk_label}.{sub_idx}"
                entries.extend(self._extract_chunk_with_split_retry(
                    system_prompt, sub_text, model, sub_label, call_state, depth=depth + 1))
            return entries

    @api.model
    def extract_kb_entries(self, file_data_b64, filename, notes=None):
        """Ritorna una lista di dict {name, kb_type, category, content} estratti via AI.

        Documenti piu' grandi di CHUNK_MAX_CHARS vengono spezzati in piu' chiamate
        sequenziali (col limite gratuito Groq -- vedi commento su CHUNK_PACING_SECONDS
        in testa al file) e i risultati aggregati. Solleva UserError se un qualsiasi
        chunk fallisce (nessun provider attivo, risposta non valida, ecc.) -- il
        chiamante decide come gestirlo (mostrare all'utente nel wizard, o loggarlo
        nel chatter del documento). Le voci dei chunk gia' riusciti prima del
        fallimento vengono scartate (nessuna KB parziale/incoerente creata a valle).
        """
        raw_text = self.extract_raw_text(file_data_b64, filename)
        if not raw_text.strip():
            raise UserError(_("Nessun contenuto leggibile trovato nel documento."))

        extra_notes = f"Note aggiuntive dell'utente: {notes}" if notes else ""
        system_prompt = EXTRACTION_SYSTEM_PROMPT.format(
            kb_types=", ".join(f'"{k}"' for k, _label in KB_TYPE_SELECTION),
            extra_notes=extra_notes,
        )
        model = self._resolve_route_and_model()
        chunks = self._split_into_chunks(raw_text, CHUNK_MAX_CHARS)

        all_entries = []
        total = len(chunks)
        call_state = {'calls': 0}
        for idx, chunk in enumerate(chunks, start=1):
            chunk_label = f"blocco {idx}/{total}"
            all_entries.extend(self._extract_chunk_with_split_retry(
                system_prompt, chunk, model, chunk_label, call_state))

        return all_entries

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
