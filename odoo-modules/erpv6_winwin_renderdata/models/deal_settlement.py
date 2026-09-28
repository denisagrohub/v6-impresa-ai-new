# -*- coding: utf-8 -*-
"""28/09/2026: Consuntivo mensile deal V6.

Ogni mese (creato manualmente o da cron) genera un settlement:
- Snapshot del prospetto frozen corrente (quote, tier, partecipanti)
- Dati REALI del mese (quantità transata, prezzo medio)
- Ricalcolo fee/ripartizione sui dati reali
- Narrative auto-generata da template + binding dati (editabile)
- PDF Typst (variante self o full a seconda di transparency_unlocked)

Transparency: se TUTTI i participant hanno share_transparency=True,
il settlement mostra la ripartizione completa a tutti. Altrimenti
ognuno vede solo la propria riga (silenziosamente, senza rivelare chi ha rifiutato).
"""
from odoo import api, fields, models
from odoo.exceptions import UserError


MONTHS = [
    ('1', 'Gennaio'), ('2', 'Febbraio'), ('3', 'Marzo'),
    ('4', 'Aprile'), ('5', 'Maggio'), ('6', 'Giugno'),
    ('7', 'Luglio'), ('8', 'Agosto'), ('9', 'Settembre'),
    ('10', 'Ottobre'), ('11', 'Novembre'), ('12', 'Dicembre'),
]


class Erpv6DealSettlement(models.Model):
    _name = 'erpv6.deal.settlement'
    _description = 'Consuntivo mensile deal V6'
    _inherit = ['mail.thread', 'mail.activity.mixin']
    _order = 'periodo_anno desc, periodo_mese desc, id desc'

    name = fields.Char(compute='_compute_name', store=True)
    deal_id = fields.Many2one(
        'erpv6.deal', required=True, ondelete='cascade', index=True)
    prospetto_id = fields.Many2one(
        'erpv6.deal.prospetto',
        help='Prospetto di riferimento (deve essere frozen). Snapshot delle quote.')

    periodo_mese = fields.Selection(MONTHS, required=True)
    periodo_anno = fields.Integer(required=True, default=lambda self: fields.Date.today().year)

    state = fields.Selection([
        ('draft', 'Bozza'),
        ('frozen', 'Congelato'),
        ('sent', 'Inviato'),
        ('signed', 'Firmato'),
        ('closed', 'Chiuso'),
    ], default='draft', required=True, tracking=True, index=True)

    # ── Dati reali del mese (input) ──
    quantita_reale = fields.Float(
        string='Quantità transata', digits=(16, 4),
        help='Quantità realmente transata nel mese (es. TEE)')
    prezzo_medio_reale = fields.Float(
        string='Prezzo medio', digits=(16, 4),
        help='Prezzo medio realizzato nel mese (EUR/unità)')
    fee_pct_reale = fields.Float(
        string='Fee applicata %', digits=(5, 2),
        help='Fee applicata nel mese (può variare dal prospetto)')
    unita = fields.Char(default='TEE')

    # ── Calcoli (compute) ──
    transato_totale = fields.Float(
        compute='_compute_totali', store=True, digits=(16, 2),
        string='Transato totale EUR')
    ricavo_lordo = fields.Float(
        compute='_compute_totali', store=True, digits=(16, 2),
        string='Ricavo lordo EUR')
    netto_ripartizione = fields.Float(
        compute='_compute_totali', store=True, digits=(16, 2),
        string='Netto da ripartire EUR')

    # ── Narrative (auto-generata, editabile) ──
    narrative_template_used = fields.Text(
        string='Template narrativa usato',
        help='Snapshot del template al momento della generazione (audit).')
    narrative_html = fields.Html(
        string='Narrativa (auto-generata)',
        help='Testo generato automaticamente da template + dati reali. Editabile.')
    note_mensili = fields.Text(
        string='Note mensili (manuale)',
        help='Nota opzionale che appare in fondo al PDF di questo mese.')

    # ── Transparency ──
    transparency_unlocked = fields.Boolean(
        compute='_compute_transparency', store=True,
        string='Trasparenza sbloccata',
        help='True se TUTTI i partecipanti hanno accettato di mostrare il proprio importo.')

    # ── Linee (una per partecipante) ──
    line_ids = fields.One2many(
        'erpv6.deal.settlement.line', 'settlement_id', string='Linee')

    # ── PDF/firma ──
    pdf_document_id = fields.Many2one('erpv6.typst.document')
    pdf_hash = fields.Char()

    # ── Timestamps ──
    computed_at = fields.Datetime(default=fields.Datetime.now)
    frozen_at = fields.Datetime()
    frozen_by = fields.Many2one('res.users')
    sent_at = fields.Datetime()
    signed_at = fields.Datetime()

    @api.depends('periodo_mese', 'periodo_anno', 'deal_id')
    def _compute_name(self):
        months = dict(MONTHS)
        for rec in self:
            m = months.get(rec.periodo_mese, '?')
            rec.name = f'{rec.deal_id.name or "Deal"} — Consuntivo {m} {rec.periodo_anno}'

    @api.depends('quantita_reale', 'prezzo_medio_reale', 'fee_pct_reale')
    def _compute_totali(self):
        for rec in self:
            transato = (rec.quantita_reale or 0) * (rec.prezzo_medio_reale or 0)
            fee = rec.fee_pct_reale or 0
            ricavo = transato * (fee / 100.0)
            netto = transato - ricavo
            rec.transato_totale = transato
            rec.ricavo_lordo = ricavo
            rec.netto_ripartizione = netto

    @api.depends('line_ids.participant_id.share_transparency')
    def _compute_transparency(self):
        for rec in self:
            participants = rec.line_ids.mapped('participant_id')
            if not participants:
                rec.transparency_unlocked = False
                continue
            rec.transparency_unlocked = all(
                p.share_transparency for p in participants)

    def action_freeze(self):
        """Congela il settlement: snapshot definitivo, non più modificabile.
        Ricostruisce le linee dai participant + genera la narrativa."""
        for rec in self:
            if rec.state != 'draft':
                raise UserError('Solo i consuntivi in bozza possono essere congelati.')
            rec._rebuild_lines()
            rec._render_narrative()
            rec.write({
                'state': 'frozen',
                'frozen_at': fields.Datetime.now(),
                'frozen_by': self.env.user.id,
            })
        return True

    def _rebuild_lines(self):
        """Ricostruisce le linee dai participant del prospetto, applicando
        i dati reali del mese (quantità e prezzo) per il ricalcolo."""
        for rec in self:
            rec.line_ids.unlink()
            if not rec.prospetto_id:
                continue
            lines = []
            for line in rec.prospetto_id.line_ids:
                p = line.participant_id
                share = (p.share_pct or 0) * 100  # frazione → percentuale
                importo = (rec.netto_ripartizione or 0) * (share / 100.0)
                lines.append({
                    'settlement_id': rec.id,
                    'participant_id': p.id,
                    'share_pct': share,
                    'importo_effettivo': importo,
                })
            self.env['erpv6.deal.settlement.line'].create(lines)



    # ══════════════════════════════════════════════════════════════
    # NARRATIVE RENDER — template + dati reali (DB)
    # ══════════════════════════════════════════════════════════════

    def _build_narrative_context(self):
        """Costruisce il dict delle variabili per il template narrativa.
        Tutte le variabili vengono da DB (settlement + prospetto + deal).
        Zero hardcoded."""
        self.ensure_one()
        d = self.deal_id
        months = dict(MONTHS)
        periodo_mese = months.get(self.periodo_mese, '?')

        ctx = {
            # Deal
            'deal_id': d.id,
            'deal_name': d.name or '',
            'revenue_model': d.revenue_model or '',
            'schema_code': d.schema_code or '',
            'prospetto_version': self.prospetto_id.version if self.prospetto_id else 0,
            # Periodo
            'periodo_mese': periodo_mese,
            'periodo_anno': str(self.periodo_anno),
            'periodo': f'{periodo_mese} {self.periodo_anno}',
            # Dati reali del mese
            'quantita': self._fmt_number(self.quantita_reale),
            'prezzo_medio': self._fmt_number(self.prezzo_medio_reale),
            'unita': self.unita or 'unità',
            'fee_pct': self._fmt_number(self.fee_pct_reale),
            'transato_totale': self._fmt_eur(self.transato_totale),
            'ricavo_lordo': self._fmt_eur(self.ricavo_lordo),
            'netto_ripartizione': self._fmt_eur(self.netto_ripartizione),
            # Partecipanti
            'n_partecipanti': str(len(self.line_ids)),
            # Tabella HTML (per UI) — vuota se non congelato
            'tabella_partecipanti': self._render_participants_table_html(),
            # Nota manuale
            'nota_mensile': (self.note_mensili or '').strip(),
            # Transparency
            'transparency_unlocked': 'sì' if self.transparency_unlocked else 'no',
        }
        return ctx

    @staticmethod
    def _fmt_number(v):
        if not v:
            return '0'
        # 0 decimali se intero, 2 se decimale
        if float(v).is_integer():
            s = f'{int(v):,}'
        else:
            s = f'{v:,.2f}'
        return s.replace(',', 'X').replace('.', ',').replace('X', '.')

    @staticmethod
    def _fmt_eur(v):
        if not v:
            return '€ 0'
        if float(v).is_integer():
            s = f'{int(v):,}'
        else:
            s = f'{v:,.2f}'
        s = s.replace(',', 'X').replace('.', ',').replace('X', '.')
        return f'€ {s}'

    def _render_participants_table_html(self):
        """Tabella HTML dei partecipanti. Se transparency_unlocked=False,
        mostra solo la riga del 'viewer' corrente (o tutte se admin)."""
        self.ensure_one()
        is_admin = self.env.user.has_group('base.group_system')
        rows = []
        for line in self.line_ids:
            p = line.participant_id
            rows.append({
                'name': p.partner_id.name or p.name or '',
                'tier': p.tier or '',
                'share_pct': self._fmt_number((p.share_pct or 0) * 100),
                'importo': self._fmt_eur(line.importo_effettivo),
            })
        if not rows:
            return '<em>Nessun partecipante</em>'

        # Transparency: se non unlocked e non admin, mostra solo un placeholder
        if not self.transparency_unlocked and not is_admin:
            return ('<em>Dettaglio importi visibile solo dopo consenso di '
                    'tutti i partecipanti.</em>')

        html = ['<table class="v6-narrative-table">']
        html.append('<thead><tr>'
                    '<th>Partecipante</th><th>Tier</th>'
                    '<th style="text-align:right">Quota %</th>'
                    '<th style="text-align:right">Importo</th>'
                    '</tr></thead><tbody>')
        for r in rows:
            html.append(
                f'<tr><td>{r["name"]}</td><td>{r["tier"]}</td>'
                f'<td style="text-align:right">{r["share_pct"]}%</td>'
                f'<td style="text-align:right">{r["importo"]}</td></tr>'
            )
        html.append('</tbody></table>')
        return ''.join(html)

    def _render_narrative(self):
        """Applica il template del deal + il contesto dati → narrative_html.
        Il template usa placeholder {{ var }}. Ignora placeholder sconosciuti.
        Il rendering è idempotente: se chiamato due volte, stesso output."""
        import re
        for rec in self:
            template = rec.deal_id.narrative_template or ''
            if not template:
                rec.narrative_html = '<p><em>Template narrativa non configurato.</em></p>'
                continue
            ctx = rec._build_narrative_context()

            def _sub(match):
                key = match.group(1).strip()
                return str(ctx.get(key, match.group(0)))  # lascia placeholder se non trovato

            rendered = re.sub(r'\{\{\s*(\w+)\s*\}\}', _sub, template)
            # Converti newline in paragrafi HTML
            paragraphs = [p.strip() for p in rendered.split('\n') if p.strip()]
            html = ''.join(f'<p>{p}</p>' for p in paragraphs)
            rec.narrative_html = html
            rec.narrative_template_used = template

    def action_generate_narrative(self):
        """Rigenera la narrativa (manuale o da action_freeze)."""
        for rec in self:
            rec._render_narrative()
        return True

    # ══════════════════════════════════════════════════════════════
    # PDF
    # ══════════════════════════════════════════════════════════════

    def action_generate_pdf(self):
        """Genera il PDF Typst del consuntivo con il template SETTLEMENT-DEAL-001.
        Variante self/full gestita dal template stesso tramite transparency_unlocked."""
        self.ensure_one()
        Template = self.env['erpv6.typst.template'].sudo()
        template = Template.search([('code', '=', 'SETTLEMENT-DEAL-001')], limit=1)
        if not template:
            raise UserError(
                "Template 'SETTLEMENT-DEAL-001' non trovato. "
                "Aggiorna erpv6_typst per installarlo.")

        engine = self.env['erpv6.typst.engine'].sudo()
        data = self._build_pdf_data()
        result = engine.generate_document(
            template_id=template.id,
            res_model='erpv6.deal.settlement',
            res_id=self.id,
            data=data,
        )
        if result and result.get('document_id'):
            self.write({
                'pdf_document_id': result['document_id'],
                'pdf_hash': result.get('hash'),
            })
        return True

    def _build_pdf_data(self):
        """Dict per il rendering Typst del consuntivo. Contiene dati reali
        (settlement) + branding + tabella partecipanti (self o full)."""
        self.ensure_one()
        ctx = self._build_narrative_context()
        # Per il PDF il testo narrativo è plain (senza HTML tags)
        narrative_plain = (self.narrative_html or '') \
            .replace('<p>', '').replace('</p>', '\n\n') \
            .replace('<em>', '').replace('</em>', '') \
            .replace('<br/>', '\n').replace('<br>', '\n')
        return {
            **ctx,
            'narrative_plain': narrative_plain.strip(),
            'lines': [{
                'partner_name': l.participant_id.partner_id.name or '',
                'tier': l.participant_id.tier or '',
                'share_pct': l.participant_id.share_pct or 0,
                'importo_effettivo': l.importo_effettivo or 0,
            } for l in self.line_ids],
        }



class Erpv6DealSettlementLine(models.Model):
    _name = 'erpv6.deal.settlement.line'
    _description = 'Linea consuntivo mensile'

    settlement_id = fields.Many2one(
        'erpv6.deal.settlement', required=True, ondelete='cascade', index=True)
    participant_id = fields.Many2one(
        'erpv6.deal.participant', required=True, ondelete='restrict')
    share_pct = fields.Float(string='Quota %', digits=(5, 2))
    importo_effettivo = fields.Float(
        string='Importo effettivo EUR', digits=(16, 2))

    # Visibilità: 'self' (solo la propria riga), 'full' (tutti, se unlocked)
    visibility = fields.Selection([
        ('self', 'Solo propria riga'),
        ('full', 'Completa (trasparenza attiva)'),
    ], compute='_compute_visibility', store=True)

    pdf_document_id = fields.Many2one('erpv6.typst.document')
    sent_at = fields.Datetime()
    viewed_at = fields.Datetime()
    paid_at = fields.Datetime()
    paid_amount = fields.Float(digits=(16, 2))
    paid_notes = fields.Text()

    @api.depends('settlement_id.transparency_unlocked')
    def _compute_visibility(self):
        for rec in self:
            rec.visibility = 'full' if rec.settlement_id.transparency_unlocked else 'self'
