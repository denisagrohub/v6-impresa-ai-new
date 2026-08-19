import base64
import io
import json
import logging
import re
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


class _ChunkRateLimitedError(Exception):
    """Interna: il provider ha rifiutato la chiamata con un 429 reale
    (rate limit), diverso da un troncamento per lunghezza o da un errore di
    formato -- riprovabile aspettando piu' a lungo, non dimezzando il blocco."""

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
# Pavimento di max_tokens per i sotto-blocchi di uno split: un sotto-blocco
# piccolo non ha bisogno di 4000 token riservati, ma non si scende mai sotto
# questa soglia per lasciare comunque margine a voci KB verbose.
CHUNK_MIN_OUTPUT_TOKENS = 800
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
# CHUNK_MAX_CHARS da solo non basta: e' un proxy per la dimensione
# dell'INPUT, non dell'OUTPUT. Una riga tabellare compatta (es. export
# .xlsx, "Riga N: campo1 | campo2 | ...") va espansa in un oggetto JSON con
# piu' chiavi nominate per esteso -- l'output di una singola voce puo'
# superare il testo sorgente della riga stessa. Un blocco con molte voci
# dense puo' quindi restare ben sotto CHUNK_MAX_CHARS eppure produrre un
# output che tronca comunque (verificato dal vivo sul blocco 6 del
# documento #9: 7564 caratteri ma 21 voci tabellari dense, troncato anche
# dopo 3 dimezzamenti per caratteri -- il dimezzamento restava ancorato ai
# caratteri di input, mai al numero di voci da generare). CHUNK_MAX_ENTRIES
# limita quante righe non vuote entrano in un singolo blocco,
# indipendentemente da CHUNK_MAX_CHARS.
CHUNK_MAX_ENTRIES = 10
# Un 429 reale (a differenza del troncamento per lunghezza) puo' capitare anche
# con un pacing corretto, perche' la finestra di 60s e' condivisa a livello di
# organizzazione Groq (non solo dalle chiamate di questa estrazione) -- si
# riprova con un'attesa extra crescente invece di abortire subito l'estrazione.
CHUNK_RATE_LIMIT_MAX_RETRIES = 3
# erpv6.omni.provider.is_available() (omni_provider.py) ha un circuit breaker
# con cooldown FISSO di 5 minuti su QUALSIASI errore del provider, non solo un
# 429 -- verificato dal vivo sul documento #9: dopo un 429 reale, un retry a
# 130s e' arrivato PRIMA che il cooldown finisse, quindi il circuit breaker ha
# bloccato la chiamata ancora prima di provare Groq (l'errore diventa
# generico "Tutti i provider hanno fallito. Ultimo errore: None", non un 429),
# e senza riconoscerlo come rate limit l'estrazione abortiva comunque.
# L'attesa deve superare SEMPRE questo cooldown, non il pacing Groq normale.
CHUNK_RATE_LIMIT_WAIT_SECONDS = 310
# Ogni tot blocchi di primo livello completati, le voci estratte finora vengono
# salvate/commitate e mandate in validazione (vedi library_document.py,
# _commit_kb_extraction_batch) invece di aspettare la fine dell'intero
# documento -- un fallimento successivo non fa perdere il lavoro gia' fatto.
KB_BATCH_SIZE = 5
# Nome fisso (non tradotto: usato come chiave di ricerca in get_or_create, una
# traduzione diversa per lingua romperebbe il match) della categoria di
# transito per le voci KB appena estratte, prima della validazione 6 Giudici --
# vedi erpv6_production/models/validation_session.py per lo spostamento nella
# categoria reale suggerita dall'AI al momento dell'approvazione.
KB_STAGING_CATEGORY_NAME = "KB estratte — in attesa di validazione"

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
            # Riga vuota tra le pagine (non un singolo \n): e' il confine di
            # sezione reale piu' affidabile che abbiamo su un PDF senza
            # struttura esplicita, usato da _split_into_chunks per non
            # spezzare mai una pagina a meta' finche' non e' necessario.
            text = "\n\n".join(pages).strip()
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
            # Riga vuota tra i paragrafi (non un singolo \n): stesso motivo
            # del PDF sopra, e' il vero confine di paragrafo del .docx.
            return "\n\n".join(paragraphs)

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
    def _split_into_sections(self, text):
        """Divide il testo in sezioni "atomiche" che _split_into_chunks non
        spezzera' mai (a meno che una sezione da sola non superi
        max_chars) -- una sezione e' un blocco tra righe vuote (paragrafo
        .docx, pagina .pdf, vedi extract_raw_text) oppure un foglio .xlsx
        (marcatore "--- Foglio: " gia' presente nel testo, mai inventato).
        Testo senza alcuna riga vuota (es. .txt/.csv senza struttura)
        produce una sola sezione -- degrada a comportamento identico a prima
        (l'intera stringa passa dal fallback di taglio per lunghezza)."""
        # Split su 2+ a-capo consecutivi, MA forza anche un confine subito
        # prima di ogni "--- Foglio:" (l'export xlsx non mette righe vuote
        # tra le righe di uno stesso foglio, solo tra fogli diversi).
        text = re.sub(r'(?m)^(--- Foglio: )', r'\n\n\1', text)
        raw_sections = re.split(r'\n\s*\n+', text)
        return [s for s in (section.strip('\n') for section in raw_sections) if s]

    @api.model
    def _count_entries(self, text):
        """Righe non vuote in text -- proxy generico per il numero di
        "voci" da estrarre (per .xlsx corrisponde esattamente al numero di
        righe tabellari, una per voce KB, vedi extract_raw_text; per PDF/
        docx e' una stima piu' approssimativa ma comunque un argine utile
        contro blocchi troppo densi di output, vedi CHUNK_MAX_ENTRIES)."""
        return sum(1 for line in text.splitlines() if line.strip())

    @api.model
    def _limit_end_by_entries(self, text, start, end, max_lines):
        """Restringe [start:end) al piu' vicino a-capo dopo la
        max_lines-esima riga non vuota, se il segmento ne contiene di piu'
        -- non allarga mai end oltre il valore gia' calcolato per
        rispettare max_chars, lo restringe solo se necessario."""
        count = 0
        pos = start
        for line in text[start:end].splitlines(keepends=True):
            if line.strip():
                count += 1
            pos += len(line)
            if count >= max_lines:
                return pos
        return end

    @api.model
    def _split_oversized_section(self, text, max_chars, max_lines=None):
        """Spezza una singola sezione troppo grande per un blocco, su un
        a-capo vicino al limite quando possibile (stesso fallback di sempre,
        per non tagliare una riga di tabella a meta' e confondere il
        modello). Se max_lines e' passato, restringe ulteriormente ogni
        pezzo a al piu' max_lines righe non vuote (vedi CHUNK_MAX_ENTRIES)."""
        chunks = []
        start = 0
        length = len(text)
        while start < length:
            end = min(start + max_chars, length)
            if end < length:
                newline_pos = text.rfind('\n', start, end)
                if newline_pos > start:
                    end = newline_pos + 1
            if max_lines:
                end = self._limit_end_by_entries(text, start, end, max_lines)
            chunks.append(text[start:end])
            start = end
        return chunks

    @api.model
    def _split_into_chunks(self, text, max_chars, max_lines=None):
        """Pacchettizza il testo per sezioni intere (vedi
        _split_into_sections) invece che per taglio cieco a N caratteri: una
        sezione entra intera in un blocco finche' c'e' spazio, e viene
        spezzata internamente (_split_oversized_section, fallback identico
        al vecchio comportamento) solo se da sola supera max_chars O
        max_lines (voci non vuote, vedi CHUNK_MAX_ENTRIES). Cosi' i blocchi
        mandati ai 6 Giudici sono sezioni coerenti e complete, non frammenti
        a meta' capitolo, finche' non e' l'unica strada per rispettare il
        limite di output del modello -- ne' per caratteri (input) ne' per
        numero di voci (proxy dell'output, vedi CHUNK_MAX_ENTRIES)."""
        sections = self._split_into_sections(text)
        chunks = []
        current = ''
        for section in sections:
            oversized = len(section) > max_chars or (
                max_lines and self._count_entries(section) > max_lines)
            if oversized:
                if current:
                    chunks.append(current)
                    current = ''
                chunks.extend(self._split_oversized_section(section, max_chars, max_lines))
                continue
            candidate = f"{current}\n\n{section}" if current else section
            candidate_oversized = len(candidate) > max_chars or (
                max_lines and self._count_entries(candidate) > max_lines)
            if candidate_oversized and current:
                chunks.append(current)
                current = section
            else:
                current = candidate
        if current:
            chunks.append(current)
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
        chunk_count = len(self._split_into_chunks(raw_text, CHUNK_MAX_CHARS, max_lines=CHUNK_MAX_ENTRIES))
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
    def _call_and_parse_chunk(self, system_prompt, chunk_text, model, chunk_label, max_tokens=None):
        payload = {
            'model': model,
            'temperature': 0.1,
            'max_tokens': max_tokens or CHUNK_MAX_OUTPUT_TOKENS,
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
            error_text = result.get('error', 'errore sconosciuto')
            # execute_ai_task propaga str(HTTPError) da requests.raise_for_status()
            # cosi' com'e' -- un 429 reale contiene sempre questo testo, distinto
            # da qualsiasi altro errore (chiave mancante, formato, timeout...).
            # "Ultimo errore: None" e' il secondo segnale: il circuit breaker di
            # is_available() ha bloccato TUTTI i provider prima ancora di
            # provarli (cooldown post-429 non ancora scaduto, vedi
            # CHUNK_RATE_LIMIT_WAIT_SECONDS) -- anche questo e' transitorio,
            # NON un errore di configurazione reale (quello avrebbe un
            # last_error concreto, non None, dopo "Ultimo errore:").
            circuit_breaker_blocked = error_text.rstrip().endswith('Ultimo errore: None')
            if '429' in error_text or 'too many requests' in error_text.lower() or circuit_breaker_blocked:
                raise _ChunkRateLimitedError(f"{chunk_label}: {error_text}")
            raise UserError(_(
                "Estrazione AI fallita (%(chunk)s): %(error)s\n\n"
                "Nota: se nessun provider AI (OpenAI/Anthropic/Groq) ha una API Key attiva "
                "configurata in Impostazioni > V6 Impresa AI > OmniRoute > Provider, questo "
                "errore è atteso finché non ne viene attivato almeno uno."
            ) % {'chunk': chunk_label, 'error': error_text})

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

        if message_content is None:
            # Modelli "reasoning" (es. Gemini 3.6) possono restituire
            # message.content=None con finish_reason='length' quando il
            # budget di max_tokens si esaurisce nel ragionamento interno
            # prima di produrre testo -- stesso rimedio del troncamento
            # normale (dimezzare il blocco riduce anche il ragionamento
            # necessario). Se invece finish_reason non e' 'length', un
            # content nullo e' davvero inatteso: mai inventare un
            # risultato vuoto, va segnalato con la risposta grezza.
            if truncated_by_length:
                raise _ChunkTruncatedError(
                    f"{chunk_label}: nessun contenuto testuale nella risposta "
                    "(probabile budget di reasoning esaurito) con finish_reason=length"
                )
            raise UserError(_(
                "Risposta AI senza contenuto testuale (%(chunk)s), finish_reason=%(reason)s. "
                "Risposta grezza: %(raw)s"
            ) % {'chunk': chunk_label, 'reason': choice.get('finish_reason'), 'raw': json.dumps(raw_content)[:1000]})

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
    def _extract_chunk_with_split_retry(self, system_prompt, chunk_text, model, chunk_label, call_state,
                                          depth=0, max_tokens=None):
        """Chiama _call_and_parse_chunk con pacing condiviso (call_state['calls']
        conta le chiamate AI reali fatte finora in questa estrazione, per
        rispettare CHUNK_PACING_SECONDS anche tra le sotto-chiamate di uno split,
        non solo tra i blocchi di primo livello). Gestisce due errori riprovabili
        in modo diverso: su troncamento per lunghezza (_ChunkTruncatedError)
        dimezza il blocco e riprova ricorsivamente fino a CHUNK_SPLIT_MAX_DEPTH
        (un blocco denso si adatta da solo); su rate limit reale
        (_ChunkRateLimitedError) NON dimezza (il blocco non e' il problema) ma
        riprova lo stesso blocco con un'attesa extra crescente, fino a
        CHUNK_RATE_LIMIT_MAX_RETRIES."""
        if call_state['calls'] > 0:
            _logger.info(
                "Estrazione KB: pausa di %ss prima di %s (limite gratuito Groq)",
                CHUNK_PACING_SECONDS, chunk_label)
            time.sleep(CHUNK_PACING_SECONDS)
        call_state['calls'] += 1
        effective_max_tokens = max_tokens or CHUNK_MAX_OUTPUT_TOKENS

        rate_limit_retries = 0
        while True:
            try:
                return self._call_and_parse_chunk(
                    system_prompt, chunk_text, model, chunk_label, effective_max_tokens)
            except _ChunkRateLimitedError as e:
                rate_limit_retries += 1
                if rate_limit_retries > CHUNK_RATE_LIMIT_MAX_RETRIES:
                    raise UserError(_(
                        "Limite di richieste Groq superato per %(chunk)s anche dopo %(n)d tentativi "
                        "extra di attesa: il servizio AI è sovraccarico, verosimilmente da altro "
                        "traffico sull'organizzazione Groq e non solo da questa estrazione. "
                        "Dettaglio: %(error)s"
                    ) % {'chunk': chunk_label, 'n': CHUNK_RATE_LIMIT_MAX_RETRIES, 'error': str(e)})
                # Deve sempre superare CHUNK_RATE_LIMIT_WAIT_SECONDS (il
                # cooldown fisso del circuit breaker, vedi sopra) -- un
                # pacing crescente ma piu' corto di quello e' garantito che
                # fallisca di nuovo, verificato dal vivo sul documento #9.
                wait_seconds = CHUNK_RATE_LIMIT_WAIT_SECONDS + CHUNK_PACING_SECONDS * (rate_limit_retries - 1)
                _logger.warning(
                    "Estrazione KB: rate limit/circuit breaker su %s, attesa extra di %ss (tentativo %d/%d)",
                    chunk_label, wait_seconds, rate_limit_retries, CHUNK_RATE_LIMIT_MAX_RETRIES)
                time.sleep(wait_seconds)
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
                half_entries = max(self._count_entries(chunk_text) // 2, 1)
                sub_chunks = self._split_into_chunks(chunk_text, half, max_lines=half_entries)
                # Un sotto-blocco piu' piccolo non ha bisogno del budget di
                # output pieno riservato al blocco originale -- ridurlo
                # proporzionalmente abbassa anche il totale di token
                # richiesti (input+max_tokens) nella finestra scorrevole di
                # Groq, che e' esattamente cio' che ha fatto scattare il 429
                # reale sul documento #9 quando piu' blocchi si spezzavano
                # nella stessa finestra.
                sub_max_tokens = max(
                    CHUNK_MIN_OUTPUT_TOKENS,
                    min(CHUNK_MAX_OUTPUT_TOKENS, round(CHUNK_MAX_OUTPUT_TOKENS * half / CHUNK_MAX_CHARS)))
                _logger.info(
                    "Estrazione KB: %s troncato per lunghezza, diviso in %d sotto-blocchi "
                    "(tentativo %d/%d, max_tokens %d)",
                    chunk_label, len(sub_chunks), depth + 1, CHUNK_SPLIT_MAX_DEPTH, sub_max_tokens)
                entries = []
                for sub_idx, sub_text in enumerate(sub_chunks, start=1):
                    sub_label = f"{chunk_label}.{sub_idx}"
                    entries.extend(self._extract_chunk_with_split_retry(
                        system_prompt, sub_text, model, sub_label, call_state,
                        depth=depth + 1, max_tokens=sub_max_tokens))
                return entries

    @api.model
    def extract_kb_entries(self, file_data_b64, filename, notes=None, start_chunk_index=0, on_batch_complete=None):
        """Ritorna una lista di dict {name, kb_type, category, content} estratti via AI.

        Documenti piu' grandi di CHUNK_MAX_CHARS vengono spezzati in piu' chiamate
        sequenziali (col limite gratuito Groq -- vedi commento su CHUNK_PACING_SECONDS
        in testa al file) e i risultati aggregati. Solleva UserError se un qualsiasi
        chunk fallisce dopo aver esaurito i retry (nessun provider attivo, risposta
        non valida, rate limit persistente, ecc.) -- il chiamante decide come
        gestirlo (mostrare all'utente nel wizard, o loggarlo nel chatter del
        documento).

        :param start_chunk_index: indice (0-based) del primo blocco di primo
            livello da elaborare -- permette di riprendere un'estrazione fallita
            a meta' senza rielaborare (e duplicare) i blocchi gia' completati in
            un tentativo precedente (vedi library_document.py, che passa qui il
            campo persistito kb_extraction_completed_chunks).
        :param on_batch_complete: callback opzionale invocata ogni KB_BATCH_SIZE
            blocchi di primo livello completati (e sull'ultimo blocco del
            documento), con (entries_del_batch, indice_1based_ultimo_blocco).
            Permette al chiamante di salvare/commitare il lavoro incrementalmente
            invece di perdere tutto un documento lungo per un fallimento verso la
            fine (vedi library_document.py/_commit_kb_extraction_batch). Se non
            passata, il comportamento resta tutto-o-niente come prima.
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
        chunks = self._split_into_chunks(raw_text, CHUNK_MAX_CHARS, max_lines=CHUNK_MAX_ENTRIES)
        total = len(chunks)

        all_entries = []
        batch_entries = []
        call_state = {'calls': 0}
        for idx in range(start_chunk_index, total):
            chunk_number = idx + 1
            chunk_label = f"blocco {chunk_number}/{total}"
            entries = self._extract_chunk_with_split_retry(
                system_prompt, chunks[idx], model, chunk_label, call_state)
            all_entries.extend(entries)
            batch_entries.extend(entries)
            is_last_chunk = chunk_number == total
            if on_batch_complete and (chunk_number % KB_BATCH_SIZE == 0 or is_last_chunk):
                on_batch_complete(batch_entries, chunk_number)
                batch_entries = []

        return all_entries

    @api.model
    def create_kb_records(self, entries, source_label=None):
        """Crea (o riusa) le erpv6.kb.category necessarie e crea le erpv6.kb.

        Le voci vengono create nella categoria di transito KB_STAGING_CATEGORY_NAME
        (una per kb_type), NON nella categoria suggerita dall'AI (entry['category'],
        salvata comunque in suggested_category_name) -- finche' una voce non e'
        approvata dai 6 Giudici non deve comparire mescolata a voci gia' validate
        nella categoria di business reale (es. "IVA agricola"). Lo spostamento
        nella categoria reale avviene in erpv6_production/models/validation_session.py
        (action_human_approve) al momento dell'approvazione.

        :param entries: lista di dict {name, kb_type, category, content}
        :param source_label: valore per il campo 'source' di erpv6.kb
        :return: recordset erpv6.kb creati
        """
        category_model = self.env['erpv6.kb.category']
        kb_model = self.env['erpv6.kb']
        created = self.env['erpv6.kb']

        for entry in entries:
            # (name, kb_type) e' univoco a livello DB (erpv6_kb_name_unique).
            # Una voce puo' ripresentarsi identica tra blocchi diversi --
            # tipicamente riprendendo un'estrazione interrotta dopo che i
            # parametri di suddivisione blocchi sono cambiati (il checkpoint
            # kb_extraction_completed_chunks salvato non corrisponde piu' agli
            # stessi confini nella nuova suddivisione, quindi si puo' rientrare
            # su contenuto gia' estratto in precedenza). Senza questo controllo
            # l'INSERT falliva con IntegrityError e mandava in abort l'intera
            # transazione della sessione di estrazione, perdendo anche il
            # lavoro valido gia' fatto nello stesso batch.
            if kb_model.search_count([
                ('name', '=', entry['name']), ('kb_type', '=', entry['kb_type']),
            ]):
                _logger.warning(
                    "Estrazione KB: voce '%s' (kb_type=%s) gia' esistente, saltata "
                    "(probabile sovrapposizione con contenuto gia' estratto in "
                    "precedenza).", entry['name'], entry['kb_type'])
                continue
            staging_category = category_model.get_or_create(
                KB_STAGING_CATEGORY_NAME, entry['kb_type'], is_transversal=True)
            kb = kb_model.create({
                'name': entry['name'],
                'kb_type': entry['kb_type'],
                'category_id': staging_category.id,
                'suggested_category_name': entry['category'],
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
