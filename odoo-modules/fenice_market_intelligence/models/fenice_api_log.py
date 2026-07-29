from odoo import models, fields

class FeniceAPILog(models.Model):
    _name = 'fenice.api.log'
    _description = 'Log Chiamate API Esterne'
    _order = 'timestamp desc'

    timestamp = fields.Datetime(string='Timestamp', default=fields.Datetime.now, required=True)
    api_name = fields.Selection([
        ('amazon', 'Amazon Product API'),
        ('google_trends', 'Google Trends'),
        ('open_food_facts', 'Open Food Facts'),
    ], string='API', required=True)
    endpoint = fields.Char(string='Endpoint Chiamato')
    request_data = fields.Text(string='Dati Richiesta (JSON)')
    response_data = fields.Text(string='Dati Risposta (JSON)')
    status_code = fields.Integer(string='Status Code')
    success = fields.Boolean(string='Successo')
    error_message = fields.Text(string='Messaggio Errore')
    duration_ms = fields.Integer(string='Durata (ms)')
    
    # Rate limiting
    remaining_requests = fields.Integer(string='Richieste Rimaste')
    reset_time = fields.Datetime(string='Reset Time')
