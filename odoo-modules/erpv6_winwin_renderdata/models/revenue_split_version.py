from odoo import api, fields, models
from odoo.exceptions import UserError
import hashlib
import json
import logging

_logger = logging.getLogger(__name__)


class RevenueSplitVersion(models.Model):
    """Versioning dello split V6 per progetto.

    26/09/2026: ogni modifica allo split crea una NUOVA versione
    (version_number +1). La versione precedente resta visibile come
    storico. Firma incrementale: solo chi cambia % firma la nuova.
    """
    _name = 'erpv6.revenue.split.version'
    _description = 'Versione Split V6'
    _order = 'relation_id, version_number desc'
    _inherit = ['mail.thread']

    relation_id = fields.Many2one(
        'erpv6.tracking.relation', string='Progetto',
        required=True, ondelete='cascade', index=True)
    version_number = fields.Integer(string='Versione', required=True)
    payload_json = fields.Text(string='Payload JSON', required=True)
    hash = fields.Char(string='Hash SHA-256')
    blockchain_anchor = fields.Char(string='Anchor blockchain')

    state = fields.Selection([
        ('bozza', 'Bozza'),
        ('in_firma', 'In firma'),
        ('approvata', 'Approvata'),
        ('superata', 'Superata'),
        ('rifiutata', 'Rifiutata'),
        ('cessata', 'Cessata'),
    ], string='Stato', default='bozza', required=True, tracking=True)

    motivation = fields.Text(
        string='Motivazione', required=True,
        help='Obbligatorio: perché stai creando questa versione?')

    created_by = fields.Many2one(
        'res.users', string='Creata da',
        default=lambda self: self.env.user, readonly=True)

    superseded_by_id = fields.Many2one(
        'erpv6.revenue.split.version', string='Superata da',
        ondelete='set null')

    # Firme per questa versione
    sign_request_ids = fields.One2many(
        'erpv6.sign.request', 'split_version_id', string='Firme')

    # Payload parsato (comodo per UI)
    base_compenso = fields.Char(compute='_compute_parsed', store=False)
    beneficiari_count = fields.Integer(compute='_compute_parsed', store=False)

    _sql_constraints = [
        ('version_unique', 'UNIQUE(relation_id, version_number)',
         'Version number già esistente per questo progetto'),
    ]

    @api.depends('payload_json')
    def _compute_parsed(self):
        for r in self:
            try:
                d = json.loads(r.payload_json or '{}')
                r.base_compenso = str(d.get('base', {}))
                r.beneficiari_count = len(d.get('beneficiari', []))
            except Exception:
                r.base_compenso = '?'
                r.beneficiari_count = 0

    def _compute_hash(self):
        self.ensure_one()
        return hashlib.sha256((self.payload_json or '').encode('utf-8')).hexdigest()

    def action_supersede(self, new_version):
        """Marca questa versione come superata da new_version."""
        self.ensure_one()
        self.write({
            'state': 'superata',
            'superseded_by_id': new_version.id,
        })
