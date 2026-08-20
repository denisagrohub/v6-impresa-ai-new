from odoo import _, api, fields, models


class Erpv6KaizenManualReport(models.Model):
    """Segnalazione manuale Kaizen: applica le regole #1 ('zero attrito',
    KB #299) e #4 ('basarsi su dati e fatti', KB #302) scritte stanotte --
    nessun form complesso, ma nemmeno un campo note libere senza collegamento
    a un dato reale. Al salvataggio alimenta direttamente
    erpv6.heinrich.indicator (stesso motore generico gia' usato dal cron di
    rilevamento automatico), non un log separato: una segnalazione manuale e
    una rilevata dal cron finiscono nello stesso posto."""
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

    @api.model_create_multi
    def create(self, vals_list):
        reports = super().create(vals_list)
        for report in reports:
            report._log_to_heinrich()
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
