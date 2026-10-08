# pylint: disable=import-error
"""Modello erpv6.credit.line — riga di un portfolio.

04/10/2026 (C-crediti-1): una riga per (codice + anno) dentro un
portfolio. Per crediti fiscali: codice = codice tributo AdE
(es. 6925 bonus facciate). Per futuri TEE/GO: codice generico.

Eredita certificate_type dal portfolio per filtri in view/tree.
"""
from odoo import fields, models


class Erpv6CreditLine(models.Model):
    _name = 'erpv6.credit.line'
    _description = 'Riga portfolio crediti'
    _order = 'portfolio_id, codice, anno desc'

    portfolio_id = fields.Many2one(
        'erpv6.credit.portfolio', string='Portfolio',
        required=True, ondelete='cascade', index=True)

    # 07/10/2026 (C-security-audit FASE 2): ownership record-level.
    # Related storable da portfolio_id.owner_user_id: la riga eredita
    # l'ownership del portfolio, senza backfill separato.
    owner_user_id = fields.Many2one(
        'res.users', string='Responsabile',
        related='portfolio_id.owner_user_id',
        store=True, index=True, readonly=True,
        help='Ereditato dal portfolio. Usato per record-level '
             'authorization (C-security-audit).')

    # 04/10/2026 (C-crediti-1): campo generico (era codice_tributo).
    # Per credit_tax e' il codice tributo AdE (6925, 7702, ...).
    codice = fields.Char(string='Codice', required=True, index=True)
    descrizione = fields.Char(string='Descrizione')
    tipologia = fields.Selection([
        ('bonus_facciate', 'Bonus facciate'),
        ('ecobonus', 'Ecobonus / efficientamento'),
        ('sismabonus', 'Sismabonus'),
        ('superbonus', 'Superbonus'),
        ('intermediari', 'Crediti a intermediari'),
        ('tee_fer', 'TEE FER (Fonti Energetiche Rinnovabili)'),
        ('tee_cogenerazione', 'TEE Cogenerazione'),
        ('tee_efficienza', 'TEE Efficienza Energetica'),
        ('altro', 'Altro'),
    ], string='Tipologia')
    anno = fields.Integer(string='Anno', required=True)
    importo = fields.Float(string='Importo', required=True)
    categoria_cedibilita = fields.Selection([
        ('chiunque_3volte', 'Chiunque poi 3 volte'),
        ('3volte_qualificati', '3 volte a qualificati'),
        ('2volte_qualificati', '2 volte a qualificati'),
        ('1volta_qualificati', '1 volta a qualificati'),
        ('piu_volte_chiunque', 'Piu volte a chiunque'),
        ('1volta_chiunque', '1 volta a chiunque'),
        ('1volta_intermediari', '1 volta a intermediari'),
    ], string='Cedibilita', help='Specifico per crediti fiscali')

    # 04/10/2026: eredita il tipo certificato dal portfolio per
    # filtri/raggruppamenti. Store per search veloce.
    certificate_type = fields.Selection(
        related='portfolio_id.certificate_type',
        string='Tipo certificato', store=True)

    selezionato = fields.Boolean(string='Selezionato', default=True)

    # 04/10/2026 (C-crediti-1): campi opzionali per TEE.
    # Per i crediti fiscali (credit_tax) restano vuoti.
    quantita = fields.Float(
        string='Quantita (TEE/TEP)', digits=(16, 4),
        help='Numero di TEE (in TEP) — usato per certificati tipo TEE.')
    prezzo_unitario = fields.Float(
        string='Prezzo unitario (EUR/TEE)', digits=(16, 4),
        help='Prezzo unitario per TEE — usato per certificati tipo TEE.')
    codice_progetto = fields.Char(
        string='Codice progetto (TEE)',
        help='Identificatore progetto TEE (es. TEE-2024-00123).')

    # 04/10/2026 (C-crediti-1): cedente ereditato dal portfolio per
    # view/tree (utile nei filtri aggregati).
    cedente_via_portfolio = fields.Many2one(
        related='portfolio_id.cedente_id', string='Cedente', store=True)
