from odoo import fields, models


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
