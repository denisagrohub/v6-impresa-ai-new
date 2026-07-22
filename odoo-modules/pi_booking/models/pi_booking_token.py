from odoo import models, fields, api

class PiBookingToken(models.Model):
    _name = 'pi.booking.token'
    _description = 'Token Prenotazione Pubblica'

    token = fields.Char(string='Token', required=True, index=True, unique=True)
    consultant_id = fields.Many2one('res.partner', string='Consulente', required=True)
    event_id = fields.Many2one('calendar.event', string='Evento')
    status = fields.Selection([
        ('available', 'Disponibile'),
        ('booked', 'Prenotato'),
        ('expired', 'Scaduto'),
        ('cancelled', 'Cancellato'),
    ], string='Stato', default='available', required=True)
    
    client_name = fields.Char(string='Nome Cliente')
    client_email = fields.Char(string='Email Cliente')
    client_phone = fields.Char(string='Telefono Cliente')
    notes = fields.Text(string='Note')
    
    booked_at = fields.Datetime(string='Prenotato il')
    expires_at = fields.Datetime(string='Scade il')
    
    brand = fields.Char(string='Brand', default='progetto-impresa')

    _sql_constraints = [
        ('token_unique', 'unique(token)', 'Il token deve essere univoco!'),
    ]