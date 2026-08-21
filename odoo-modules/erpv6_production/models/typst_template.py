import json
import logging
import re

from odoo import api, fields, models, _
from odoo.exceptions import UserError

_logger = logging.getLogger(__name__)


class TypstTemplate(models.Model):
    """Estende erpv6.typst.template (definito in erpv6_typst, motore
    a-settoriale che NON puo' dipendere da erpv6_omni_bridge senza creare un
    ciclo) con la BOZZA di sorgente Typst generata dall'AI -- stesso
    principio "AI propone, umano approva" gia' usato ovunque nel progetto (6
    Giudici, kb_case_study_match, kb_case_study_interview_generation): mai
    scrive typst_source direttamente, solo typst_source_draft. Solo un gate
    umano esplicito (action_promote_draft_to_source) copia la bozza nel
    sorgente reale, e solo dopo averla ricompilata con successo in quel
    momento -- vedi analisi 21/08/2026 (template #8 "Proposta Commerciale
    L2" con typst_source NULL, blocca da giorni le produzioni #7/#21/#22).

    Necessita di mail.thread/mail.activity.mixin (non presenti sul modello
    base) per lo stesso schema di attivita' to-do gia' usato da
    erpv6.library.document per il gate umano sul caso studio."""
    _name = 'erpv6.typst.template'
    _inherit = ['erpv6.typst.template', 'mail.thread', 'mail.activity.mixin']

    typst_source_draft = fields.Text(
        string="Bozza Sorgente Typst (AI)", copy=False,
        help="Bozza generata dall'AI (action_generate_typst_source_draft), MAI usata "
             "direttamente dal motore di rendering (erpv6.typst.engine legge solo "
             "typst_source) -- resta qui in attesa di revisione umana ed eventuale "
             "correzione manuale, poi promozione esplicita (action_promote_draft_to_source).")
    typst_draft_generated_at = fields.Datetime(string="Bozza generata il", copy=False)
    typst_draft_compile_ok = fields.Boolean(
        string="Bozza: compilazione riuscita", default=False, copy=False,
        help="Esito dell'ultima compilazione di PROVA della bozza (dati fittizi derivati "
             "da required_fields, stesso identico binario 'typst' usato in produzione) -- "
             "fatta SUBITO dopo la generazione, prima che un umano la veda, cosi' la "
             "revisione parte gia' sapendo se la bozza e' anche solo sintatticamente valida. "
             "Non sostituisce la revisione umana (compila correttamente puo' comunque "
             "produrre un documento sbagliato/incompleto nel contenuto), solo un primo "
             "filtro automatico che non fallisce mai in silenzio.")
    typst_draft_compile_error = fields.Text(string="Bozza: errore compilazione", copy=False)
    typst_draft_unknown_fields = fields.Char(
        string="Bozza: chiavi non in required_fields", copy=False,
        help="Controllo statico (non affidato all'AI): chiavi lette con data.at(\"...\") nella "
             "bozza ma assenti da required_fields -- probabile campo inventato dall'AI. Vuoto "
             "se il controllo non ha trovato nulla di sospetto.")

    def _resolve_required_fields(self):
        """required_fields e' definito sul template stesso, ma nel flusso
        caso-studio esistente (_create_template_interview_stub, vedi
        library_document.py) viene popolato solo sul erpv6.package.module
        collegato, MAI sul template -- gap preesistente, non introdotto ora.
        Qui si guarda prima il campo del template (fonte ufficiale secondo
        il docstring di erpv6.typst.template) e solo se vuoto si ripiega sul
        modulo collegato, cosi' la generazione bozza funziona per entrambi i
        casi reali senza dover prima sistemare quel gap altrove.

        Bug preesistente scoperto qui il 21/08/2026 (non introdotto ora, mai
        notato prima perche' nessun codice leggeva required_fields come
        oggetto reale a runtime): in data/typst_templates_data.xml il campo
        e' scritto come testo JSON grezzo dentro <field name="required_fields">
        senza indicazione di tipo -- il loader XML di Odoo lo tratta come
        stringa e lo salva cosi' com'e' nel jsonb, quindi fields.Json lo
        rilegge come un python str (il JSON di quella stringa), non come
        dict. Colpisce TUTTI i 7 template che valorizzano required_fields
        (sia quelli con typst_source vuoto sia i 4 interni gia' funzionanti,
        che pero' non hanno mai avuto bisogno di leggerlo). Qui si tollera
        anche questa forma (un ulteriore json.loads) invece di far fallire
        la generazione bozza per un problema di dati preesistente e
        indipendente -- ma il dato in DB resta comunque sbagliato, andrebbe
        corretto a monte (XML + migrazione dati) in un intervento dedicato."""
        self.ensure_one()
        required_fields = self.required_fields
        if isinstance(required_fields, str):
            try:
                required_fields = json.loads(required_fields)
            except (TypeError, ValueError):
                _logger.warning(
                    "required_fields del template #%s non e' un JSON valido anche come stringa "
                    "grezza, ignorato: %r", self.id, required_fields)
                required_fields = None
        if required_fields:
            return required_fields
        module = self.env['erpv6.package.module'].search(
            [('typst_template_id', '=', self.id)], limit=1)
        module_fields = module.required_fields or {}
        if isinstance(module_fields, str):
            try:
                module_fields = json.loads(module_fields)
            except (TypeError, ValueError):
                module_fields = {}
        return module_fields

    def _find_typst_few_shot_source(self):
        """Preferisce un sorgente .typ REALE (non vuoto) della stessa
        categoria; se non esiste, un qualsiasi altro sorgente reale esistente
        (es. i 4 template interni gia' scritti a mano) -- meglio un esempio
        fuori tema ma sintatticamente corretto che nessun esempio."""
        self.ensure_one()
        candidates = self.search([('id', '!=', self.id)]).filtered(
            lambda t: t.typst_source and t.typst_source.strip())
        same_category = candidates.filtered(lambda t: t.category == self.category)
        chosen = same_category[:1] or candidates[:1]
        return chosen.typst_source if chosen else None

    def _find_case_study_source_text(self):
        """Se questo template e' nato da un caso studio (erpv6.package.module
        collegato, generato da un erpv6.library.document via
        case_study_generated_package_module_ids -- vedi
        _create_template_interview_stub), recupera il testo grezzo del
        documento originale come contesto di stile/struttura per l'AI. Solo
        contesto opzionale: un template creato direttamente (es. #8, nato da
        dati XML senza nessun caso studio dietro) non ne ha, e la generazione
        deve funzionare comunque solo con required_fields + few-shot."""
        self.ensure_one()
        module = self.env['erpv6.package.module'].search(
            [('typst_template_id', '=', self.id)], limit=1)
        if not module:
            return None
        document = self.env['erpv6.library.document'].search(
            [('case_study_generated_package_module_ids', 'in', module.id)], limit=1)
        if not document or not document.file:
            return None
        try:
            return self.env['erpv6.kb.extraction.service'].extract_raw_text(
                document.file, document.file_name)
        except Exception:
            _logger.warning(
                "Impossibile estrarre il testo del caso studio sorgente per il template #%s, "
                "la generazione bozza procede senza quel contesto.", self.id)
            return None

    def action_generate_typst_source_draft(self):
        """Gate di ingresso umano (l'utente clicca il bottone): genera SOLO
        typst_source_draft, mai typst_source. Fallisce in modo esplicito (UserError)
        se manca lo schema campi -- senza required_fields l'AI non avrebbe idea di
        quali dati aspettarsi, meglio bloccarsi subito che generare a caso."""
        self.ensure_one()
        required_fields = self._resolve_required_fields()
        if not required_fields:
            raise UserError(_(
                "Nessuno schema campi (required_fields) disponibile per questo template, "
                "ne' sul template ne' su un erpv6.package.module collegato: la bozza AI non "
                "saprebbe quali campi generare. Valorizza required_fields prima di generare."))

        few_shot_source = self._find_typst_few_shot_source()
        source_text = self._find_case_study_source_text()
        category_label = dict(self._fields['category'].selection).get(self.category, self.category)

        system_prompt = (
            "Sei un generatore di sorgenti Typst (linguaggio di markup per documenti, "
            "www.typst.app) per un motore di rendering PDF interno. Scrivi SOLO codice "
            "Typst valido, nessun markdown code fence (niente ```), nessun testo prima o "
            "dopo il codice.\n\n"
            "REGOLE OBBLIGATORIE (violarle rompe la compilazione reale):\n"
            "1. La primissima riga deve essere esattamente: #let data = json(\"data.json\")\n"
            "2. Ogni accesso a un campo di 'data' deve usare .at(\"chiave\", default: ...) "
            "MAI data.chiave diretto e MAI presumere che una chiave esista sempre.\n"
            "3. Puoi usare SOLO le chiavi elencate nello schema campi fornito -- non "
            "inventarne altre.\n"
            "4. Per liste di oggetti annidati usa #for/.map(...).flatten() dentro una "
            "#table(), come nell'esempio.\n"
            "5. Imposta pagina A4, testo 10pt, lingua italiano, come nell'esempio.\n"
            "6. Il documento deve avere un titolo, e una sezione per ciascun campo dello "
            "schema, in un ordine leggibile.\n\n"
            + (
                "ESEMPIO di sorgente Typst reale e funzionante (stesso motore, altro "
                "template):\n-----\n" + few_shot_source + "\n-----\n"
                if few_shot_source else
                "Nessun esempio disponibile: segui rigorosamente le regole sopra.\n"
            )
        )
        user_content = _(
            "Genera il sorgente Typst per un template '%(category)s' a partire da questo "
            "schema di campi (le chiavi indicano cosa sara' disponibile in data.json a "
            "runtime, i valori reali cambieranno per ogni cliente):\n\n%(schema)s"
        ) % {'category': category_label, 'schema': json.dumps(required_fields, ensure_ascii=False, indent=2)}
        if source_text:
            user_content += _(
                "\n\nContesto: il documento originale da cui questo template e' derivato "
                "(estratto, solo per capire tono e struttura attesa, NON dati da riusare "
                "letteralmente):\n\n%s"
            ) % source_text[:3000]

        bridge = self.env['erpv6.omni.bridge']
        result = bridge.execute_ai_task(
            task_type='typst_source_generation',
            payload={
                'model': 'gpt-4-turbo',
                'temperature': 0.2,
                'messages': [
                    {'role': 'system', 'content': system_prompt},
                    {'role': 'user', 'content': user_content},
                ],
            },
            context={'source': 'typst_template:action_generate_typst_source_draft', 'template_id': self.id},
        )
        if not result.get('success'):
            self.message_post(body=_(
                "Generazione bozza sorgente Typst fallita: %(error)s\n\nRilancia manualmente "
                "l'azione quando il provider AI è di nuovo disponibile."
            ) % {'error': result.get('error', 'errore sconosciuto')})
            return False

        try:
            draft_source = result['data']['choices'][0]['message']['content']
        except (KeyError, IndexError, TypeError) as e:
            self.message_post(body=_(
                "Risposta AI in un formato inatteso durante la generazione della bozza: %s"
            ) % e)
            return False

        # Pulizia difensiva: anche con l'istruzione esplicita "niente code
        # fence", alcuni modelli lo aggiungono comunque -- gestito qui, MAI
        # nel motore di rendering reale (_generate_pdf_with_typst), che deve
        # restare invariato e non deve mai dover "indovinare" cosa pulire.
        draft_source = re.sub(r'^```[a-zA-Z]*\n|\n```$', '', draft_source.strip())

        unknown_fields = self._static_check_unknown_fields(draft_source, required_fields)
        compile_ok, compile_error = self._typst_compile_check(draft_source, required_fields)

        self.write({
            'typst_source_draft': draft_source,
            'typst_draft_generated_at': fields.Datetime.now(),
            'typst_draft_compile_ok': compile_ok,
            'typst_draft_compile_error': compile_error or False,
            'typst_draft_unknown_fields': ', '.join(unknown_fields) if unknown_fields else False,
        })

        warnings = []
        if not compile_ok:
            warnings.append(_("NON compila: %s") % compile_error)
        if unknown_fields:
            warnings.append(_("chiavi non presenti in required_fields: %s") % ', '.join(unknown_fields))
        status_line = (
            _("controllo automatico: %s") % " — ".join(warnings) if warnings
            else _("controllo automatico: compilazione di prova riuscita, nessuna chiave sospetta.")
        )
        self.message_post(body=_(
            "Bozza sorgente Typst generata dall'AI (%(status)s). Resta SOLO una bozza "
            "(typst_source_draft) -- nessun rendering reale usa questi dati finche' non viene "
            "promossa esplicitamente."
        ) % {'status': status_line})

        supervisor = self.env.ref(
            'erpv6_production.crm_lead_kb_admin', raise_if_not_found=False)
        user = supervisor.user_id if supervisor else self.env.user
        if user:
            self.activity_schedule(
                'mail.mail_activity_data_todo',
                summary=_("Revisiona bozza Typst AI: %s") % self.name,
                note=_(
                    "L'AI ha generato una bozza di sorgente Typst per questo template "
                    "(%(status)s). Revisiona il contenuto (scheda template, campo 'Bozza "
                    "Sorgente Typst (AI)'), correggila se serve, poi usa l'azione 'Promuovi "
                    "bozza a sorgente' per renderla il sorgente reale usato dal motore."
                ) % {'status': status_line},
                user_id=user.id,
            )
        return True

    def action_promote_draft_to_source(self):
        """Gate umano finale: copia typst_source_draft in typst_source SOLO
        dopo aver ricompilato la bozza ADESSO (non fidarsi del solo esito
        salvato al momento della generazione, che potrebbe essere vecchio se
        la bozza e' stata corretta a mano nel frattempo, o viceversa: un
        umano potrebbe aver rotto una bozza che compilava). Se non compila,
        blocca la promozione con un errore esplicito -- MAI un sorgente rotto
        silenziosamente promosso a "reale", che action_render() userebbe alla
        prossima produzione senza nessun altro controllo in mezzo."""
        self.ensure_one()
        if not self.typst_source_draft:
            raise UserError(_("Nessuna bozza da promuovere: genera prima una bozza."))
        required_fields = self._resolve_required_fields()
        compile_ok, compile_error = self._typst_compile_check(self.typst_source_draft, required_fields)
        if not compile_ok:
            raise UserError(_(
                "La bozza non compila (ricontrollato ora, non solo al momento della "
                "generazione): %(error)s\n\nCorreggila nel campo 'Bozza Sorgente Typst (AI)' "
                "prima di promuoverla a sorgente reale."
            ) % {'error': compile_error})
        self.write({
            'typst_source': self.typst_source_draft,
            'typst_draft_compile_ok': True,
            'typst_draft_compile_error': False,
        })
        self.message_post(body=_(
            "Sorgente Typst promosso dalla bozza AI (ricompilato con successo al momento "
            "della promozione). Da ora il motore di rendering (action_render) usa questo "
            "sorgente."
        ))
        return True

    def _static_check_unknown_fields(self, source, required_fields):
        """Controllo deterministico, non affidato alla buona volonta'
        dell'AI (che nel prompt e' comunque istruita a non farlo): estrae
        tutte le chiavi lette con data.at("chiave", ...) nella bozza e
        segnala quelle assenti da required_fields -- probabile campo
        inventato. Cerca SOLO il pattern data.at("...") (con virgolette
        obbligatorie), non un generico "data.qualcosa": la primissima riga
        obbligatoria del sorgente e' #let data = json("data.json"), che
        contiene letteralmente la sottostringa "data.json" -- un pattern piu'
        permissivo la segnalerebbe come falso positivo su OGNI bozza. Un
        falso negativo qui (chiave letta in un altro modo, es. accesso
        diretto data.chiave, gia' vietato dal prompt) non e' un rischio
        nuovo: la stessa chiave romperebbe comunque la compilazione di prova
        se non esiste nei dati fittizi, catturato da _typst_compile_check."""
        used_keys = set(re.findall(r'data\.at\(\s*["\']([a-zA-Z_][a-zA-Z0-9_]*)["\']', source or ''))
        allowed_keys = set((required_fields or {}).keys())
        return sorted(used_keys - allowed_keys)

    def _build_sample_data_from_schema(self, schema):
        """Dati fittizi minimi per una compilazione di PROVA (mai per un
        rendering reale, che continua a usare render_data vero via
        erpv6.typst.engine.generate_document) -- solo per verificare che il
        sorgente sia sintatticamente valido e usi le chiavi giuste, non che
        il contenuto finale sia corretto (quello resta compito della
        revisione umana). I tipi gestiti coprono ENTRAMBE le convenzioni
        required_fields viste realmente nel codebase: quella generata da
        _generate_case_study_interview (erpv6.package.module, sempre
        "type": "text") e quella scritta a mano su erpv6.typst.template
        stesso (es. template #8 "Proposta Commerciale L2": "object"/"array") --
        senza gestire anche queste ultime, un campo "object" riceverebbe una
        semplice stringa come dato fittizio e romperebbe la compilazione di
        prova di QUALSIASI bozza corretta che accede a un suo sotto-campo
        (es. data.at("client_info").at("name")), un falso negativo del
        controllo, non un problema della bozza."""
        sample = {}
        for key, meta in (schema or {}).items():
            field_type = (meta or {}).get('type', 'text')
            if field_type in ('list', 'array'):
                sample[key] = [{'value': _("Esempio")}, {'value': _("Esempio 2")}]
            elif field_type == 'object':
                sample[key] = {'value': _("Esempio")}
            else:
                sample[key] = _("Valore di esempio")
        return sample

    def _typst_compile_check(self, typst_source, required_fields=None):
        """Compila DAVVERO (stesso binario 'typst', stessa convenzione
        #let data = json("data.json") di erpv6.typst.document.
        _generate_pdf_with_typst) il sorgente passato con dati fittizi, in
        una directory temporanea isolata -- nessun erpv6.typst.document o
        erpv6.typst.template.typst_source viene toccato da questo controllo,
        serve solo a sapere PRIMA che un umano guardi la bozza (o prima di
        promuoverla) se almeno compila. Un fallimento qui non e' mai
        silenzioso: ritorna sempre (False, messaggio d'errore leggibile),
        mai un'eccezione non gestita che romperebbe il flusso di generazione
        bozza."""
        import os
        import shutil
        import subprocess
        import tempfile

        if not typst_source or not typst_source.strip():
            return False, _("Sorgente vuoto.")

        tmp_dir = tempfile.mkdtemp(prefix='erpv6_typst_draft_check_')
        typst_file = os.path.join(tmp_dir, 'document.typ')
        data_file = os.path.join(tmp_dir, 'data.json')
        pdf_file = os.path.join(tmp_dir, 'document.pdf')
        try:
            sample_data = self._build_sample_data_from_schema(required_fields or {})
            with open(typst_file, 'w') as f:
                f.write(typst_source)
            with open(data_file, 'w') as f:
                json.dump(sample_data, f)

            proc = subprocess.run(
                ['typst', 'compile', typst_file, pdf_file],
                capture_output=True, text=True, timeout=30,
            )
            if proc.returncode != 0:
                return False, proc.stderr or _("Errore di compilazione sconosciuto (nessun dettaglio da typst).")
            if not os.path.exists(pdf_file):
                return False, _("typst ha terminato senza errori ma non ha prodotto un PDF.")
            return True, ''
        except subprocess.TimeoutExpired:
            return False, _("Compilazione interrotta per timeout (30s).")
        except Exception as e:
            return False, str(e)
        finally:
            shutil.rmtree(tmp_dir, ignore_errors=True)
