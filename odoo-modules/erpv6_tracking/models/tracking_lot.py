from odoo import models, fields, api
from odoo.exceptions import UserError
from datetime import datetime
import random
import string


class TrackingLot(models.Model):
    _name = 'erpv6.tracking.lot'
    _description = 'Lotto di Tracciamento'
    _order = 'create_date desc'

    # ===== CAMPI BASE =====
    name = fields.Char('Nome Lotto', required=True, readonly=True)
    code = fields.Char('Codice Lotto', required=True,
                       readonly=True, index=True)

    tracking_type = fields.Selection([
        ('batch', 'Lotto Batch (Contenitore)'),
        ('definitive', 'Lotto Definitivo (Prodotto Finito)'),
    ], string='Tipologia Lotto', required=True, default='batch')

    # ===== RELAZIONI =====
    parent_lot_id = fields.Many2one(
        'erpv6.tracking.lot',
        string='Lotto Batch Padre',
        domain=[('tracking_type', '=', 'batch')]
    )
    child_lot_ids = fields.One2many(
        'erpv6.tracking.lot', 'parent_lot_id',
        string='Lotti Figli'
    )
    config_id = fields.Many2one(
        'erpv6.tracking.config',
        string='Configurazione',
        required=True
    )

    # ===== DATI AZIENDA =====
    company_code = fields.Char('Sigla Azienda', required=True)
    brand_code = fields.Char('Codice Brand', required=True)

    # ===== DATI TEMPORALI =====
    production_date = fields.Datetime(
        'Data Produzione', required=True, default=fields.Datetime.now
    )
    year = fields.Char('Anno', required=True)
    julian_day = fields.Integer('Giorno Giuliano', required=True)
    hour = fields.Integer('Ora', required=True)
    minute = fields.Integer('Minuto', required=True)

    # ===== RELAZIONI PRODOTTO/DOCUMENTO =====
    product_id = fields.Many2one('product.product', string='Prodotto')
    document_id = fields.Integer('ID Documento')
    project_id = fields.Integer('ID Progetto')
    order_id = fields.Integer('ID Ordine')

    # ===== METADATA =====
    quantity = fields.Float('Quantità', default=1.0)
    notes = fields.Text('Note')

    # ===== STATO =====
    state = fields.Selection([
        ('draft', 'Bozza'),
        ('active', 'Attivo'),
        ('closed', 'Chiuso'),
        ('cancelled', 'Annullato'),
    ], string='Stato', default='draft', required=True)

    # ===== BLOCKCHAIN (opzionale) =====
    blockchain_record_id = fields.Many2one(
        'erpv6.blockchain.record',
        string='Record Blockchain',
        compute='_compute_blockchain_record',
        store=True
    )
    blockchain_certified = fields.Boolean(
        'Certificato Blockchain',
        compute='_compute_blockchain_record',
        store=True
    )

    _sql_constraints = [
        ('code_unique', 'unique(code)', 'Il codice lotto deve essere univoco!'),
    ]

    # ===== COMPUTE =====
    @api.depends('code')
    def _compute_blockchain_record(self):
        """Calcola il record blockchain associato (graceful se modulo non installato)"""
        RecordModel = self.env.get('erpv6.blockchain.record')
        for lot in self:
            if RecordModel is None:
                lot.blockchain_record_id = False
                lot.blockchain_certified = False
                continue
            record = RecordModel.search([
                ('lot_number', '=', lot.code),
                ('status', '=', 'confirmed')
            ], limit=1)
            lot.blockchain_record_id = record.id if record else False
            lot.blockchain_certified = bool(record)

    # ===== AZIONI =====
    def action_certify_on_blockchain(self):
        """Certifica questo lotto su blockchain"""
        self.ensure_one()
        config = self.env['erpv6.blockchain.config'].search(
            [('active', '=', True)], limit=1
        )
        if not config:
            raise UserError('Nessuna configurazione blockchain attiva.')
        if not hasattr(self, 'document_hash') or not self.document_hash:
            raise UserError('Il lotto non ha un hash del documento.')

        record = self.env['erpv6.blockchain.record'].create({
            'config_id': config.id,
            'document_model': 'erpv6.tracking.lot',
            'document_id': self.id,
            'document_name': self.name,
            'document_hash': self.document_hash,
            'lot_number': self.code,
        })
        return record.action_certify()

    def action_close(self):
        """Chiude il lotto"""
        self.write({'state': 'closed'})

    def action_cancel(self):
        """Annulla il lotto"""
        self.write({'state': 'cancelled'})

    def action_draft(self):
        """Riporta il lotto in stato bozza"""
        self.write({'state': 'draft'})

    # ===== HELPER =====
    @api.model
    def _get_julian_day(self, date=None):
        """Calcola il giorno giuliano (1-366) per una data"""
        if not date:
            date = fields.Datetime.now()
        if isinstance(date, str):
            date = datetime.strptime(date, '%Y-%m-%d %H:%M:%S')
        return date.timetuple().tm_yday

    @api.model
    def _generate_batch_code(self, config, production_date=None):
        """Genera il codice del lotto batch"""
        if not production_date:
            production_date = fields.Datetime.now()
        if isinstance(production_date, str):
            production_date = datetime.strptime(
                production_date, '%Y-%m-%d %H:%M:%S'
            )

        year = str(production_date.year)[-2:]
        julian_day = self._get_julian_day(production_date)
        sequence = ''.join(random.choices(
            string.ascii_uppercase + string.digits, k=5
        ))
        return (
            f"BATCH-{config.company_code}-{year}{julian_day:03d}-"
            f"{config.default_brand}-{sequence}"
        )

    @api.model
    def _generate_definitive_code(self, config, production_date=None):
        """Genera il codice del lotto definitivo"""
        if not production_date:
            production_date = fields.Datetime.now()
        if isinstance(production_date, str):
            production_date = datetime.strptime(
                production_date, '%Y-%m-%d %H:%M:%S'
            )

        year = str(production_date.year)[-2:]
        julian_day = self._get_julian_day(production_date)
        hour = production_date.hour
        minute = production_date.minute
        return (
            f"{config.company_code}-{year}{julian_day:03d}-"
            f"{config.default_brand}-{hour:02d}{minute:02d}"
        )

    @api.model
    def create_batch_lot(self, config_id, product_id=None, quantity=1.0, notes=None):
        """Crea un nuovo lotto batch (contenitore)"""
        config = self.env['erpv6.tracking.config'].browse(config_id)
        production_date = fields.Datetime.now()
        code = self._generate_batch_code(config, production_date)

        vals = {
            'name': f'Lotto Batch {code}',
            'code': code,
            'tracking_type': 'batch',
            'config_id': config.id,
            'company_code': config.company_code,
            'brand_code': config.default_brand,
            'production_date': production_date,
            'year': str(production_date.year),
            'julian_day': self._get_julian_day(production_date),
            'hour': production_date.hour,
            'minute': production_date.minute,
            'product_id': product_id,
            'quantity': quantity,
            'notes': notes,
            'state': 'active',
        }
        return self.create(vals)

    @api.model
    def create_definitive_lot(self, config_id, batch_lot_id=None, product_id=None, quantity=1.0, notes=None):
        """Crea un nuovo lotto definitivo (prodotto finito)"""
        config = self.env['erpv6.tracking.config'].browse(config_id)
        production_date = fields.Datetime.now()
        code = self._generate_definitive_code(config, production_date)

        existing = self.search([('code', '=', code)], limit=1)
        if existing:
            counter = 1
            while self.search(
                [('code', '=', f"{code}-{counter:02d}")], limit=1
            ):
                counter += 1
            code = f"{code}-{counter:02d}"

        vals = {
            'name': f'Lotto Definitivo {code}',
            'code': code,
            'tracking_type': 'definitive',
            'parent_lot_id': batch_lot_id,
            'config_id': config.id,
            'company_code': config.company_code,
            'brand_code': config.default_brand,
            'production_date': production_date,
            'year': str(production_date.year),
            'julian_day': self._get_julian_day(production_date),
            'hour': production_date.hour,
            'minute': production_date.minute,
            'product_id': product_id,
            'quantity': quantity,
            'notes': notes,
            'state': 'active',
        }
        return self.create(vals)
