from odoo import _, api, fields, models

from .kaizen_detected_signal import MANUAL_REPORT_SIGNAL_PREFIX


class Erpv6KaizenManualReport(models.Model):
    """Segnalazione manuale Kaizen: applica le regole #1 ('zero attrito',
    KB #299) e #4 ('basarsi su dati e fatti', KB #302) scritte stanotte --
    nessun form complesso, ma nemmeno un campo note libere senza collegamento
    a un dato reale. Al salvataggio alimenta direttamente
    erpv6.heinrich.indicator (stesso motore generico gia' usato dal cron di
    rilevamento automatico), non un log separato: una segnalazione manuale e
    una rilevata dal cron finiscono nello stesso posto.

    Dal 22/08/2026 (richiesta esplicita di Denis: "le segnalazioni manuali
    devono fare lo stesso identico percorso [del sensore automatico]") ogni
    segnalazione genera ANCHE un erpv6.kaizen.detected_signal
    (origin='segnalazione_manuale', vedi _create_detected_signal) che entra
    esattamente nello stesso ciclo delle 12 Regole gia' costruito per il
    sensore 'copertura grafo' -- nessuna logica duplicata, nessun ciclo
    parallelo: kaizen_rule_engine.py riconosce la famiglia di signal_key
    con prefisso MANUAL_REPORT_SIGNAL_PREFIX allo stesso modo delle chiavi
    kg_coverage_*."""
    _name = 'erpv6.kaizen.manual_report'
    _description = 'Segnalazione Manuale Kaizen'
    _inherit = ['mail.thread']
    _order = 'create_date desc'

    name = fields.Char(string='Titolo', required=True, tracking=True)
    description = fields.Text(string='Cosa è successo', required=True, tracking=True)
    severity = fields.Selection([
        ('near_miss', 'Near miss (intercettato prima del danno)'),
        ('lieve', 'Problema lieve (fastidio, nessun blocco permanente)'),
        ('grave', 'Problema grave (ha bloccato dati o funzionalità)'),
    ], string='Gravità', required=True, default='lieve', tracking=True,
        help="Vedi KB #309 'Rubrica di scoring' per i criteri.")
    related_record = fields.Reference(
        selection=[
            ('crm.lead', 'Lead/Progetto'),
            ('erpv6.production.order', 'Ordine di Produzione'),
            ('erpv6.library.document', 'Documento'),
            ('erpv6.kb', 'Voce KB'),
            ('erpv6.validation.session', 'Sessione di Validazione'),
            ('project.task', 'Task Progetto'),
        ],
        string='Record collegato', required=True,
        help="Obbligatorio (regola Kaizen #4, KB #302): nessuna segnalazione "
             "senza un dato reale collegato, mai una nota libera scollegata.",
    )
    reporter_id = fields.Many2one('res.users', string='Segnalato da', default=lambda self: self.env.user, required=True)
    heinrich_indicator_id = fields.Many2one('erpv6.heinrich.indicator', string='Indicatore Heinrich', readonly=True, copy=False)

    detected_signal_id = fields.Many2one(
        'erpv6.kaizen.detected_signal', string='Segnale Collegato', readonly=True, copy=False,
        help="Il segnale (origin='segnalazione_manuale') generato automaticamente da questa "
             "segnalazione alla creazione -- vedi _create_detected_signal. Entra nello stesso ciclo "
             "delle 12 Regole del sensore automatico.")

    @api.model_create_multi
    def create(self, vals_list):
        reports = super().create(vals_list)
        for report in reports:
            report._log_to_heinrich()
            report._create_detected_signal()
        return reports

    def _log_to_heinrich(self):
        self.ensure_one()
        if self.heinrich_indicator_id or not self.related_record:
            return
        indicator = self.env['erpv6.heinrich.indicator'].log_signal(
            self.related_record._name, self.related_record.id, self.severity,
            description=_("[Segnalazione manuale di %(user)s] %(title)s: %(desc)s") % {
                'user': self.reporter_id.name,
                'title': self.name,
                'desc': self.description,
            },
        )
        self.heinrich_indicator_id = indicator.id

    def _create_detected_signal(self):
        """Genera il segnale collegato (origin='segnalazione_manuale') che
        fa entrare questa segnalazione nello stesso ciclo delle 12 Regole
        gia' costruito per il sensore automatico (kaizen_rule_engine.py) --
        vedi docstring della classe. signal_key include SEMPRE l'id di
        questa segnalazione (MANUAL_REPORT_SIGNAL_PREFIX + id): una
        segnalazione manuale e' un evento singolo, mai una classe ripetibile,
        quindi la chiave e' gia' unica alla prima creazione, non solo se si
        ripete (a differenza di 'validation_recovered_N'). Idempotente: se
        chiamata di nuovo (es. da uno script di backfill sui 3 report reali
        gia' esistenti) non duplica, ritrova e ricollega il segnale gia'
        creato tramite lo stesso vincolo unique (res_model, res_id,
        signal_key) di erpv6.kaizen.detected_signal."""
        self.ensure_one()
        if self.detected_signal_id or not self.related_record:
            return self.detected_signal_id
        Signal = self.env['erpv6.kaizen.detected_signal']
        signal_key = "%s%d" % (MANUAL_REPORT_SIGNAL_PREFIX, self.id)
        signal = Signal.search([
            ('res_model', '=', self.related_record._name),
            ('res_id', '=', self.related_record.id),
            ('signal_key', '=', signal_key),
        ], limit=1)
        if not signal:
            signal = Signal.create({
                'res_model': self.related_record._name,
                'res_id': self.related_record.id,
                'signal_key': signal_key,
                'origin': 'segnalazione_manuale',
                'manual_report_id': self.id,
            })
        self.detected_signal_id = signal.id
        return signal
