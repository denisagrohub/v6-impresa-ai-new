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
            # 28/09/2026: base di ripartizione = FEE V6 (ricavo_lordo),
            # NON il netto. I consulenti prendono una % del fee V6 sul transato.
            for line in rec.prospetto_id.line_ids:
                p = line.participant_id
                share = (p.share_pct or 0) * 100  # frazione → percentuale
                importo = (rec.ricavo_lordo or 0) * (share / 100.0)
                # Causale fattura auto-generata
                causale = (
                    f"Consulenza commerciale deal {rec.deal_id.name} - "
                    f"{dict(MONTHS).get(rec.periodo_mese, '?')} {rec.periodo_anno}"
                )
                lines.append({
                    'settlement_id': rec.id,
                    'participant_id': p.id,
                    'share_pct': share,
                    'importo_effettivo': importo,
                    'causale_fattura': causale,
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

    def _render_narrative(self, self_mode=False, viewer_partner_id=None):
        """Applica il template del deal + il contesto dati → narrative_html.
        
        self_mode=True: usa il template 'self' ridotto (niente fee/netto/n_partecipanti)
        viewer_partner_id: per il template self, aggiunge 'mio_importo' + 'mio_nome'
        """
        import re
        for rec in self:
            if self_mode:
                template = rec.deal_id.narrative_template_self or ''
            else:
                template = rec.deal_id.narrative_template or ''
            if not template:
                rec.narrative_html = '<p><em>Template narrativa non configurato.</em></p>'
                continue

            ctx = rec._build_narrative_context()

            # In self mode, arricchisci con dati personali del viewer
            if self_mode:
                # Trova la riga del viewer
                target_pid = viewer_partner_id or rec.env.user.partner_id.id
                my_line = rec.line_ids.filtered(
                    lambda l: l.participant_id.partner_id.id == target_pid
                )[:1]
                if not my_line and rec.env.user.has_group('base.group_system'):
                    # Admin preview: prendi la prima riga
                    my_line = rec.line_ids[:1]
                if my_line:
                    ctx['mio_importo'] = rec._fmt_eur(my_line.importo_effettivo)
                    ctx['mio_nome'] = my_line.participant_id.partner_id.name or ''
                else:
                    ctx['mio_importo'] = '—'
                    ctx['mio_nome'] = ''

            def _sub(match):
                key = match.group(1).strip()
                return str(ctx.get(key, match.group(0)))

            rendered = re.sub(r'\{\{\s*(\w+)\s*\}\}', _sub, template)
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
        # 28/09/2026: generate_document ritorna erpv6.typst.document (record)
        doc = engine.generate_document(
            template_id=template.id,
            res_model='erpv6.deal.settlement',
            res_id=self.id,
            data=data,
        )
        if doc:
            self.write({
                'pdf_document_id': doc.id,
                'pdf_hash': getattr(doc, 'blockchain_hash', False),
            })
        return True

    def _build_pdf_data(self, viewer_partner_id=None):
        """Dict per il rendering Typst del consuntivo. BLINDATO per la
        variante self: se transparency_unlocked=False, NON passa transato,
        ricavo, netto, n_partecipanti, fee_pct — solo la riga del viewer.
        """
        self.ensure_one()
        # Full se: transparency_unlocked OR (admin senza viewer specifico)
        is_admin = self.env.user.has_group('base.group_system')
        is_full = self.transparency_unlocked or (is_admin and not viewer_partner_id)
        ctx = self._build_narrative_context()

        # 28/09/2026: rigenera la narrativa con il template giusto.
        # In self mode, usa il template ridotto (niente fee/netto/n_partecipanti).
        if not is_full:
            self._render_narrative(self_mode=True, viewer_partner_id=viewer_partner_id)

        import html as _html
        import re as _re
        raw = self.narrative_html or ''
        raw = _html.unescape(raw)
        raw = _re.sub(r'</p>\s*<p>', '\n\n', raw)
        raw = _re.sub(r'<br\s*/?>', '\n', raw)
        raw = _re.sub(r'<[^>]+>', '', raw)
        narrative_plain = raw.strip()

        visible_lines = self.line_ids
        if not is_full:
            target_partner_id = viewer_partner_id or self.env.user.partner_id.id
            visible_lines = self.line_ids.filtered(
                lambda l: l.participant_id.partner_id.id == target_partner_id
            )
            if not visible_lines and self.env.user.has_group('base.group_system'):
                visible_lines = self.line_ids

        if is_full:
            data = {
                **ctx,
                'narrative_plain': narrative_plain,
                'transparency_unlocked': 'sì',
                'show_full_details': True,
                'lines': [self._line_to_dict(l) for l in visible_lines],
            }
        else:
            data = {
                'deal_name': ctx['deal_name'],
                'periodo': ctx['periodo'],
                'periodo_mese': ctx['periodo_mese'],
                'periodo_anno': ctx['periodo_anno'],
                'quantita': ctx['quantita'],
                'prezzo_medio': ctx['prezzo_medio'],
                'unita': ctx['unita'],
                'schema_code': ctx['schema_code'],
                'revenue_model': ctx['revenue_model'],
                'data_generazione': ctx.get('data_generazione', ''),
                'fee_pct': '',
                'transato_totale': '',
                'ricavo_lordo': '',
                'netto_ripartizione': '',
                'n_partecipanti': '',
                'transparency_unlocked': 'no',
                'show_full_details': False,
                'narrative_plain': narrative_plain,
                'lines': [self._line_to_dict(l) for l in visible_lines],
            }

        data['compenso'] = self._build_compenso_block(visible_lines[:1], is_full)
        data['payment_info'] = self._build_payment_info()
        return data

    def _line_to_dict(self, line):
        p = line.participant_id
        partner = p.partner_id
        return {
            'partner_name': partner.name or '',
            'tier': p.tier or '',
            'share_pct': (p.share_pct or 0) * 100,
            'importo_effettivo': line.importo_effettivo or 0,
            'causale_fattura': line.causale_fattura or '',
            'regime_fiscale': getattr(partner, 'x_v6_regime_fiscale', 'non_specificato') or 'non_specificato',
            'vat': partner.vat or '',
            'cf': getattr(partner, 'l10n_it_codice_fiscale', '') or '',
        }

    def _build_compenso_block(self, lines, is_full):
        if not lines:
            return {'lordo': '€ 0', 'iva': '', 'totale': '€ 0',
                    'regime_label': '—', 'has_iva': False, 'has_ritenuta': False, 'causale': ''}
        line = lines[0]
        partner = line.participant_id.partner_id
        lordo = line.importo_effettivo or 0
        regime = getattr(partner, 'x_v6_regime_fiscale', 'non_specificato') or 'non_specificato'

        iva = 0.0
        has_iva = False
        has_ritenuta = False
        if regime == 'forfettario':
            regime_label = 'Forfettario (no IVA, no ritenuta)'
        elif regime == 'ordinario':
            iva = lordo * 0.22
            has_iva = True
            has_ritenuta = True
            regime_label = 'Ordinario (IVA 22%, ritenuta 20%)'
        elif regime == 'occasionale':
            has_ritenuta = True
            regime_label = 'Occasionale (no IVA, ritenuta 20%)'
        else:
            regime_label = 'Non specificato'

        return {
            'lordo': self._fmt_eur(lordo),
            'iva': self._fmt_eur(iva) if has_iva else '',
            'totale': self._fmt_eur(lordo + iva),
            'has_iva': has_iva,
            'has_ritenuta': has_ritenuta,
            'regime_label': regime_label,
            'causale': line.causale_fattura or '',
        }

    def _build_payment_info(self):
        company = self.env.company or self.env['res.company'].sudo().search(
            [('name', 'ilike', 'V6 Impresa')], limit=1)
        return {
            'v6_name': company.name or 'V6 Impresa S.r.l.',
            'v6_vat': company.vat or '',
            'v6_cf': getattr(company, 'l10n_it_codice_fiscale', '') or '',
            'v6_address': ', '.join(filter(None, [
                company.street or '', company.street2 or '',
                f"{company.zip or ''} {company.city or ''}".strip(),
                company.state_id.name if company.state_id else '',
            ])),
            'v6_invoice_email': 'fatture@v6impresa.it',
            'payment_days': 30,
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

    # 28/09/2026: campi per fatturazione e match automatico futuro
    causale_fattura = fields.Char(
        string='Causale fattura',
        help='Testo da inserire nella causale della fattura emessa dal consulente.')
    fattura_ricevuta_id = fields.Many2one(
        'account.move', string='Fattura ricevuta',
        help='Collegamento alla fattura fornitore per riconciliazione automatica.')
    pagato = fields.Boolean(default=False)
    pagato_il = fields.Datetime()

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
