# pylint: disable=import-error
"""Modello erpv6.credit.portfolio — cassetto fiscale AdE.

04/10/2026 (C-crediti-1): un portfolio = un cassetto fiscale di un
cedente. Contiene N righe (credit.line), una per codice tributo +
anno. Il PDF AdE e' la fonte (source_email_id o file_pdf manuale).

Workflow:
- draft: creato, PDF non ancora parsato
- parsed: PDF parsato, righe estratte in review
- reviewed: righe confermate dall'operatore
- archived: chiuso
"""
import logging

from odoo import api, fields, models

_logger = logging.getLogger(__name__)


class Erpv6CreditPortfolio(models.Model):
    _name = 'erpv6.credit.portfolio'
    _description = 'Cassetto fiscale AdE'
    _order = 'create_date desc'
    _rec_name = 'name'

    name = fields.Char(string='Nome', required=True, index=True)
    # 04/10/2026 (C-crediti-1): tipo di certificato. Oggi solo
    # credit_tax (Superbonus ecc.). Quando arrivera' TEE/GO si
    # aggiunge la voce alla selection e un parser dispatch.
    certificate_type = fields.Selection([
        ('credit_tax', 'Credito fiscale (Superbonus, ...)'),
        ('tee', 'TEE — Titoli Efficienza Energetica'),
        # futuri: 'go'
    ], string='Tipo certificato', default='credit_tax',
       required=True, index=True)
    cedente_id = fields.Many2one(
        'res.partner', string='Cedente',
        required=True, index=True, ondelete='restrict')
    mandatario_id = fields.Many2one(
        'res.partner', string='Mandatario V6',
        default=lambda self: self.env.user.partner_id)
    relation_id = fields.Many2one(
        'erpv6.tracking.relation', string='Progetto Partner',
        default=89, index=True,
        help='Default: 89 Acquisizione controparti — Certificati')
    deal_id = fields.Many2one(
        'erpv6.deal', string='Deal', ondelete='set null')

    # Fonte
    source_email_id = fields.Many2one(
        'mail.message', string='Email di origine',
        ondelete='set null',
        help='Email da cui il PDF e stato estratto.')
    file_pdf = fields.Binary(string='File PDF', attachment=True)
    file_pdf_name = fields.Char(string='Nome file PDF')
    data_estratto = fields.Date(string='Data estratto')
    utenza_lavoro = fields.Char(string='Utenza di lavoro')
    cf_commercialista = fields.Char(string='CF Commercialista')

    state = fields.Selection([
        ('draft', 'Bozza'),
        ('parsed', 'Estratto — in review'),
        ('reviewed', 'Verificato'),
        ('archived', 'Archiviato'),
    ], string='Stato', default='draft', required=True, index=True)

    line_ids = fields.One2many(
        'erpv6.credit.line', 'portfolio_id', string='Righe')
    total_amount = fields.Float(
        string='Totale', compute='_compute_total', store=True)
    total_lines = fields.Integer(
        string='N. righe', compute='_compute_total', store=True)
    notes = fields.Text(string='Note')

    @api.depends('line_ids.importo')
    def _compute_total(self):
        for p in self:
            p.total_amount = sum(p.line_ids.mapped('importo'))
            p.total_lines = len(p.line_ids)

    def action_analyze_pdf(self):
        """Analizza il PDF allegato e popola line_ids + header.
        Lo implementiamo in Step 5 quando il parser e' pronto."""
        self.ensure_one()
        if not self.file_pdf:
            return False
        parser = self.env['erpv6.credit.parser']
        data = parser.parse_pdf(self.file_pdf)
        # Popola header
        if data.get('cedente_nome') and not self.cedente_id:
            # cerca o crea partner
            pass
        if data.get('cf_commercialista'):
            self.cf_commercialista = data['cf_commercialista']
        if data.get('utenza'):
            self.utenza_lavoro = data['utenza']
        if data.get('data_estratto'):
            self.data_estratto = data['data_estratto']
        # Popola righe
        self.line_ids.unlink()
        for l in data.get('linee', []):
            self.env['erpv6.credit.line'].create({
                'portfolio_id': self.id,
                'codice': l.get('codice'),
                'descrizione': l.get('descrizione'),
                'tipologia': l.get('tipologia'),
                'anno': l.get('anno'),
                'importo': l.get('importo'),
            })
        self.state = 'parsed'
        return True

    def action_confirm(self):
        self.ensure_one()
        if self.state == 'parsed':
            self.state = 'reviewed'
        return True

    def action_archive(self):
        self.ensure_one()
        self.state = 'archived'
        return True
