# pylint: disable=import-error
"""Snapshot versionati del deal — Fotografia storica.

30/09/2026 (F1 S2): quando un campo sensibile del deal cambia (fee,
prezzo, volume, buyer…), il sistema crea uno snapshot versionato.
Così vedi la traiettoria economica del deal nel tempo.

Differenza con erpv6.deal.event:
- deal.event = STORIA di cosa è successo (tavolo, call, documento)
- deal.snapshot = FOTOGRAFIA dei valori in un certo momento
Un evento può generare uno snapshot (se contiene cambi numerici),
ma snapshot possono essere creati anche senza evento (cambio diretto).
"""
import json
import logging

from odoo import api, fields, models

_logger = logging.getLogger(__name__)


# Campi del deal tracciati: se cambiano, crea snapshot automatico
SNAPSHOT_TRACKED_FIELDS = [
    'state',
    'fee_totale',
    'prezzo_cessione',
    'fee_v6',
    'volume',
    'seller_id',
    'buyer_id',
    'revenue_model',
]


class Erpv6DealSnapshot(models.Model):
    _name = 'erpv6.deal.snapshot'
    _description = 'Snapshot versionato deal'
    _order = 'version desc, id desc'

    deal_id = fields.Many2one(
        'erpv6.deal', string='Deal',
        required=True, ondelete='cascade', index=True)

    version = fields.Integer(string='Versione', required=True, default=1)

    snapshot_date = fields.Datetime(
        string='Data snapshot', required=True,
        default=fields.Datetime.now, index=True)

    trigger_event_id = fields.Many2one(
        'erpv6.deal.event', string='Evento scatenante',
        ondelete='set null',
        help='Evento della timeline che ha causato questo snapshot, se applicabile.')

    trigger_type = fields.Selection([
        ('event', 'Da evento timeline'),
        ('auto_write', 'Cambio automatico su write'),
        ('manual', 'Manuale'),
        ('migration', 'Migrazione iniziale'),
    ], string='Origine', default='auto_write', required=True)

    values = fields.Json(
        string='Valori',
        help='Fotografia dei valori correnti del deal.')

    is_current = fields.Boolean(
        string='Corrente', default=False, index=True,
        help='True solo per l\'ultimo snapshot attivo (uno per deal).')

    diff_from_prev = fields.Json(
        string='Diff dal precedente',
        help='Cosa è cambiato rispetto allo snapshot precedente.')

    created_by_id = fields.Many2one(
        'res.users', string='Creato da',
        default=lambda self: self.env.user, readonly=True)

    note = fields.Char(string='Nota', help='Nota libera sullo snapshot.')
