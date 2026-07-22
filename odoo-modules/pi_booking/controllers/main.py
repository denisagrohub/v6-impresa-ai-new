from odoo import http
from odoo.http import request
from datetime import datetime, timedelta
import json
import logging

_logger = logging.getLogger(__name__)

class PiBookingController(http.Controller):

    def _get_db(self):
        """Helper per ottenere il database"""
        return request.env

    def _check_api_key(self, api_key):
        """Verifica la API key (da configurare in System Parameters)"""
        configured_key = request.env['ir.config_parameter'].sudo().get_param('pi_booking.api_key')
        return configured_key and api_key == configured_key

    # ============ LISTA SLOT PUBBLICI ============
    @http.route('/api/pi/booking/public-slots', type='json', auth='public', methods=['POST'], csrf=False)
    def get_public_slots(self, **kwargs):
        """
        Ritorna la lista degli slot pubblici disponibili
        Body: { "consultant_id": 123, "start_date": "2026-07-15", "end_date": "2026-08-15" }
        """
        try:
            consultant_id = kwargs.get('consultant_id')
            start_date = kwargs.get('start_date')
            end_date = kwargs.get('end_date')
            
            domain = [
                ('x_pi_is_public', '=', True),
                ('start', '>=', start_date or fields.Date.today()),
            ]
            
            if consultant_id:
                domain.append(('x_pi_consultant_id', '=', int(consultant_id)))
            
            if end_date:
                domain.append(('start', '<=', end_date))
            
            events = request.env['calendar.event'].sudo().search(domain, order='start asc')
            
            slots = []
            for event in events:
                slots.append({
                    'id': event.id,
                    'token': event.x_pi_booking_token,
                    'title': event.name,
                    'date': event.start.strftime('%Y-%m-%d'),
                    'time': event.start.strftime('%H:%M'),
                    'duration': int((event.stop - event.start).total_seconds() / 60),
                    'consultant_name': event.x_pi_consultant_id.name if event.x_pi_consultant_id else None,
                    'consultant_id': event.x_pi_consultant_id.id if event.x_pi_consultant_id else None,
                    'description': event.description or '',
                })
            
            return {'success': True, 'slots': slots}
        
        except Exception as e:
            _logger.error(f'Errore get_public_slots: {str(e)}')
            return {'success': False, 'error': str(e)}

    # ============ PRENOTA SLOT ============
    @http.route('/api/pi/booking/book', type='json', auth='public', methods=['POST'], csrf=False)
    def book_slot(self, **kwargs):
        """
        Prenota uno slot pubblico
        Body: { "token": "booking_xxx", "client_name": "Mario Rossi", "client_email": "mario@example.com", ... }
        """
        try:
            token = kwargs.get('token')
            client_name = kwargs.get('client_name')
            client_email = kwargs.get('client_email')
            client_phone = kwargs.get('client_phone')
            notes = kwargs.get('notes')
            
            if not token or not client_email:
                return {'success': False, 'error': 'Token ed email sono obbligatori'}
            
            # Cerca l'evento per token
            event = request.env['calendar.event'].sudo().search([
                ('x_pi_booking_token', '=', token),
                ('x_pi_is_public', '=', True),
            ], limit=1)
            
            if not event:
                return {'success': False, 'error': 'Slot non trovato'}
            
            # Verifica che non sia già prenotato
            if event.x_pi_client_email:
                return {'success': False, 'error': 'Slot già prenotato'}
            
            # Aggiorna l'evento con i dati del cliente
            event.write({
                'x_pi_client_name': client_name,
                'x_pi_client_email': client_email,
                'x_pi_client_phone': client_phone,
                'x_pi_notes': notes,
                'x_pi_is_public': False,  # Non più pubblico dopo la prenotazione
            })
            
            # Genera link video call
            event.action_generate_meeting_link()
            
            return {
                'success': True,
                'booking': {
                    'id': event.id,
                    'date': event.start.strftime('%Y-%m-%d'),
                    'time': event.start.strftime('%H:%M'),
                    'consultant_name': event.x_pi_consultant_id.name if event.x_pi_consultant_id else None,
                    'meeting_link': event.x_pi_meeting_link,
                }
            }
        
        except Exception as e:
            _logger.error(f'Errore book_slot: {str(e)}')
            return {'success': False, 'error': str(e)}

    # ============ LISTA EVENTI CONSULENTE (per dashboard) ============
    @http.route('/api/pi/booking/consultant-events', type='json', auth='user', methods=['POST'], csrf=False)
    def get_consultant_events(self, **kwargs):
        """
        Ritorna tutti gli eventi di un consulente (richiede autenticazione)
        Body: { "consultant_id": 123, "start_date": "2026-07-01", "end_date": "2026-07-31" }
        """
        try:
            consultant_id = kwargs.get('consultant_id')
            start_date = kwargs.get('start_date')
            end_date = kwargs.get('end_date')
            
            domain = []
            if consultant_id:
                domain.append(('x_pi_consultant_id', '=', int(consultant_id)))
            if start_date:
                domain.append(('start', '>=', start_date))
            if end_date:
                domain.append(('start', '<=', end_date))
            
            events = request.env['calendar.event'].search(domain, order='start asc')
            
            events_list = []
            for event in events:
                events_list.append({
                    'id': event.id,
                    'title': event.name,
                    'description': event.description or '',
                    'date': event.start.strftime('%Y-%m-%d'),
                    'time': event.start.strftime('%H:%M'),
                    'duration': int((event.stop - event.start).total_seconds() / 60),
                    'type': event.x_pi_event_type,
                    'consultant_id': event.x_pi_consultant_id.id if event.x_pi_consultant_id else None,
                    'consultant_name': event.x_pi_consultant_id.name if event.x_pi_consultant_id else None,
                    'client_name': event.x_pi_client_name,
                    'client_email': event.x_pi_client_email,
                    'is_public': event.x_pi_is_public,
                    'booking_token': event.x_pi_booking_token,
                    'meeting_link': event.x_pi_meeting_link,
                })
            
            return {'success': True, 'events': events_list}
        
        except Exception as e:
            _logger.error(f'Errore get_consultant_events: {str(e)}')
            return {'success': False, 'error': str(e)}

    # ============ DISPONIBILITÀ TEAM (solo busy/free) ============
    @http.route('/api/pi/booking/team-availability', type='json', auth='user', methods=['POST'], csrf=False)
    def get_team_availability(self, **kwargs):
        """
        Ritorna la disponibilità del team (solo busy/free, no dettagli)
        Body: { "brand": "progetto-impresa", "start_date": "2026-07-15", "end_date": "2026-07-22" }
        """
        try:
            brand = kwargs.get('brand', 'progetto-impresa')
            start_date = kwargs.get('start_date')
            end_date = kwargs.get('end_date')
            
            # Trova tutti i consulenti del brand
            consultants = request.env['res.partner'].search([
                ('x_pi_is_consultant', '=', True),
                ('x_pi_consultant_brand', '=', brand),
            ])
            
            availability = []
            for consultant in consultants:
                domain = [
                    ('x_pi_consultant_id', '=', consultant.id),
                ]
                if start_date:
                    domain.append(('start', '>=', start_date))
                if end_date:
                    domain.append(('start', '<=', end_date))
                
                events = request.env['calendar.event'].search(domain)
                
                busy_slots = []
                for event in events:
                    busy_slots.append({
                        'date': event.start.strftime('%Y-%m-%d'),
                        'time': event.start.strftime('%H:%M'),
                        'duration': int((event.stop - event.start).total_seconds() / 60),
                        'type': event.x_pi_event_type,
                    })
                
                availability.append({
                    'consultant_id': consultant.id,
                    'consultant_name': consultant.name,
                    'consultant_email': consultant.email,
                    'busy_slots': busy_slots,
                    'total_busy_slots': len(busy_slots),
                })
            
            return {'success': True, 'availability': availability}
        
        except Exception as e:
            _logger.error(f'Errore get_team_availability: {str(e)}')
            return {'success': False, 'error': str(e)}

    # ============ CREA EVENTO ============
    @http.route('/api/pi/booking/create-event', type='json', auth='user', methods=['POST'], csrf=False)
    def create_event(self, **kwargs):
        """
        Crea un nuovo evento calendario
        Body: { "title": "Review SAL 2", "date": "2026-07-20", "time": "10:00", "duration": 60, ... }
        """
        try:
            title = kwargs.get('title')
            date = kwargs.get('date')
            time = kwargs.get('time', '10:00')
            duration = int(kwargs.get('duration', 60))
            consultant_id = kwargs.get('consultant_id')
            project_id = kwargs.get('project_id')
            event_type = kwargs.get('type', 'review')
            is_public = kwargs.get('is_public', False)
            description = kwargs.get('description', '')
            
            if not title or not date:
                return {'success': False, 'error': 'Titolo e data sono obbligatori'}
            
            # Calcola start e stop
            start_dt = datetime.strptime(f'{date} {time}', '%Y-%m-%d %H:%M')
            stop_dt = start_dt + timedelta(minutes=duration)
            
            # Crea l'evento
            event_vals = {
                'name': title,
                'start': start_dt,
                'stop': stop_dt,
                'description': description,
                'x_pi_event_type': event_type,
                'x_pi_is_public': is_public,
            }
            
            if consultant_id:
                event_vals['x_pi_consultant_id'] = int(consultant_id)
                # Aggiungi il consulente come partecipante
                consultant = request.env['res.partner'].browse(int(consultant_id))
                if consultant.exists():
                    event_vals['partner_ids'] = [(4, consultant.id)]
            
            if project_id:
                event_vals['x_pi_project_id'] = int(project_id)
            
            event = request.env['calendar.event'].create(event_vals)
            
            return {
                'success': True,
                'event': {
                    'id': event.id,
                    'title': event.name,
                    'date': event.start.strftime('%Y-%m-%d'),
                    'time': event.start.strftime('%H:%M'),
                    'booking_token': event.x_pi_booking_token,
                }
            }
        
        except Exception as e:
            _logger.error(f'Errore create_event: {str(e)}')
            return {'success': False, 'error': str(e)}

    # ============ ELIMINA EVENTO ============
    @http.route('/api/pi/booking/delete-event', type='json', auth='user', methods=['POST'], csrf=False)
    def delete_event(self, **kwargs):
        """Elimina un evento"""
        try:
            event_id = kwargs.get('event_id')
            if not event_id:
                return {'success': False, 'error': 'ID evento obbligatorio'}
            
            event = request.env['calendar.event'].browse(int(event_id))
            if not event.exists():
                return {'success': False, 'error': 'Evento non trovato'}
            
            event.unlink()
            return {'success': True}
        
        except Exception as e:
            _logger.error(f'Errore delete_event: {str(e)}')
            return {'success': False, 'error': str(e)}