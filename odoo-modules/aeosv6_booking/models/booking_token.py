from odoo import api, fields, models, _
from odoo.exceptions import UserError
from datetime import timedelta
import logging
import secrets
import string

_logger = logging.getLogger(__name__)

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

    # 10/09/2026 (Denis: "quando arriva la prenotazione della call...
    # dobbiamo inserire l'orario e il giorno in cui la programmiamo...
    # ogni cambiamento deve essere comunicato anche al lead, che puo'
    # solo confermare o cambiare data ed ora") - prima non esisteva
    # NESSUN campo per l'orario reale della call (il flusso era solo
    # "il consulente ricontatta a voce"): scheduled_at e' la data/ora
    # proposta o confermata, confirmation_state il ciclo di conferma,
    # confirmation_token il link pubblico che il cliente usa per
    # rispondere (stesso pattern di token pubblico gia' in uso su
    # questo stesso modello per la prenotazione iniziale).
    scheduled_at = fields.Datetime('Data/Ora Call')
    confirmation_state = fields.Selection([
        ('da_proporre', 'Da proporre'),
        ('proposta', 'Proposta - in attesa conferma cliente'),
        ('confermata', 'Confermata dal cliente'),
        ('da_riprogrammare', 'Il cliente ha chiesto di cambiare'),
    ], default='da_proporre', required=True, tracking=True)
    reschedule_note = fields.Text('Nota del cliente su un nuovo orario')
    confirmation_token = fields.Char('Token Conferma Cliente', index=True, copy=False)

    _sql_constraints = [
        ('token_unique', 'unique(token)', 'Il token deve essere univoco!'),
        ('confirmation_token_unique', 'unique(confirmation_token)', 'Il token di conferma deve essere univoco!'),
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

    def _generate_confirmation_token(self):
        alphabet = string.ascii_letters + string.digits
        return 'confirm_' + ''.join(secrets.choice(alphabet) for _ in range(24))

    def action_propose_schedule(self, scheduled_at, consultant_id=None):
        """Propone (o aggiorna) data/ora della call e avvisa il cliente
        per davvero via email con un link pubblico di conferma - MAI
        confermata in automatico, solo il cliente puo' farlo (Denis:
        'che puo' solo confermare o cambiare data ed ora'). Riassegnare
        il consulente qui e' la stessa azione, non un secondo passaggio -
        il cliente vede sempre lo stato coerente in una sola email."""
        self.ensure_one()
        if not self.client_email:
            raise UserError(_("Questa prenotazione non ha un'email cliente: impossibile avvisare del nuovo orario."))

        vals = {'scheduled_at': scheduled_at, 'confirmation_state': 'proposta', 'reschedule_note': False}
        if consultant_id:
            vals['consultant_id'] = consultant_id
        if not self.confirmation_token:
            vals['confirmation_token'] = self._generate_confirmation_token()
        self.write(vals)

        self._send_schedule_email(
            subject=_('Proponiamo un orario per la tua call'),
            intro=_('Ti proponiamo il seguente orario per la call con %s:') % self.consultant_id.partner_id.name,
        )
        return True

    def _send_schedule_email(self, subject, intro):
        self.ensure_one()
        base_url = self.env['ir.config_parameter'].sudo().get_param('web.base.url', 'https://www.v6impresa.it')
        confirm_url = f"{base_url}/booking/confirm/{self.confirmation_token}"
        default_from = self.env['ir.config_parameter'].sudo().get_param('mail.default.from', 'noreply@v6impresa.it')
        email_from = default_from if '@' in default_from else 'noreply@v6impresa.it'
        data_str = self.scheduled_at.strftime('%d/%m/%Y alle %H:%M') if self.scheduled_at else ''
        self.env['mail.mail'].sudo().create({
            'email_from': email_from,
            'email_to': self.client_email,
            'subject': subject,
            'body_html': (
                f"<p>{intro}</p>"
                f"<p style='font-size:18px;font-weight:bold;'>{data_str}</p>"
                f"<p><a href='{confirm_url}'>Conferma o richiedi un cambio</a></p>"
            ),
            'auto_delete': False,
        }).send()

    def action_client_confirm(self):
        """Chiamata SOLO dalla pagina pubblica di conferma (token nel
        link, mai da un'azione admin) - la conferma e' del cliente, non
        nostra."""
        self.ensure_one()
        self.write({'confirmation_state': 'confermata'})
        self.message_post(body=_('Il cliente ha confermato l\'orario proposto (%s).') % (
            self.scheduled_at.strftime('%d/%m/%Y %H:%M') if self.scheduled_at else ''))
        return True

    def action_client_request_change(self, note=None):
        """Chiamata SOLO dalla pagina pubblica di conferma."""
        self.ensure_one()
        self.write({'confirmation_state': 'da_riprogrammare', 'reschedule_note': note or False})
        self.message_post(body=_('Il cliente ha chiesto di cambiare orario. Nota: %s') % (note or '—'))
        return True

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
