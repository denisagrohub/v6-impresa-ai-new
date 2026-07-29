from odoo import models, fields, api
from odoo.exceptions import UserError
from datetime import datetime
import secrets
import string

class TrackingLot(models.Model):
    _name = 'erpv6.tracking.lot'
    _description = 'Lotto di Tracciamento'
    _order = 'create_date desc'

    name = fields.Char('Nome Lotto', required=True, readonly=True)
    code = fields.Char('Codice Lotto', required=True, readonly=True, index=True)
    tracking_type = fields.Selection([
        ('batch', 'Lotto Batch (Contenitore)'),
        ('definitive', 'Lotto Definitivo (Prodotto Finito)'),
    ], string='Tipologia Lotto', required=True, default='batch')

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

    company_code = fields.Char('Sigla Azienda', required=True)
    brand_code = fields.Char('Codice Brand', required=True)

    production_date = fields.Datetime(
        'Data Produzione', required=True, default=fields.Datetime.now
    )
    year = fields.Char('Anno', required=True)
    julian_day = fields.Integer('Giorno Giuliano', required=True)
    hour = fields.Integer('Ora', required=True)
    minute = fields.Integer('Minuto', required=True)

    quantity = fields.Float('Quantità', default=1.0)
    notes = fields.Text('Note')

    state = fields.Selection([
        ('draft', 'Bozza'),
        ('active', 'Attivo'),
        ('closed', 'Chiuso'),
        ('cancelled', 'Annullato'),
    ], string='Stato', default='draft', required=True)

    _sql_constraints = [
        ('code_unique', 'unique(code)', 'Il codice lotto deve essere univoco!'),
    ]

    @api.model
    def _get_julian_day(self, date=None):
        if not date:
            date = fields.Datetime.now()
        if isinstance(date, str):
            date = datetime.strptime(date, '%Y-%m-%d %H:%M:%S')
        return date.timetuple().tm_yday

    @api.model
    def _generate_batch_code(self, config, production_date=None):
        if not production_date:
            production_date = fields.Datetime.now()
        if isinstance(production_date, str):
            production_date = datetime.strptime(production_date, '%Y-%m-%d %H:%M:%S')
        year = str(production_date.year)[-2:]
        julian_day = self._get_julian_day(production_date)
        sequence = ''.join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(5))
        return f"BATCH-{config.company_code}-{year}{julian_day:03d}-{config.default_brand}-{sequence}"

    @api.model
    def _generate_definitive_code(self, config, production_date=None):
        if not production_date:
            production_date = fields.Datetime.now()
        if isinstance(production_date, str):
            production_date = datetime.strptime(production_date, '%Y-%m-%d %H:%M:%S')
        year = str(production_date.year)[-2:]
        julian_day = self._get_julian_day(production_date)
        hour = production_date.hour
        minute = production_date.minute
        return f"{config.company_code}-{year}{julian_day:03d}-{config.default_brand}-{hour:02d}{minute:02d}"

    @api.model
    def create_batch_lot(self, config_id, quantity=1.0, notes=None):
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
            'quantity': quantity,
            'notes': notes,
            'state': 'active',
        }
        return self.create(vals)

    @api.model
    def create_definitive_lot(self, config_id, batch_lot_id=None, quantity=1.0, notes=None):
        config = self.env['erpv6.tracking.config'].browse(config_id)
        production_date = fields.Datetime.now()
        code = self._generate_definitive_code(config, production_date)
        existing = self.search([('code', '=', code)], limit=1)
        if existing:
            counter = 1
            while self.search([('code', '=', f"{code}-{counter:02d}")], limit=1):
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
            'quantity': quantity,
            'notes': notes,
            'state': 'active',
        }
        return self.create(vals)

    def action_close(self):
        self.write({'state': 'closed'})

    def action_cancel(self):
        self.write({'state': 'cancelled'})

    def action_draft(self):
        self.write({'state': 'draft'})
