from odoo import api, fields, models, _
from datetime import timedelta
import secrets
import string

class Erpv6BookingToken(models.Model):
    _name = 'erpv6.booking.token'
    _description = 'Token Prenotazione'
    _order = 'create_date desc'
    _inherit = ['mail.thread']

    token = fields.Char(
        string='Token',
        required=True,
        index=True,
        copy=False,
        default=lambda self: self._generate_token(),
    )
    consultant_id = fields.Many2one('erpv6.consulting.consultant', required=True)
    brand_id = fields.Many2one('erpv6.consulting.brand', related='consultant_id.brand_id', store=True)
    status = fields.Selection([
        ('available', 'Disponibile'),
        ('booked', 'Prenotato'),
        ('expired', 'Scaduto'),
        ('cancelled', 'Cancellato'),
    ], default='available', required=True)
    
    client_name = fields.Char('Nome Cliente')
    client_email = fields.Char('Email Cliente')
    client_phone = fields.Char('Telefono Cliente')
    notes = fields.Text('Note')
    booked_at = fields.Datetime('Prenotato il')
    validity_hours = fields.Integer('Validità (ore)', default=24)
    expires_at = fields.Datetime('Scade il', compute='_compute_expires_at', store=True)

    _sql_constraints = [
        ('token_unique', 'unique(token)', 'Il token deve essere univoco!'),
    ]

    @api.depends('create_date', 'validity_hours')
    def _compute_expires_at(self):
        for rec in self:
            if rec.create_date:
                rec.expires_at = rec.create_date + timedelta(hours=rec.validity_hours)
            else:
                rec.expires_at = False

    def _generate_token(self):
        alphabet = string.ascii_letters + string.digits
        return 'booking_' + ''.join(secrets.choice(alphabet) for _ in range(24))

    def action_book(self):
        self.ensure_one()
        if self.status != 'available':
            raise UserError(_('Token non disponibile.'))
        if self.expires_at and self.expires_at < fields.Datetime.now():
            self.write({'status': 'expired'})
            raise UserError(_('Token scaduto.'))
        self.write({'status': 'booked', 'booked_at': fields.Datetime.now()})

    def action_cancel(self):
        self.ensure_one()
        if self.status not in ('available', 'booked'):
            raise UserError(_('Non cancellabile.'))
        self.write({'status': 'cancelled'})

    def action_reset(self):
        self.ensure_one()
        self.write({'status': 'available', 'booked_at': False})

    @api.model
    def cron_expire_tokens(self):
        expired = self.search([('status', '=', 'available'), ('expires_at', '<', fields.Datetime.now())])
        if expired:
            expired.write({'status': 'expired'})
        return True

    @api.model
    def cron_cleanup_tokens(self, days=30):
        cutoff = fields.Datetime.now() - timedelta(days=days)
        old = self.search([('status', 'in', ['expired', 'cancelled']), ('create_date', '<', cutoff)])
        if old:
            old.unlink()
        return True

    @api.model
    def generate_bulk(self, consultant_id, count=10, validity_hours=24):
        self.create([{'consultant_id': consultant_id, 'validity_hours': validity_hours} for _ in range(count)])
        return True
