import logging

from odoo import api, fields, models

_logger = logging.getLogger(__name__)


class Erpv6KairosScoringRule(models.Model):
    """Mapping runtime-configurabile da risposta grezza dell'intervista
    (stringhe ESATTE delle opzioni in apps/impresa/src/app/intervista/page.tsx
    -- vincolo tecnico reale, mai spostato) a punteggio erpv6.kairos.matrix.

    Corretto qui il 23/08/2026 (audit "motore vs conoscenza" su CLAUDE.md):
    prima erano 3 dizionari Python (_KAIROS_BUDGET_TO_IMPATTO,
    _KAIROS_BUDGET_TO_LIQUIDITA, _KAIROS_TEMPISTICHE_TO_URGENZA in
    production_order.py) -- regole di business reali (quanto vale ogni
    fascia di budget/tempistiche), non tecniche, quindi non dovevano
    richiedere un promote del modulo per essere corrette. Ora sono righe di
    questo modello, seminate con i valori originali in
    data/kairos_scoring_rule_data.xml (noupdate="1", un admin le modifica
    da un elenco Odoo normale) e lette a runtime da
    erpv6.production.order._compute_kairos_matrix via get_score().

    Un piccolo modello dedicato (non erpv6.kb) perche' il dato e' un
    mapping chiave->valore ESATTO (interi 1-5) che guida direttamente un
    punteggio -- una voce KB testuale richiederebbe un'AI o un parsing
    fragile per estrarne di nuovo un numero preciso, rischio di errore
    inaccettabile per un punteggio che alimenta erpv6.kairos.matrix."""
    _name = 'erpv6.kairos.scoring.rule'
    _description = 'Regola di Punteggio Kairós (risposta intervista -> matrice)'
    _order = 'indicator, sequence, id'

    indicator = fields.Selection([
        ('budget_impatto', "Budget -> Impatto"),
        ('budget_liquidita', "Budget -> Liquidità"),
        ('tempistiche_urgenza', "Tempistiche -> Urgenza"),
    ], string='Indicatore', required=True, index=True)
    answer_label = fields.Char(
        string="Opzione Intervista (testo esatto)", required=True,
        help="Deve corrispondere ESATTAMENTE a una delle stringhe opzione per il campo "
             "budget/tempistiche in apps/impresa/src/app/intervista/page.tsx -- vincolo "
             "tecnico reale: se il frontend cambia queste stringhe, questa tabella va "
             "allineata di conseguenza, altrimenti la risposta smette di essere riconosciuta "
             "(stesso comportamento di prima: nessun punteggio inventato, matrice non creata, "
             "vedi _compute_kairos_matrix).")
    score = fields.Integer(string='Punteggio (1-5)', required=True)
    sequence = fields.Integer(default=10)
    active = fields.Boolean(default=True)

    _sql_constraints = [
        ('uniq_indicator_label', 'UNIQUE(indicator, answer_label)',
         "Esiste gia' una regola per questo indicatore e questa opzione di risposta."),
    ]

    @api.model
    def get_score(self, indicator, answer_label):
        """None se non c'e' nessuna regola attiva per questa combinazione
        (opzione intervista non riconosciuta, es. il frontend e' cambiato) --
        il chiamante decide cosa fare (production_order.py._compute_kairos_matrix
        logga un warning e non crea nessuna matrice, mai un punteggio
        inventato al posto di uno mancante -- stesso comportamento di prima)."""
        rule = self.search([
            ('indicator', '=', indicator), ('answer_label', '=', answer_label), ('active', '=', True),
        ], limit=1)
        return rule.score if rule else None

    @api.model
    def get_neutro_score(self):
        """Valore neutro per gli indicatori senza segnale diretto
        nell'intervista attuale (apertura del titolare, risorse interne
        diverse dal budget, storico bancario) -- ir.config_parameter invece
        di una riga di questo modello: e' un singolo valore scalare, non un
        mapping chiave->valore, un modello dedicato sarebbe sovradimensionato."""
        return int(self.env['ir.config_parameter'].sudo().get_param(
            'erpv6_production.kairos_neutro_score', default='2'))
