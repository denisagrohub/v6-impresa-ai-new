# pylint: disable=import-error
"""Modello erpv6.signal.mute (C5-P3).

03/10/2026: dopo 3 ignore dello stesso pattern (stessa signal_key, stesso
source_type, stesso utente) in 30 giorni, il segnale viene "silenziato"
per 30 giorni. Il sistema non lo ripropone finché non scade o finché
l'utente non lo riattiva manualmente.

Il pattern_key è derivato dal dedup_key del signal con un metodo
_pattern_key() su erpv6.signal.
"""
import logging
from datetime import timedelta

from odoo import api, fields, models

_logger = logging.getLogger(__name__)

# Soglia: N ignore → mute
IGNORE_THRESHOLD = 3
# Durata mute
MUTE_DURATION_DAYS = 30
# Finestra ignore: solo ignore degli ultimi N giorni contano
IGNORE_WINDOW_DAYS = 30


class Erpv6SignalMute(models.Model):
    _name = 'erpv6.signal.mute'
    _description = 'Sospensione signal dopo ignore ripetuti'
    _order = 'muted_until desc'

    user_id = fields.Many2one(
        'res.users', string='Utente', required=True, index=True,
        ondelete='cascade')
    pattern_key = fields.Char(
        string='Pattern silenziato', required=True, index=True,
        help='Chiave stabile del pattern (es. validation_escalation_stuck, '
             'heinrich:crm.lead, rule:deal_no_next_step).')
    source_type = fields.Selection([
        ('kaizen_detected', 'Kaizen — rilevamento automatico'),
        ('kaizen_manual', 'Kaizen — segnalazione utente'),
        ('heinrich_alert', 'Heinrich — contatori soglia'),
        ('suggestion_urgent', 'Suggestion urgente'),
    ], string='Origine', required=True, index=True)
    muted_until = fields.Datetime(string='Silenziato fino al', required=True)
    reason = fields.Selection([
        ('auto_3_ignore', 'Auto: 3 ignore'),
        ('manual', 'Manuale'),
    ], string='Motivo', default='auto_3_ignore', required=True)
    ignore_count_at_mute = fields.Integer(
        string='Ignore al momento del mute', default=0)
    note = fields.Text(string='Nota')

    _sql_constraints = [
        ('user_pattern_uniq',
         'unique(user_id, pattern_key, source_type)',
         'Un solo mute per utente + pattern + origine.'),
    ]

    @api.model
    def is_muted(self, user_id, pattern_key, source_type):
        """Ritorna True se esiste un mute attivo per (user, pattern, source).
        Considera solo mute con muted_until > now."""
        if not user_id or not pattern_key:
            return False
        return bool(self.search_count([
            ('user_id', '=', user_id),
            ('pattern_key', '=', pattern_key),
            ('source_type', '=', source_type),
            ('muted_until', '>', fields.Datetime.now()),
        ]))

    @api.model
    def register_ignore(self, signal):
        """Registra un ignore sul signal. Se la soglia è raggiunta,
        crea/aggiorna un mute.

        Ritorna: True se è stato creato/aggiornato un mute, False altrimenti.
        """
        signal.ensure_one()
        user = signal.recipient_user_id
        if not user:
            return False

        pattern_key = signal._pattern_key()
        source_type = signal.source_type

        # Conta ignore dello stesso pattern (user, key, source) negli
        # ultimi IGNORE_WINDOW_DAYS giorni.
        cutoff = fields.Datetime.now() - timedelta(days=IGNORE_WINDOW_DAYS)
        count = self.env['erpv6.signal'].sudo().search_count([
            ('recipient_user_id', '=', user.id),
            ('source_type', '=', source_type),
            ('state', '=', 'ignored'),
            ('write_date', '>=', cutoff),
            # Filtro per pattern (non banale con dedup_key: uso Python)
        ])
        # Per efficienza, prendo tutti i signal ignored dello user nel
        # periodo e filtro in Python
        candidates = self.env['erpv6.signal'].sudo().search([
            ('recipient_user_id', '=', user.id),
            ('source_type', '=', source_type),
            ('state', '=', 'ignored'),
            ('write_date', '>=', cutoff),
        ])
        count = sum(1 for s in candidates if s._pattern_key() == pattern_key)

        if count < IGNORE_THRESHOLD:
            return False

        # Crea o aggiorna mute
        existing = self.search([
            ('user_id', '=', user.id),
            ('pattern_key', '=', pattern_key),
            ('source_type', '=', source_type),
        ], limit=1)

        muted_until = fields.Datetime.now() + timedelta(days=MUTE_DURATION_DAYS)
        vals = {
            'muted_until': muted_until,
            'reason': 'auto_3_ignore',
            'ignore_count_at_mute': count,
        }
        if existing:
            existing.write(vals)
        else:
            vals.update({
                'user_id': user.id,
                'pattern_key': pattern_key,
                'source_type': source_type,
            })
            self.create(vals)

        _logger.info(
            "Signal mute attivato: user=%s pattern=%s source=%s "
            "(count=%d, until=%s)",
            user.id, pattern_key, source_type, count, muted_until,
        )
        return True

    @api.model
    def cleanup_expired(self):
        """Cancella i mute scaduti. Chiamato dal cron giornaliero."""
        expired = self.search([
            ('muted_until', '<', fields.Datetime.now()),
        ])
        n = len(expired)
        if n:
            expired.unlink()
            _logger.info("Signal mute puliti: %d", n)
        return n
