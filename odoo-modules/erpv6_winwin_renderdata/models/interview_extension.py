import base64
import io
import logging

from odoo import _, fields, models
from odoo.exceptions import UserError

_logger = logging.getLogger(__name__)

# Field key -> campo su erpv6.production.order, per l'estrazione automatica
# dal bilancio/visura caricati (Percorso B) e per il fallback a domanda
# diretta (Percorso A) quando l'estrazione non trova un valore. Unica fonte
# di verita' per questa mappatura, usata sia da _extract_bilancio_from_attachment
# sia (implicitamente) dalle domande dirette in
# data/interview_question_bilancio_data.xml (stessi field_key).
BILANCIO_FIELD_MAP = {
    'oneri_finanziari': 'interview_oneri_finanziari',
    'ebitda': 'interview_ebitda',
    'debito_finanziario': 'interview_debito_finanziario',
    'data_ultima_visura': 'interview_data_ultima_visura',
    'contenzioso_in_corso': 'interview_contenzioso_in_corso',
    # Aggiunti dopo il primo giro di test (Denis/Motore, 05/09/2026): senza
    # questi due, ne' DSCR ne' leva finanziaria erano calcolabili con la
    # formula vera (DSCR richiede anche la quota capitale, non solo gli
    # oneri finanziari; la leva richiede il patrimonio netto, non solo il
    # debito) - approssimarle con un proxy diverso (es. EBITDA/oneri
    # finanziari, che e' un interest coverage ratio, non un DSCR) le avrebbe
    # rese silenziosamente sbagliate sotto l'etichetta giusta: peggio che
    # lasciarle mancanti. Stessa mappatura/meccanismo dei campi sopra.
    'patrimonio_netto': 'interview_patrimonio_netto',
    'rimborso_capitale_annuo': 'interview_rimborso_capitale_annuo',
}
# fatturato e' estraibile ma non ha una domanda diretta di fallback dedicata
# (esiste gia' interview_fatturato, a fascia, usato da Kairos - non va
# sovrascritto): se il documento riporta un fatturato esatto, lo teniamo
# separato in interview_fatturato_esatto, mai a fianco/al posto della fascia.
EXTRA_EXTRACTION_FIELD_MAP = dict(BILANCIO_FIELD_MAP, fatturato='interview_fatturato_esatto')


class Erpv6InterviewQuestionBilancio(models.Model):
    _inherit = 'erpv6.interview.question'

    answer_type = fields.Selection(selection_add=[
        ('file', 'Caricamento documento'),
        ('date', 'Data'),
    ], ondelete={'file': 'cascade', 'date': 'cascade'})


class Erpv6InterviewAnswerBilancio(models.Model):
    _inherit = 'erpv6.interview.answer'

    attachment_id = fields.Many2one(
        'ir.attachment', string='Documento caricato', ondelete='set null',
        help="Valorizzato solo per risposte a domande answer_type='file'.")
    skipped = fields.Boolean(
        string='Upload saltato esplicitamente', default=False,
        help="Scelta esplicita dell'utente (bottone 'salta'), mai un timeout o un'assunzione "
             "silenziosa - vedi vincolo del circuito erpv6_winwin_renderdata.")


class Erpv6InterviewSessionBilancio(models.Model):
    _inherit = 'erpv6.interview.session'

    def _sync_answer_and_score(self, question, answer):
        if question.answer_type == 'file':
            if not answer.skipped and answer.attachment_id:
                order = self.env['erpv6.production.order'].sudo().search(
                    [('lead_id', '=', self.lead_id.id)], order='create_date desc', limit=1)
                if order:
                    order._extract_bilancio_from_attachment(answer.attachment_id, self)
            # Nodo senza field_key: il super() sotto non fa nulla per lui,
            # chiamato comunque per uniformita' (nessuna logica duplicata).
        return super()._sync_answer_and_score(question, answer)


class Erpv6ProductionOrderBilancio(models.Model):
    _inherit = 'erpv6.production.order'

    interview_oneri_finanziari = fields.Char(string='Oneri Finanziari Annui € (intervista)')
    interview_ebitda = fields.Char(string='EBITDA € (intervista)')
    interview_debito_finanziario = fields.Char(string='Debito Finanziario Totale € (intervista)')
    interview_data_ultima_visura = fields.Char(string='Data Ultima Visura/Bilancio (intervista, ISO)')
    interview_contenzioso_in_corso = fields.Char(string='Contenzioso in Corso (intervista)')
    interview_bando_target = fields.Char(string='Bando/Agevolazione Target (intervista)')
    interview_patrimonio_netto = fields.Char(string='Patrimonio Netto € (intervista)')
    interview_rimborso_capitale_annuo = fields.Char(string='Rimborso Quota Capitale Annuo € (intervista)')
    interview_fatturato_esatto = fields.Char(
        string='Fatturato Esatto € (da bilancio, se disponibile)',
        help="Distinto da interview_fatturato (fascia, usata da Kairos) - valorizzato solo se "
             "un documento caricato riportava un fatturato esatto interpretabile con certezza.")

    @staticmethod
    def _pdf_to_text(pdf_bytes):
        """Estrazione testo via PyPDF2 (gia' presente nell'immagine Odoo,
        nessuna nuova dipendenza) - nessun OCR: un PDF scansionato come
        immagine restituisce testo vuoto, gestito dal chiamante come
        'nessun testo estraibile', non come errore silenzioso."""
        import PyPDF2
        reader = PyPDF2.PdfReader(io.BytesIO(pdf_bytes))
        return '\n'.join((page.extract_text() or '') for page in reader.pages)

    def _extract_bilancio_from_attachment(self, attachment, session):
        """Percorso B del circuito erpv6_winwin_renderdata: estrae dal PDF
        caricato (bilancio/visura) i dati finanziari via lo stesso motore
        AI generico gia' usato da _run_metodo_ai (erpv6.omni.bridge +
        erpv6.omni.route.config, mai un meccanismo di chiamata AI nuovo).
        Nessun default silenzioso: un campo non trovato/non interpretabile
        con certezza resta vuoto, e la domanda diretta di fallback
        corrispondente (Percorso A, vedi data/interview_question_bilancio_data.xml)
        restera' quindi visibile nel cammino dell'albero (_find_next_question,
        invariato: salta solo le domande gia' 'risposte', e qui creiamo una
        risposta automatica SOLO per i campi davvero estratti)."""
        self.ensure_one()
        if not attachment or not attachment.datas:
            return

        try:
            pdf_bytes = base64.b64decode(attachment.datas)
            text = self._pdf_to_text(pdf_bytes)
        except Exception:
            _logger.exception("Estrazione bilancio: impossibile leggere il PDF '%s' (order #%s).",
                               attachment.name, self.id)
            self.message_post(body=_(
                "Estrazione automatica dal documento '%s' fallita (file illeggibile come PDF) — "
                "verranno chieste le domande dirette."
            ) % attachment.name)
            return

        if not text or not text.strip():
            self.message_post(body=_(
                "Il documento '%s' non contiene testo estraibile (probabile scansione immagine, "
                "serve OCR non disponibile oggi) — verranno chieste le domande dirette."
            ) % attachment.name)
            return

        kb = self.env.ref('erpv6_winwin_renderdata.kb_metodo_estrazione_bilancio', raise_if_not_found=False)
        kb = kb.sudo() if kb else kb
        if not kb or not kb.content:
            raise UserError(_(
                "Prompt di estrazione bilancio non configurato (voce KB "
                "'erpv6_winwin_renderdata.kb_metodo_estrazione_bilancio' mancante o vuota)."
            ))

        result = self.env['erpv6.omni.bridge'].execute_ai_task(
            task_type='winwin_bilancio_extraction',
            payload={
                'temperature': 0.1,
                'messages': [
                    {'role': 'system', 'content': kb.content},
                    {'role': 'user', 'content': _(
                        "Testo estratto dal documento caricato (%(name)s):\n\n%(text)s"
                    ) % {'name': attachment.name, 'text': text[:15000]}},
                ],
            },
            context={'source': 'erpv6_winwin_renderdata:_extract_bilancio_from_attachment', 'order_id': self.id},
        )
        if not result.get('success'):
            self.message_post(body=_(
                "Estrazione automatica dal documento '%(name)s' fallita (chiamata AI: %(err)s) — "
                "verranno chieste le domande dirette."
            ) % {'name': attachment.name, 'err': result.get('error') or _('errore sconosciuto')})
            return

        try:
            ai_content = result['data']['choices'][0]['message']['content']
        except (KeyError, IndexError, TypeError):
            self.message_post(body=_(
                "Estrazione automatica dal documento '%s': risposta AI in formato inatteso — "
                "verranno chieste le domande dirette."
            ) % attachment.name)
            return

        parsed = self._parse_metodo_ai_json(ai_content)
        if not parsed:
            self.message_post(body=_(
                "Estrazione automatica dal documento '%s': impossibile interpretare la risposta AI "
                "come JSON — verranno chieste le domande dirette."
            ) % attachment.name)
            return

        vals = {}
        extracted_keys = []
        for json_key, field_name in EXTRA_EXTRACTION_FIELD_MAP.items():
            value = parsed.get(json_key)
            if value not in (None, '', False):
                vals[field_name] = str(value)
                extracted_keys.append(json_key)
        if vals:
            self.write(vals)

        # Auto-risposta per ogni campo BILANCIO_FIELD_MAP davvero estratto,
        # cosi' il walker dell'albero salta la domanda diretta corrispondente
        # (fatturato_esatto escluso: non ha una domanda diretta dedicata).
        Question = self.env['erpv6.interview.question']
        Answer = self.env['erpv6.interview.answer']
        for json_key in extracted_keys:
            if json_key not in BILANCIO_FIELD_MAP:
                continue
            fallback_q = Question.search([('field_key', '=', json_key)], limit=1)
            if not fallback_q:
                continue
            already = Answer.search(
                [('session_id', '=', session.id), ('question_id', '=', fallback_q.id)], limit=1)
            if already:
                continue
            Answer.create({
                'session_id': session.id,
                'question_id': fallback_q.id,
                'value_text': vals.get(BILANCIO_FIELD_MAP[json_key]),
                'is_altro': False,
            })

        missing = [k for k in EXTRA_EXTRACTION_FIELD_MAP if k not in extracted_keys]
        flagged = parsed.get('flagged_missing_data') or ''
        self.message_post(body=_(
            "Estrazione automatica dal documento '%(name)s' completata. Campi trovati: %(ok)s. "
            "Campi non trovati (verranno chiesti direttamente se non già coperti): %(missing)s.%(flag)s"
        ) % {
            'name': attachment.name,
            'ok': ', '.join(extracted_keys) or _('nessuno'),
            'missing': ', '.join(missing) or _('nessuno'),
            'flag': (_(' Nota del motore di estrazione: %s') % flagged) if flagged else '',
        })
