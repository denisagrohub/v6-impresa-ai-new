from odoo import models, fields, api
from datetime import datetime, timedelta
import secrets
import string

class CalendarEvent(models.Model):
    _inherit = 'calendar.event'

    # Campi custom per Progetto Impresa
    x_pi_project_id = fields.Many2one(
        'crm.lead', 
        string='Progetto Collegato',
        help='Progetto a cui è collegato questo evento'
    )
    x_pi_consultant_id = fields.Many2one(
        'res.partner',
        string='Consulente Assegnato',
        help='Consulente che gestisce questo appuntamento'
    )
    x_pi_brand_id = fields.Char(
        string='Brand',
        default='progetto-impresa',
        help='Brand del progetto (progetto-impresa, zero-sprechi, etc)'
    )
    x_pi_is_public = fields.Boolean(
        string='Slot Pubblico',
        default=False,
        help='Se attivo, questo slot è prenotabile dal pubblico'
    )
    x_pi_booking_token = fields.Char(
        string='Token Prenotazione',
        index=True,
        copy=False,
        help='Token univoco per la prenotazione pubblica'
    )
    x_pi_client_name = fields.Char(
        string='Nome Cliente (Pubblico)',
        help='Nome del cliente che ha prenotato lo slot pubblico'
    )
    x_pi_client_email = fields.Char(
        string='Email Cliente (Pubblico)',
        help='Email del cliente che ha prenotato lo slot pubblico'
    )
    x_pi_client_phone = fields.Char(
        string='Telefono Cliente (Pubblico)')
    x_pi_notes = fields.Text(
        string='Note Cliente',
        help='Note aggiuntive del cliente'
    )
    x_pi_event_type = fields.Selection([
        ('discovery', 'Call Discovery (30 min, gratuita)'),
        ('review', 'Review Progetto (60 min, inclusa)'),
        ('call', 'Consulenza Extra (60 min, €150)'),
        ('public', 'Slot Pubblico'),
    ], string='Tipo Evento', default='review')
    x_pi_lead_id = fields.Many2one(
        'crm.lead',
        string='Lead Generato',
        help='Lead CRM creato automaticamente dalla prenotazione'
    )
    x_pi_meeting_link = fields.Char(
        string='Link Video Call',
        help='Link alla video call (Daily.co, Zoom, etc)'
    )
    x_pi_reminder_sent = fields.Boolean(
        string='Reminder Inviato',
        default=False
    )
    x_pi_sync_google_id = fields.Char(
        string='Google Calendar Event ID',
        help='ID evento su Google Calendar (per sync bidirezionale)'
    )

    @api.model_create_multi
    def create(self, vals_list):
        events = super().create(vals_list)
        for event in events:
            # Genera token se è uno slot pubblico
            if event.x_pi_is_public and not event.x_pi_booking_token:
                event.x_pi_booking_token = event._generate_booking_token()
            
            # Crea lead CRM se è una prenotazione pubblica con dati cliente
            if event.x_pi_client_email and not event.x_pi_lead_id:
                event._create_crm_lead()
            
            # Invia email di conferma
            if event.x_pi_client_email:
                event._send_confirmation_email()
        
        return events

    def write(self, vals):
        result = super().write(vals)
        # Se cambia lo stato o i dati cliente, invia notifiche
        if 'x_pi_client_email' in vals and vals['x_pi_client_email']:
            for event in self:
                if not event.x_pi_lead_id:
                    event._create_crm_lead()
        return result

    def _generate_booking_token(self):
        """Genera un token univoco per la prenotazione"""
        alphabet = string.ascii_letters + string.digits
        token = 'booking_' + ''.join(secrets.choice(alphabet) for _ in range(24))
        # Verifica univocità
        while self.search([('x_pi_booking_token', '=', token)], limit=1):
            token = 'booking_' + ''.join(secrets.choice(alphabet) for _ in range(24))
        return token

    def _create_crm_lead(self):
        """Crea automaticamente un lead CRM dalla prenotazione"""
        if not self.x_pi_client_email:
            return
        
        lead_vals = {
            'name': f'Booking: {self.x_pi_client_name or "Cliente"} - {self.name}',
            'contact_name': self.x_pi_client_name,
            'email_from': self.x_pi_client_email,
            'phone': self.x_pi_client_phone,
            'description': f"""
Prenotazione automatica dal sito web.

Evento: {self.name}
Data: {self.start.strftime('%d/%m/%Y %H:%M')}
Consulente: {self.x_pi_consultant_id.name if self.x_pi_consultant_id else 'Non assegnato'}
Note: {self.x_pi_notes or 'Nessuna nota'}
            """.strip(),
            'type': 'lead',
            'user_id': self.x_pi_consultant_id.user_id.id if self.x_pi_consultant_id and self.x_pi_consultant_id.user_id else False,
            'source_id': self.env.ref('pi_booking.source_booking_public', raise_if_not_found=False).id if self.env.ref('pi_booking.source_booking_public', raise_if_not_found=False) else False,
        }
        
        lead = self.env['crm.lead'].create(lead_vals)
        self.x_pi_lead_id = lead.id

    def _send_confirmation_email(self):
        """Invia email di conferma al cliente e notifica al consulente"""
        template = self.env.ref('pi_booking.email_booking_confirmation', raise_if_not_found=False)
        if template:
            try:
                template.send_mail(self.id, force_send=True)
            except Exception as e:
                self.env['ir.logging'].sudo().create({
                    'name': 'pi_booking',
                    'type': 'server',
                    'level': 'ERROR',
                    'message': f'Errore invio email conferma: {str(e)}',
                    'path': 'calendar.event._send_confirmation_email',
                    'func': '_send_confirmation_email',
                    'line': '0',
                })

    def action_generate_meeting_link(self):
        """Genera un link per la video call (placeholder per Daily.co/Zoom)"""
        for event in self:
            # In produzione: chiama API Daily.co o Zoom
            # Per ora genera un link placeholder
            event.x_pi_meeting_link = f'https://meet.progettoimpresa.it/{event.x_pi_booking_token or event.id}'
        
        return {
            'type': 'ir.actions.client',
            'tag': 'display_notification',
            'params': {
                'title': 'Link Generato',
                'message': 'Link video call generato con successo',
                'type': 'success',
                'sticky': False,
            }
        }