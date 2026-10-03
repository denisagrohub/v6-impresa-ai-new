# pylint: disable=import-error
"""Modello facciata erpv6.signal.

03/10/2026 (C5-a): proietta verso un'unica UI i segnali provenienti
da 4 sorgenti (Kaizen detected, Kaizen manual, Heinrich, Suggestion
urgent). NON sostituisce i modelli originali — li aggrega.

La logica di popolamento (sync) è in C5-b.
"""
from datetime import timedelta

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
        # 03/10/2026 (C5-P3): registra ignore → mute dopo N
        try:
            self.env['erpv6.signal.mute'].sudo().register_ignore(self)
        except Exception:  # pylint: disable=broad-except
            import logging
            logging.getLogger(__name__).exception(
                "register_ignore fallito per signal %s (non bloccante)", self.id)

    def action_silence_30d(self):
        """Silenzia manualmente il pattern di questo signal per 30gg."""
        self.ensure_one()
        pk = self._pattern_key()
        if not pk:
            # Evento singolo: silenzia solo questo signal
            self.write({'state': 'ignored'})
            return
        user_id = self.recipient_user_id.id if self.recipient_user_id else self.env.user.id
        Mute = self.env['erpv6.signal.mute'].sudo()
        existing = Mute.search([
            ('user_id', '=', user_id),
            ('pattern_key', '=', pk),
            ('source_type', '=', self.source_type),
        ], limit=1)
        vals = {
            'muted_until': fields.Datetime.now() + timedelta(days=30),
            'reason': 'manual',
            'note': f'Manual silence da signal {self.id}',
        }
        if existing:
            existing.write(vals)
        else:
            vals.update({
                'user_id': user_id,
                'pattern_key': pk,
                'source_type': self.source_type,
            })
            Mute.create(vals)

    def action_unsilence(self):
        """Rimuove il mute per il pattern di questo signal."""
        self.ensure_one()
        pk = self._pattern_key()
        if not pk:
            return
        user_id = self.recipient_user_id.id if self.recipient_user_id else self.env.user.id
        self.env['erpv6.signal.mute'].sudo().search([
            ('user_id', '=', user_id),
            ('pattern_key', '=', pk),
            ('source_type', '=', self.source_type),
        ]).unlink()

    def action_unignore(self):
        """Riporta un signal ignorato a 'new'."""
        self.ensure_one()
        if self.state == 'ignored':
            self.write({'state': 'new'})

    def _pattern_key(self):
        """Deriva una chiave di pattern stabile dal dedup_key.

        Esempi:
        - kaizen_detected:validation_escalation_stuck:crm.lead:120
          → validation_escalation_stuck
        - kaizen_detected_agg:validation_escalation_stuck:5
          → validation_escalation_stuck
        - kaizen_manual:7
          → None (evento singolo, mai un pattern)
        - heinrich:crm.lead:120
          → heinrich:crm.lead
        - suggestion:42
          → rule:<rule_code> da evidence (se presente)
        """
        self.ensure_one()
        dk = self.dedup_key or ''
        if dk.startswith('kaizen_detected_agg:'):
            parts = dk.split(':')
            return parts[1] if len(parts) >= 2 else None
        if dk.startswith('kaizen_detected:'):
            parts = dk.split(':')
            return parts[1] if len(parts) >= 2 else None
        if dk.startswith('kaizen_manual:'):
            return None  # evento singolo
        if dk.startswith('heinrich:'):
            parts = dk.split(':')
            return ':'.join(parts[:2]) if len(parts) >= 2 else None
        if dk.startswith('suggestion:'):
            # Leggi rule_code da evidence (JSON)
            try:
                import json
                ev = json.loads(self.evidence or '{}')
                rc = ev.get('rule_code')
                return f'rule:{rc}' if rc else None
            except (ValueError, TypeError):
                return None
        return None

    @api.model
    def _is_signal_muted(self, user_id, pattern_key, source_type):
        """Check mute attivo. Se pattern_key è None, ritorna False
        (eventi singoli non si mutano)."""
        if not pattern_key:
            return False
        return self.env['erpv6.signal.mute'].sudo().is_muted(
            user_id, pattern_key, source_type)
