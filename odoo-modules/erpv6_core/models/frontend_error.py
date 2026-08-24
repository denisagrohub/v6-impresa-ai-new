from odoo import fields, models


class Erpv6FrontendError(models.Model):
    """Errore JavaScript reale catturato nel browser di un utente (24/08/2026,
    richiesto esplicitamente da Denis: "vorrei che Kaizen scoprisse anche
    altri problemi... se apro una pagina e appare un errore"). Dato
    STRUTTURATO (non testo libero di log server): il client manda qui
    messaggio/url/stack via l'endpoint pubblico dedicato
    (erpv6_api_gateway/controllers/frontend_error_api.py), popolato dal
    piccolo aggancio JS in erpv6_core/static/src/js/error_reporter.js.
    Kaizen legge SOLO i campi qui sotto (mai il testo grezzo di un log
    server), stesso principio non negoziabile gia' seguito ovunque nel
    sensore (vedi erpv6_kaizen/models/kaizen_detected_signal.py)."""
    _name = 'erpv6.frontend.error'
    _description = 'Errore JavaScript catturato nel browser'
    _order = 'occurred_at desc'

    message = fields.Char(string='Messaggio', required=True)
    url = fields.Char(string='Pagina')
    stack = fields.Text(string='Stack trace')
    user_agent = fields.Char(string='Browser/User Agent')
    occurred_at = fields.Datetime(string='Avvenuto il', default=fields.Datetime.now, required=True)
    user_id = fields.Many2one('res.users', string='Utente (se autenticato)')
    blocking = fields.Boolean(
        string='Blocca la pagina', default=False,
        help="Vero SOLO quando il campo strutturato 'name' dell'errore JS catturato e' "
             "'OwlError' (24/08/2026, richiesto esplicitamente da Denis dopo aver visto un "
             "errore reale classificato solo 'near_miss': \"un problema che mi blocca "
             "l'accesso ad una pagina non e' un near miss\"). OwlError e' la classe fissa "
             "che il framework Owl usa quando il rendering/lifecycle di un componente "
             "fallisce -- tipicamente l'intera vista non si carica. Calcolato lato client "
             "(error_reporter.js) su .name, mai dedotto qui dal testo del messaggio.")
