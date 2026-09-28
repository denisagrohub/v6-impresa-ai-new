from odoo import api, fields, models
from odoo.exceptions import ValidationError


class ResPartnerFiscalExtension(models.Model):
    """23/09/2026: log della conferma dati fiscali da parte del consulente
    (prova che e' stato lui a dichiarare i dati, non l'admin)."""
    _inherit = 'res.partner'

    fiscal_data_confirmed_at = fields.Datetime(
        string='Dati fiscali confermati il', readonly=True)
    fiscal_data_confirmed_ip = fields.Char(
        string='Dati fiscali confermati da IP', readonly=True)

    # 27/09/2026: preferenza invio email (personale / V6 alias / entrambe).
    # Il consulente può scegliere dalla dashboard, sezione Profilo.
    # Admin vede/modifica per conto di consulenti.
    x_v6_email_mode = fields.Selection([
        ('personal', 'Solo email personale (default)'),
        ('v6', 'Solo alias V6 (slug@v6impresa.it)'),
        ('both', 'Entrambe (personale + V6 in CC)'),
    ], string='Preferenza email',
       default='personal',
       help="Dove inviare notifiche di sistema (firma, split, ecc.)")



class ResPartnerPlaceholderExtension(models.Model):
    """27/09/2026: controparti placeholder (Alpha/Omega) usate nei deal
    in negoziazione per non rivelare i nomi reali fino alla chiusura."""
    _inherit = 'res.partner'

    is_placeholder = fields.Boolean(
        string='Placeholder', default=False, index=True,
        help="Controparte non ancora rivelata (es. Alpha/Omega)")
    placeholder_code = fields.Char(
        string='Codice placeholder',
        help="Codice identificativo, es. ALPHA, OMEGA")


class ResPartnerLifecycleExtension(models.Model):
    """28/09/2026: lifecycle stage per gestire contatti dormienti
    (es. Manuel Bortolami id=10) senza cancellarli, preservando storico."""
    _inherit = 'res.partner'

    lifecycle_stage = fields.Selection(
        selection=[
            ('scouting', 'Scouting'),
            ('partner', 'Partner'),
            ('attivo', 'Attivo'),
            ('degradato', 'Degradato'),
            ('chiuso', 'Chiuso'),
        ],
        string='Lifecycle',
        default='partner',
        tracking=True,
        index=True,
        help="Stato del contatto nel ciclo di vita V6. "
             "'degradato' = dormiente ma conservato per storico.",
    )
    quality_score = fields.Integer(
        string='Quality Score',
        default=50,
        tracking=True,
        help="Punteggio 0-100 della qualità del contatto.",
    )
    degraded_reason = fields.Text(
        string='Motivo degradamento',
        tracking=True,
    )
    degraded_at = fields.Datetime(
        string='Degradato il',
        tracking=True,
    )

    @api.constrains('quality_score')
    def _check_quality_score_lifecycle(self):
        for rec in self:
            if rec.quality_score < 0 or rec.quality_score > 100:
                raise ValidationError(
                    "Quality Score deve essere un valore tra 0 e 100."
                )

    @api.onchange('lifecycle_stage')
    def _onchange_lifecycle_stage(self):
        # Entrata in 'degradato' senza data → la imposto ora
        if self.lifecycle_stage == 'degradato' and not self.degraded_at:
            self.degraded_at = fields.Datetime.now()
        # Uscita da 'degradato' → pulisco la data (storico resta in chatter via tracking)
        elif self.lifecycle_stage != 'degradato' and self.degraded_at:
            self.degraded_at = False


class ResPartnerRegimeFiscale(models.Model):
    """28/09/2026: regime fiscale del consulente per la generazione
    automatica della sezione 'Come ricevere il compenso' nei PDF consuntivi."""
    _inherit = 'res.partner'

    x_v6_regime_fiscale = fields.Selection([
        ('forfettario', 'Forfettario (no IVA, no ritenuta)'),
        ('ordinario', 'Ordinario (IVA 22% + ritenuta 20%)'),
        ('occasionale', 'Occasionale (no IVA, ritenuta 20%)'),
        ('non_specificato', 'Non specificato (mostra tutte le ipotesi)'),
    ], string='Regime fiscale',
       default='non_specificato',
       help="Determina come generare la sezione 'Come ricevere il compenso' nei PDF.")
