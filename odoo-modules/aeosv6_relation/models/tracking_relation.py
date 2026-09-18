from odoo import _, api, fields, models
from odoo.exceptions import ValidationError


class Erpv6TrackingRelation(models.Model):
    """Motore generico per archi/gerarchia progetto<->parte (Denis, prompt
    TEE 04/09/2026). Non esisteva come modello reale prima di questo
    modulo -- la sola menzione trovata nel codice era una decisione del
    24/08 di NON costruirlo per gli archi concettuali agente<->proposta
    (quelli restano su Neo4j, vedi erpv6_agent/models/agent_neo4j_client.py).
    Questo modello copre un caso diverso: relazioni progetto/parte che
    devono essere interrogabili subito da una view Odoo (dashboard OWL),
    non archi concettuali per un motore di pattern-matching -- per questo
    resta una tabella SQL semplice, non un arco Neo4j."""
    _name = 'erpv6.tracking.relation'
    _description = 'Relazione di Tracciamento Progetto/Parte'
    _inherit = ['mail.thread']
    _parent_name = 'parent_id'
    _parent_store = True
    _rec_name = 'name'

    name = fields.Char(required=True, tracking=True)
    active = fields.Boolean(default=True)

    parent_id = fields.Many2one(
        'erpv6.tracking.relation', string='Nodo Padre',
        index=True, ondelete='cascade', tracking=True,
    )
    parent_path = fields.Char(index=True)
    child_ids = fields.One2many(
        'erpv6.tracking.relation', 'parent_id', string='Nodi Figlio',
    )

    # 17/09/2026 (Denis): distinguere "parti" (controparti reali con
    # partner_id) da "sotto-progetti" (rami operativi con pipeline
    # propria, es. acquisizione aziende). Senza questo campo i figli
    # finivano tutti nella tab Persone/Parti del padre.
    child_kind = fields.Selection([
        ('parte', 'Parte'),
        ('sotto_progetto', 'Sotto-progetto'),
        ('pipeline', 'Pipeline operativa'),
    ], string='Tipo Nodo', default='parte', tracking=True,
        help="Classifica il ruolo del nodo rispetto al padre: 'parte' per "
             "controparti reali (tipicamente con partner_id valorizzato), "
             "'sotto_progetto'/'pipeline' per rami operativi con vita "
             "propria (es. acquisizione aziende con la sua pipeline).")

    # Specifica futura (Denis, 17/09/2026): access control per-utente.
    # Oggi Denis vede tutto. Record rules Odoo filtreranno su questi
    # campi quando ci saranno utenti reali oltre a Denis.
    owner_user_id = fields.Many2one(
        'res.users', string='Responsabile',
        help="Utente con responsabilita' principale del nodo.")
    access_user_ids = fields.Many2many(
        'res.users', 'erpv6_tracking_relation_access_rel',
        'relation_id', 'user_id', string='Accesso consentito',
        help="Utenti autorizzati a vedere il nodo oltre al responsabile.")

    partner_id = fields.Many2one(
        'res.partner', string='Parte Collegata', tracking=True,
        help="La controparte (cliente, trader, ente...) che questo nodo "
             "rappresenta. Vuoto sul nodo padre.",
    )

    ruolo = fields.Selection([
        ('gestore', 'Gestore'),
        ('parte_attiva', 'Parte Attiva'),
        ('osservatore', 'Osservatore'),
    ], string='Ruolo', tracking=True)

    posta_in_gioco = fields.Selection([
        ('standard', 'Standard'),
        ('alta', 'Alta'),
    ], string='Posta in Gioco', default='standard', tracking=True)

    mandato = fields.Selection([
        ('pieno', 'Pieno'),
        ('parziale', 'Parziale'),
        ('nessuno', 'Nessuno'),
        ('non_applicabile', 'Non Applicabile'),
    ], string='Mandato',
        help='Rilevante solo per archi tra parti che negoziano per conto '
             'di altre (es. consulente->trader).')

    # 18/09/2026 (Denis: "Scouting Relazione = profilo target del progetto,
    # non di singola azienda"): JSON versionato col profilo di eleggibilità
    # (settore target, fatturato minimo, area geo, criteri fit). Stessa
    # struttura del x_v6_scouting su res.partner (schemaVersion/version/...)
    # ma applicato alla relazione progetto/sotto-progetto.
    x_v6_scouting = fields.Text(
        string='Scouting Relazione (JSON)',
        help="Profilo target del progetto: settore, dimensioni, area "
             "geografica, criteri di eleggibilita'. Alimenta lo scoring "
             "dello scouting aziende e resta storicizzato per versione.",
    )

    email_alias = fields.Char(
        string='Alias Email (local-part)', tracking=True,
        help="Dal 05/09/2026 va normalmente sul nodo PADRE (progetto): "
             "es. 'progetto-tee' per progetto-tee@v6sviluppoimpresa.it, "
             "l'indirizzo unico che le parti esterne mettono in copia "
             "scrivendosi sulle loro email personali -- chi ha scritto si "
             "riconosce dal mittente confrontato con partner_id.email dei "
             "nodi figlio (vedi route_project_email in aeosv6_dispatch.py), "
             "non serve un alias per parte. Resta comunque possibile un "
             "alias diretto su un nodo figlio (pattern precedente) se serve "
             "un indirizzo dedicato a una singola parte.",
    )

    richiede_nda = fields.Boolean(
        string='Richiede NDA/Contratto prima di attivazione',
        default=False, tracking=True,
    )
    contract_ids = fields.One2many(
        'erpv6.contract', 'relation_id', string='Contratti Collegati',
    )
    nda_gate_ok = fields.Boolean(
        string='Gate NDA Soddisfatto', compute='_compute_nda_gate_ok', store=True,
    )

    document_ids = fields.Many2many(
        'erpv6.library.document', string='Documenti',
        compute='_compute_document_ids',
    )

    def _compute_document_ids(self):
        Document = self.env['erpv6.library.document']
        for rec in self:
            rec.document_ids = Document.search([
                ('source_model', '=', 'erpv6.tracking.relation'),
                ('source_res_id', '=', rec.id),
            ])

    @api.depends('richiede_nda', 'contract_ids.document_ids.doc_type',
                 'contract_ids.document_ids.signed_at')
    def _compute_nda_gate_ok(self):
        for rec in self:
            if not rec.richiede_nda:
                rec.nda_gate_ok = True
                continue
            signed_nda = rec.contract_ids.document_ids.filtered(
                lambda d: d.doc_type == 'nda' and d.signed_at
            )
            rec.nda_gate_ok = bool(signed_nda)

    _sql_constraints = [
        ('email_alias_unique', 'unique(email_alias)',
         "Questo alias email e' gia' assegnato a un altro nodo."),
    ]

    @api.constrains('parent_id')
    def _check_parent_not_self(self):
        if self._has_cycle():
            raise ValidationError(
                _("Non e' possibile creare un ciclo tra nodi padre/figlio."))

    @api.model_create_multi
    def create(self, vals_list):
        """Default owner_user_id: chi crea (17/09/2026)."""
        for vals in vals_list:
            if not vals.get('owner_user_id'):
                vals['owner_user_id'] = self.env.uid
        return super().create(vals_list)

    def can_communicate(self):
        """Usato dal parser email (Fase 2) e dal digest (Fase 3) come gate
        unico prima di inviare qualunque comunicazione sostanziale verso
        questo nodo."""
        self.ensure_one()
        return self.nda_gate_ok
