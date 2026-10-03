# pylint: disable=import-error
"""Modello facciata erpv6.signal.

03/10/2026 (C5-a): proietta verso un'unica UI i segnali provenienti
da 4 sorgenti (Kaizen detected, Kaizen manual, Heinrich, Suggestion
urgent). NON sostituisce i modelli originali — li aggrega.

La logica di popolamento (sync) è in C5-b.
"""
from odoo import api, fields, models


class Erpv6Signal(models.Model):
    _name = 'erpv6.signal'
    _description = 'Segnale unificato V6 (facciata)'
    _order = 'severity desc, create_date desc'
    _rec_name = 'display_name'

    # ─── Identità ───
    display_name = fields.Char(
        compute='_compute_display_name', store=True)
    title = fields.Char(required=True, index=True)
    description = fields.Text()

    # ─── Origine ───
    source_type = fields.Selection([
        ('kaizen_detected', 'Kaizen — rilevamento automatico'),
        ('kaizen_manual', 'Kaizen — segnalazione utente'),
        ('heinrich_alert', 'Heinrich — contatori soglia'),
        ('suggestion_urgent', 'Suggestion urgente'),
    ], string='Origine', required=True, index=True)

    source_model = fields.Char(string='Modello sorgente', index=True)
    source_id = fields.Integer(string='ID sorgente', index=True)
    source_ref = fields.Reference(
        selection='_reference_models',
        compute='_compute_source_ref',
        string='Riferimento sorgente',
    )

    # ─── Classificazione ───
    severity = fields.Selection([
        ('lieve', 'Lieve'),
        ('medio', 'Medio'),
        ('grave', 'Grave'),
    ], string='Gravità', required=True, index=True, default='lieve')

    category = fields.Selection([
        ('risk_client', 'Rischio cliente'),
        ('risk_supplier', 'Rischio fornitore'),
        ('risk_timing', 'Rischio tempi'),
        ('risk_economic', 'Rischio economico'),
        ('risk_data', 'Rischio dati'),
        ('opportunity', 'Opportunità'),
        ('system', 'Sistema tecnico'),
    ], string='Categoria', index=True)

    # ─── Contesto business ───
    relation_id = fields.Many2one(
        'erpv6.tracking.relation', string='Progetto Partner',
        index=True, ondelete='set null')
    deal_id = fields.Many2one(
        'erpv6.deal', string='Deal',
        index=True, ondelete='set null')

    # ─── Destinatario ───
    recipient_user_id = fields.Many2one(
        'res.users', string='Destinatario',
        index=True, ondelete='set null',
        help='Null per segnali di sistema non assegnati. '
             'Popolato per suggestion urgent.')

    # ─── Stato ───
    state = fields.Selection([
        ('new', 'Nuovo'),
        ('acknowledged', 'Preso in carico'),
        ('resolved', 'Risolto'),
        ('ignored', 'Ignorato'),
        ('expired', 'Scaduto'),
    ], default='new', required=True, index=True)

    acknowledged_at = fields.Datetime(readonly=True)
    acknowledged_by = fields.Many2one('res.users', readonly=True)
    resolved_at = fields.Datetime(readonly=True)
    resolved_by = fields.Many2one('res.users', readonly=True)

    # ─── Escalation (C5-f userà questi campi) ───
    escalation_count = fields.Integer(default=0, readonly=True)
    parent_signal_id = fields.Many2one(
        'erpv6.signal', string='Segnale genitore',
        ondelete='set null', readonly=True)
    child_signal_ids = fields.One2many(
        'erpv6.signal', 'parent_signal_id', string='Escalation')

    # ─── Notifica ───
    telegram_notified_at = fields.Datetime(
        string='Notificato Telegram il', readonly=True, index=True)

    # ─── Evidence ───
    evidence = fields.Text(
        string='Evidenza',
        help='JSON o testo con dati che giustificano il segnale.')

    # ─── Dedup ───
    dedup_key = fields.Char(
        string='Chiave dedup', required=True, index=True,
        help='Unique per evitare doppioni. Calcolato dal sync.')

    _sql_constraints = [
        ('dedup_key_uniq', 'unique(dedup_key)',
         'Un signal per dedup_key. Il sync aggiorna invece di creare.'),
    ]

    # ─── Metodi ───

    @api.depends('title', 'source_type')
    def _compute_display_name(self):
        for s in self:
            prefix = dict(s._fields['source_type'].selection).get(
                s.source_type, s.source_type or '')
            s.display_name = f"[{prefix}] {s.title or ''}"

    @api.model
    def _reference_models(self):
        return [
            ('erpv6.kaizen.detected_signal', 'Kaizen Signal'),
            ('erpv6.kaizen.manual_report', 'Manual Report'),
            ('erpv6.suggestion', 'Suggestion'),
        ]

    @api.depends('source_model', 'source_id')
    def _compute_source_ref(self):
        for s in self:
            if s.source_model and s.source_id:
                s.source_ref = f"{s.source_model},{s.source_id}"
            else:
                s.source_ref = False

    def action_acknowledge(self):
        self.ensure_one()
        if self.state != 'new':
            return
        self.write({
            'state': 'acknowledged',
            'acknowledged_at': fields.Datetime.now(),
            'acknowledged_by': self.env.user.id,
        })

    def action_resolve(self):
        self.ensure_one()
        self.write({
            'state': 'resolved',
            'resolved_at': fields.Datetime.now(),
            'resolved_by': self.env.user.id,
        })

    def action_ignore(self):
        self.ensure_one()
        self.write({'state': 'ignored'})
