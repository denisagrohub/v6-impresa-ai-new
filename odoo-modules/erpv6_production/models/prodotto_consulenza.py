from odoo import _, api, fields, models
from odoo.exceptions import UserError

from .consulente_assignment import _check_responsabile_o_admin


class Erpv6ProdottoConsulenza(models.Model):
    """Prodotto di consulenza (Compito "wizard-prodotto-consulenza",
    25/08/2026): compone un vero product.product Odoo (per quotazione/
    fatturazione con Sales/Fatturazione nativa - "i prodotti devono essere
    collegati ai prodotti di Odoo", Denis) con una sequenza ORDINATA di
    fasi scelte dal catalogo gia' esistente (erpv6.production.phase, mai
    duplicato: qui si SCEGLIE quali fasi usare e in che ordine, non se ne
    creano di nuove a meno che serva davvero una fase nuova nel catalogo).

    Fa anche da "wizard" di composizione: non e' un TransientModel a step
    perche' e' configurazione che deve persistere (un prodotto reale, non
    un'operazione una tantum) - la scelta idiomatica in Odoo 18 per
    comporre una struttura del genere e' un form con un one2many editabile
    (fase_ids), come gia' fanno erpv6.kb.import.wizard.line o le distinte
    base standard - non una sequenza di schermate separate.

    Chi puo' crearlo/modificarlo (decisione esplicita di Denis, notte
    24-25/08/2026): "solo Admin, o un Responsabile ma SOLO dentro il
    proprio dominio/reparto". Il gruppo "Responsabile" come tale NON esiste
    ancora su main: riusiamo lo stesso doppio-varco gia' introdotto ieri
    notte da consulente_assignment.py (RESPONSABILE_GROUPS =
    sales_team.group_sale_manager + base.group_system), invece di inventare
    un terzo meccanismo di permesso. Lo scope "SOLO dentro il proprio
    dominio/reparto" NON e' implementato qui: sales_team.group_sale_manager
    e' un permesso trasversale (nessun concetto di "reparto" esiste ancora
    nel progetto per i prodotti) - segnalato esplicitamente nel report
    finale, da confermare con Denis."""
    _name = 'erpv6.prodotto.consulenza'
    _description = 'Prodotto di Consulenza (fasi + NDA/contratto/pagamento)'
    _order = 'name'

    name = fields.Char(required=True)
    product_id = fields.Many2one(
        'product.product', string='Prodotto Odoo', required=True, ondelete='cascade',
        # ondelete='cascade' esplicito (bug reale trovato il 25/08/2026,
        # "urgente" - DB staging condiviso bloccato per tutti gli agenti):
        # senza ondelete esplicito, Odoo forza 'restrict' su un Many2one
        # required=True (nessun modo di lasciare NULL una colonna NOT
        # NULL). Con 'restrict' reale sulla FK Postgres
        # (erpv6_prodotto_consulenza_product_id_fkey ON DELETE RESTRICT,
        # confermato con \d+ sul DB), il cleanup automatico di Odoo a fine
        # aggiornamento modulo (ir.model.data._process_end, che cancella i
        # record il cui external id non risulta piu' dichiarato nei data
        # file del modulo appena caricato) andava in errore ogni volta che
        # QUALUNQUE altro checkout di erpv6_production senza
        # data/prodotto_consulenza_data.xml veniva promosso sullo stesso DB
        # condiviso 'erpv6' - bloccando l'update del modulo per chiunque,
        # non solo per questo branch. 'cascade' e' la scelta corretta per
        # un Many2one required verso un record che PUO' legittimamente
        # sparire in un ambiente multi-branch condiviso: se il
        # product.product collegato viene rimosso, questa configurazione
        # non ha piu' senso da sola e deve sparire con lui (a cascata
        # elimina anche fase_ids, gia' ondelete='cascade' sul proprio
        # parent; production_order.prodotto_id e' gia' ondelete='set null',
        # quindi le produzioni reali non vengono mai cancellate da questo).
        help="Il prodotto Odoo reale (product.product) collegato - usato per la quotazione/fatturazione "
             "nativa (Vendite/Fatturazione), mai un sistema di pagamento custom."
    )
    active = fields.Boolean(default=True)
    description = fields.Text()
    fase_ids = fields.One2many(
        'erpv6.prodotto.consulenza.fase', 'prodotto_id', string='Fasi del Prodotto', copy=True)

    @api.model_create_multi
    def create(self, vals_list):
        # self.env.su: il caricamento dati XML (module install/update) gira
        # con l'utente di sistema in modalita' superuser - mai bloccato da
        # questo controllo, che riguarda solo un utente reale in UI (vedi
        # docstring della classe).
        if not self.env.su:
            _check_responsabile_o_admin(self.env, _("creare un nuovo prodotto di consulenza"))
        return super().create(vals_list)

    def write(self, vals):
        if not self.env.su:
            _check_responsabile_o_admin(self.env, _("modificare un prodotto di consulenza"))
        return super().write(vals)


class Erpv6ProdottoConsulenzaFase(models.Model):
    """Una riga di configurazione: QUALE fase del catalogo (phase_id) e in
    che ordine (sequence) fa parte di questo prodotto, con i flag NDA/
    contratto/pagamento richiesti da Denis. Il flag NDA/contratto vive
    sulla fase DOPO cui scatta (es. richiede_nda=True sulla fase "Ricezione
    informazioni" vuol dire: appena questa fase si chiude, si attiva
    l'NDA) - non su ogni fase, coerente con "un NDA/contratto unico per
    cliente/progetto"."""
    _name = 'erpv6.prodotto.consulenza.fase'
    _description = 'Fase configurata dentro un Prodotto di Consulenza'
    _order = 'sequence, id'

    prodotto_id = fields.Many2one(
        'erpv6.prodotto.consulenza', string='Prodotto', required=True, ondelete='cascade', index=True)
    phase_id = fields.Many2one(
        'erpv6.production.phase', string='Fase (catalogo)', required=True,
        help="Fase riusata dal catalogo condiviso erpv6.production.phase - mai una fase duplicata qui.")
    sequence = fields.Integer(default=10)

    richiede_nda = fields.Boolean(
        string='Richiede NDA',
        help="Se True: alla chiusura di QUESTA fase viene garantito un NDA sul contratto del cliente/"
             "progetto (creato se non esiste gia' - un solo NDA per cliente/progetto, non uno per fase).")
    richiede_contratto = fields.Boolean(
        string='Richiede Contratto',
        help="Se True: alla chiusura di questa fase viene garantito un documento contrattuale - "
             "'Contratto' vero se il primo SAL/tranche e' gia' incassato su questa produzione, altrimenti "
             "una 'Promessa di Pagamento' (stessa infrastruttura firma, contenuto diverso).")
    richiede_pagamento = fields.Boolean(
        string='Richiede Pagamento',
        help="Se True: l'avanzamento OLTRE questa fase resta bloccato (gate 'procedi' su "
             "erpv6.agent.confirmation) finche' le tranche/il pagamento configurato qui non risultano "
             "confermati con un'azione umana.")
    pagamento_tipo = fields.Selection([
        ('tranche', 'A Tranche (SAL)'),
        ('unico', 'Pagamento Unico'),
    ], string='Tipo Pagamento', default='tranche',
        help="'tranche': il numero di SAL e' configurabile (numero_tranche). 'unico': caso speciale "
             "richiesto da Denis per i prodotti a basso costo con corpo fisso - un solo importo, "
             "pagato in un'unica soluzione.")
    numero_tranche = fields.Integer(
        string='Numero Tranche (SAL)', default=1,
        help="Usato solo se pagamento_tipo='tranche' e richiede_pagamento=True.")
    importo_pagamento_unico = fields.Monetary(
        string='Importo Pagamento Unico', currency_field='currency_id',
        help="Usato solo se pagamento_tipo='unico'.")
    currency_id = fields.Many2one('res.currency', default=lambda self: self.env.company.currency_id)

    _sql_constraints = [
        ('prodotto_fase_unique', 'unique(prodotto_id, phase_id)',
         "Questa fase e' gia' presente in questo prodotto."),
    ]

    @api.constrains('richiede_pagamento', 'pagamento_tipo', 'numero_tranche')
    def _check_numero_tranche(self):
        for fase in self:
            if fase.richiede_pagamento and fase.pagamento_tipo == 'tranche' and fase.numero_tranche < 1:
                raise UserError(_(
                    "'%s': se richiede pagamento a tranche, il numero di tranche deve essere almeno 1."
                ) % fase.display_name)

    @api.model_create_multi
    def create(self, vals_list):
        if not self.env.su:
            _check_responsabile_o_admin(self.env, _("configurare le fasi di un prodotto di consulenza"))
        return super().create(vals_list)

    def write(self, vals):
        if not self.env.su:
            _check_responsabile_o_admin(self.env, _("configurare le fasi di un prodotto di consulenza"))
        return super().write(vals)


class Erpv6ProductionOrderTranche(models.Model):
    """Tracciamento delle tranche/SAL di UNA produzione reale (non del
    catalogo prodotto - quello dice solo "quante tranche servono", questo
    e' l'istanza vera creata su un erpv6.production.order specifico, vedi
    Erpv6ProductionOrder._ensure_tranches_for). Volutamente minimale: "non
    serve integrare un vero sistema di pagamento esterno - un campo/azione
    che segna 'tranche X incassata', lo confermi con un'azione umana"
    (Denis) - nessuna fattura/pagamento reale generato qui, quella e'
    un'integrazione fuori scope di questo compito."""
    _name = 'erpv6.production.order.tranche'
    _description = 'Tranche di Pagamento (SAL) di una Produzione'
    _order = 'tranche_number'

    order_id = fields.Many2one(
        'erpv6.production.order', string='Produzione', required=True, ondelete='cascade', index=True)
    fase_config_id = fields.Many2one(
        'erpv6.prodotto.consulenza.fase', string='Fase (configurazione prodotto)',
        required=True, ondelete='restrict')
    tranche_number = fields.Integer(string='Tranche N.', required=True)
    name = fields.Char(compute='_compute_name', store=True)
    importo = fields.Monetary(currency_field='currency_id')
    currency_id = fields.Many2one('res.currency', default=lambda self: self.env.company.currency_id)
    stato = fields.Selection([
        ('da_incassare', 'Da incassare'),
        ('incassata', 'Incassata'),
    ], default='da_incassare', required=True)
    data_incasso = fields.Date(readonly=True)
    confirmed_by = fields.Many2one('res.users', readonly=True)
    notes = fields.Text()

    @api.depends('order_id', 'tranche_number')
    def _compute_name(self):
        for tranche in self:
            tranche.name = _("Tranche %(n)s - %(order)s") % {
                'n': tranche.tranche_number, 'order': tranche.order_id.name}

    def write(self, vals):
        # Difesa in profondita' (stesso pattern gia' seguito in
        # consulente_assignment.py): non deve bastare nascondere il
        # bottone action_marca_incassata in UI, una write ORM diretta su
        # 'stato' deve restare riservata a Responsabile/Admin - e' il campo
        # che sblocca il gate di pagamento sulla produzione.
        if 'stato' in vals and not self.env.su:
            _check_responsabile_o_admin(self.env, _("modificare lo stato di incasso di una tranche"))
        return super().write(vals)

    def action_marca_incassata(self):
        for tranche in self:
            if not self.env.su:
                _check_responsabile_o_admin(self.env, _("marcare una tranche come incassata"))
            tranche.write({
                'stato': 'incassata',
                'data_incasso': fields.Date.context_today(tranche),
                'confirmed_by': self.env.user.id,
            })
            tranche.order_id.message_post(body=_(
                "Tranche %(n)s (%(fase)s) marcata come incassata da %(user)s."
            ) % {'n': tranche.tranche_number, 'fase': tranche.fase_config_id.phase_id.name,
                 'user': self.env.user.name})
