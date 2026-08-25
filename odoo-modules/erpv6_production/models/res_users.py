from odoo import fields, models


class ResUsers(models.Model):
    """Estende il consulente (res.users, gruppo erpv6_core.group_consulente)
    con i due dati che l'assegnazione automatica dei lead deve conoscere
    (Denis, 25/08/2026): su QUALI tipologie di richiesta e' competente, e
    IN QUALI province opera. Entrambi vuoti per un consulente = nessun
    automatismo lo sceglie mai (vedi crm_lead._find_eligible_consulenti/
    _find_zona_consulente) - mai un default che lo renda eleggibile per
    tutto/dappertutto senza che qualcuno lo abbia dichiarato davvero,
    coerente con la regola anti-allucinazione del progetto. Per Stefano
    Puglisi e Martina Garbin questi campi restano vuoti finche' Denis non
    fornisce i dati reali (vedi odoo-modules/erpv6_core/data/consulenti.xml)."""
    _inherit = 'res.users'

    competenza_verticale_ids = fields.Many2many(
        'erpv6.vertical.catalog',
        'erpv6_user_competenza_verticale_rel', 'user_id', 'verticale_id',
        string='Competenze (tipologie di progetto)',
        help="Tipologie di progetto/verticali (erpv6.vertical.catalog) per cui questo consulente e' "
             "abilitato a lavorare - es. 'un consulente specializzato in economia del bene comune non "
             "puo' gestire un lead che vuole il fotovoltaico' (Denis, 25/08/2026). Essere competente su "
             "un prodotto generico (padre) vale automaticamente anche per le sue varianti (figli). Vuoto "
             "= nessuna competenza dichiarata: l'assegnazione automatica non sceglie mai questo "
             "consulente per un lead che ha un verticale specifico richiesto (vedi "
             "crm.lead._find_eligible_consulenti) - va configurato esplicitamente, mai dedotto.")
    zona_competenza_state_ids = fields.Many2many(
        'res.country.state',
        'erpv6_user_zona_competenza_rel', 'user_id', 'state_id',
        string='Zona di competenza (province)',
        help="Province (res.country.state, stesso campo gia' usato su crm.lead/res.partner per "
             "l'indirizzo) in cui questo consulente opera - usato per l'assegnazione automatica "
             "geografica (criterio 2, dopo lo storico cliente). Vuoto = nessuna zona dichiarata: "
             "l'assegnazione automatica per zona non trova mai questo consulente, mai un'assegnazione "
             "a caso (vedi crm.lead._find_zona_consulente).")
