# -*- coding: utf-8 -*-
import json
from odoo import models, fields, api
from odoo.exceptions import UserError

import logging
_logger = logging.getLogger(__name__)



class Erpv6DealSchema(models.Model):
    _name = 'erpv6.deal.schema'
    _description = 'Schema di calcolo deal (registro)'
    _order = 'code, version desc'

    code = fields.Char(required=True, index=True)
    name = fields.Char(required=True)
    deal_type = fields.Selection([
        ('tee', 'TEE'),
        ('cogenerazione', 'Cogenerazione'),
        ('fotovoltaico', 'Fotovoltaico'),
        ('custom', 'Custom'),
    ], required=True)
    version = fields.Integer(default=1)
    active = fields.Boolean(default=True)
    valid_from = fields.Date()
    valid_to = fields.Date()
    locked = fields.Boolean(default=False)
    description = fields.Text()

    _sql_constraints = [
        ('code_version_uniq', 'unique(code, version)',
         'Combinazione codice+versione già esistente'),
    ]


class Erpv6Deal(models.Model):
    _name = 'erpv6.deal'

    @api.model_create_multi
    def create(self, vals_list):
        records = super().create(vals_list)
        for rec in records:
            if rec.schema_id:
                rec._generate_checklist_from_schema()
        return records
    _description = 'Deal commerciale con schema parametrico'
    _inherit = ['mail.thread', 'mail.activity.mixin']
    _order = 'create_date desc'

    name = fields.Char(required=True, tracking=True)
    relation_id = fields.Many2one('erpv6.tracking.relation', required=True,
                                   ondelete='restrict', index=True,
                                   string='Progetto')
    parent_deal_id = fields.Many2one('erpv6.deal', string='Deal padre',
                                      ondelete='set null', index=True)
    child_deal_ids = fields.One2many('erpv6.deal', 'parent_deal_id',
                                      string='Deal figli')

    seller_id = fields.Many2one('res.partner', string='Venditore',
                                 ondelete='restrict')
    buyer_id = fields.Many2one('res.partner', string='Compratore',
                                ondelete='restrict')
    seller_is_placeholder = fields.Boolean(
        related='seller_id.is_placeholder', string='Venditore placeholder')
    buyer_is_placeholder = fields.Boolean(
        related='buyer_id.is_placeholder', string='Compratore placeholder')

    schema_id = fields.Many2one('erpv6.deal.schema', required=True,
                                 ondelete='restrict', string='Schema')
    schema_code = fields.Char(related='schema_id.code', store=True)
    schema_version = fields.Integer(related='schema_id.version', store=True)

    revenue_model = fields.Selection([
        ('spread', 'Spread (acquisto → vendita)'),
        ('fee', 'Fee % sul transato'),
        ('mixed', 'Mixed (spread + fee)'),
    ], string='Modello ricavi', default='fee', required=True,
       help='Come V6 calcola la sua remunerazione su questo deal')

    state = fields.Selection([
        ('forecasting', 'Previsione'),
        ('negotiating', 'In trattativa'),
        ('frozen', 'Congelato'),
        ('signing', 'In firma'),
        ('active', 'Attivo'),
        ('closed', 'Chiuso'),
        ('cancelled', 'Annullato'),
    ], default='forecasting', required=True, tracking=True, index=True)

    variable_ids = fields.One2many('erpv6.deal.variable', 'deal_id',
                                    string='Variabili')
    participant_ids = fields.One2many('erpv6.deal.participant', 'deal_id',
                                       string='Partecipanti')
    leg_ids = fields.One2many('erpv6.deal.leg', 'deal_id',
                               string='Leg (venditori / Camere)')
    prospetto_ids = fields.One2many('erpv6.deal.prospetto', 'deal_id',
                                     string='Prospetti')

    narrative_template = fields.Text(
        string='Template narrativa (deal-level)',
        help='Template con placeholder {{ var }} per generare automaticamente '
             'la narrativa di ogni consuntivo mensile. Compilato una volta, '
             'riutilizzato per tutti i mesi. Dati sempre dal DB.',
        default='''Nel mese di {{ periodo_mese }} {{ periodo_anno }} il deal «{{ deal_name }}» ha registrato un transato di {{ quantita }} {{ unita }} a un prezzo medio di {{ prezzo_medio }} EUR/{{ unita }}.

Applicando il modello {{ revenue_model }} con fee del {{ fee_pct }}%, il netto da ripartire ammonta a {{ netto_ripartizione }}, così distribuito tra {{ n_partecipanti }} partecipanti secondo i tier concordati.

{{ nota_mensile }}''',
    )
    narrative_template_self = fields.Text(
        string='Template narrativa (variante self)',
        help='Template ridotto per la variante self: NIENTE fee, NIENTE netto, '
             'NIENTE n_partecipanti. Solo la riga del destinatario.',
        default='''Il tuo compenso per il mese di {{ periodo }} relativo al deal «{{ deal_name }}» è indicato di seguito.

Per riceverlo, segui le istruzioni riportate in calce.''',
    )
    settlement_ids = fields.One2many(
        'erpv6.deal.settlement', 'deal_id', string='Consuntivi mensili')

    checklist_ids = fields.One2many(
        'erpv6.deal.checklist', 'deal_id', string='Checklist deal')
    next_step_id = fields.Many2one(
        'erpv6.deal.checklist', string='Prossimo step',
        compute='_compute_checklist_progress')
    progress_done = fields.Integer(
        compute='_compute_checklist_progress', string='Step completati')
    progress_total = fields.Integer(
        compute='_compute_checklist_progress', string='Step totali')
    current_prospetto_id = fields.Many2one('erpv6.deal.prospetto',
                                            string='Prospetto corrente',
                                            ondelete='set null')
    frozen_at = fields.Datetime(readonly=True, tracking=True)
    frozen_by = fields.Many2one('res.users', readonly=True)
    signed_at = fields.Datetime(readonly=True, tracking=True)
    closed_at = fields.Datetime(readonly=True)

    can_freeze = fields.Boolean(compute='_compute_gates', store=False)
    can_sign = fields.Boolean(compute='_compute_gates', store=False)
    missing_critical_count = fields.Integer(compute='_compute_gates',
                                             store=False)

    notes = fields.Text()

    @api.depends('variable_ids.locked', 'variable_ids.is_critical',
                 'state', 'current_prospetto_id',
                 'current_prospetto_id.state')
    def _compute_gates(self):
        for d in self:
            critical = d.variable_ids.filtered('is_critical')
            missing = critical.filtered(lambda v: not v.locked)
            d.missing_critical_count = len(missing)
            d.can_freeze = (
                d.state in ('forecasting', 'negotiating')
                and bool(critical)
                and not missing
            )
            d.can_sign = (
                d.state == 'frozen'
                and bool(d.current_prospetto_id)
                and d.current_prospetto_id.state == 'frozen'
            )

    def _normalize_shares(self):
        """28/09/2026: normalizza le quote dei participant a somma 100.00%.
        L'ultima linea prende il residuo (in ordine di id). Evita il drift
        da arrotondamento (es. 3×30.67 + 8 = 100.01%)."""
        self.ensure_one()
        participants = self.participant_ids.sorted('id')
        if not participants:
            return
        shares = [(p.share_pct or 0) * 100 for p in participants]
        total = sum(shares)
        if abs(total - 100.0) < 0.001:
            return  # già perfetto
        # L'ultima linea prende 100 - somma(altre)
        last = participants[-1]
        new_last = 100.0 - sum(shares[:-1])
        last.write({'share_pct': new_last / 100.0})
        _logger.info(
            'Deal %s: quote normalizzate. Ultima (%s): %.4f%% → %.4f%%',
            self.id, last.partner_id.name, shares[-1], new_last)
        return

    def _gen_transparency_token(self, participant):
        """Genera un token univoco per il consenso."""
        import hashlib, secrets
        raw = f"{self.id}:{participant.id}:{secrets.token_urlsafe(16)}"
        return hashlib.sha256(raw.encode()).hexdigest()[:48]

    def action_send_transparency_request(self, filter_partner_ids=None):
        """Manda email ai participant chiedendo consenso condivisione quota.

        filter_partner_ids: se specificato, manda SOLO a questi res.partner.id
                            (utile per test/mirati).
        Salta chi ha già impostato x_v6_share_transparency_default.
        """
        self.ensure_one()
        from odoo.addons.erpv6_referral.models.system_mail_helper import send_system_mail

        sent = 0
        skipped = 0
        for p in self.participant_ids:
            partner = p.partner_id
            if not partner or not partner.email:
                continue
            if filter_partner_ids and partner.id not in filter_partner_ids:
                skipped += 1
                continue
            if partner.x_v6_share_transparency_default != 'unset':
                skipped += 1
                continue
            if not p.share_transparency_token:
                p.share_transparency_token = self._gen_transparency_token(p)
            token = p.share_transparency_token
            base_url = 'https://www.v6impresa.it/api/public/transparency-confirm'
            yes_url = f'{base_url}?token={token}&r=yes'
            no_url = f'{base_url}?token={token}&r=no'

            subject = f'Consenso condivisione quote — {self.name}'
            body = f'''
<p>Ciao {partner.name or ''},</p>
<p>Per il deal <b>{self.name}</b> stiamo predisponendo il consuntivo mensile.</p>
<p>Possiamo mostrare la tua quota agli altri partecipanti del deal?</p>
<ul>
  <li><b>Se tutti accettano</b>: il consuntivo mostra la ripartizione completa a tutti.</li>
  <li><b>Se anche uno rifiuta</b>: ognuno vede solo la propria riga (nessuno saprà chi ha rifiutato).</li>
</ul>
<p style="margin-top:1.5em">
  <a href="{yes_url}" style="background:#059669;color:white;padding:10px 20px;border-radius:4px;text-decoration:none;font-weight:bold;">✓ Accetto di condividere</a>
  &nbsp;&nbsp;
  <a href="{no_url}" style="background:#6b7280;color:white;padding:10px 20px;border-radius:4px;text-decoration:none;font-weight:bold;">✗ Preferisco non condividere</a>
</p>
<p style="font-size:0.85em;color:#666;margin-top:1.5em">
  La tua scelta è riservata. Se rifiuti, gli altri non sapranno chi ha rifiutato.
</p>
'''
            try:
                send_system_mail(self.env, partner.email, subject, body)
                p.share_transparency_requested_at = fields.Datetime.now()
                sent += 1
            except Exception:
                _logger.exception('Invio transparency fallito per %s', partner.id)

        self.message_post(
            body=f"Richiesta consenso: {sent} inviate, {skipped} saltate.")
        _logger.info('Deal %s: %s inviate, %s saltate', self.id, sent, skipped)
        return sent

    @api.depends('checklist_ids.status', 'checklist_ids.sequence', 'checklist_ids.is_ready')
    def _compute_checklist_progress(self):
        for d in self:
            items = d.checklist_ids.sorted('sequence')
            d.progress_total = len(items)
            d.progress_done = len(items.filtered(lambda c: c.status == 'done'))
            nxt = items.filtered(lambda c: c.status in ('pending', 'in_progress') and c.is_ready)[:1]
            d.next_step_id = nxt.id if nxt else False

    def _generate_checklist_from_schema(self):
        self.ensure_one()
        if not self.schema_id:
            return 0
        Step = self.env['erpv6.deal.schema.step'].sudo()
        steps = Step.search([('schema_id', '=', self.schema_id.id),
                             ('auto_generate', '=', True)], order='sequence, id')
        existing = set(self.checklist_ids.mapped('code'))
        created = 0
        for s in steps:
            if s.code in existing:
                continue
            self.env['erpv6.deal.checklist'].sudo().create({
                'deal_id': self.id, 'sequence': s.sequence, 'code': s.code,
                'label': s.label, 'description': s.description,
                'completion_type': s.completion_type,
                'blocks_deal_state': s.blocks_deal_state,
                'requires_codes': s.requires_codes,
                'template_document_code': s.template_document_code,
            })
            created += 1
        _logger.info('Deal %s: checklist creata (%s step)', self.id, created)
        return created

    def _check_checklist_gates(self, target_state=None):
        self.ensure_one()
        blocking = self.checklist_ids.filtered(
            lambda c: c.blocks_deal_state and c.status not in ('done', 'na'))
        if blocking:
            labels = ', '.join(blocking.mapped('label'))
            raise UserError(
                f"Bloccato ({target_state or 'transizione'}): "
                f"{len(blocking)} step non completati — {labels}")

    def action_freeze(self):
        for d in self:
            d._check_checklist_gates(target_state='frozen')
            if not d.can_freeze:
                missing = d.variable_ids.filtered(
                    lambda v: v.is_critical and not v.locked)
                names = ', '.join(missing.mapped('label') or missing.mapped('name'))
                raise UserError(
                    "Impossibile congelare: variabili critiche mancanti: %s" % names)
            prospetto = d._generate_prospetto(freeze=True)
            d.write({
                'state': 'frozen',
                'frozen_at': fields.Datetime.now(),
                'frozen_by': self.env.user.id,
                'current_prospetto_id': prospetto.id,
            })
        return True

    def _build_prospetto_render_data(self):
        """Costruisce il dict per Typst dal prospetto frozen corrente."""
        self.ensure_one()
        prospetto = self.current_prospetto_id
        if not prospetto:
            raise UserError("Nessun prospetto: congela prima il deal.")

        lines = []
        totals = {
            'monthly_min': 0, 'monthly_base': 0, 'monthly_max': 0,
            'rolling_12_min': 0, 'rolling_12_base': 0, 'rolling_12_max': 0,
            'rolling_24_min': 0, 'rolling_24_base': 0, 'rolling_24_max': 0,
        }

        for l in prospetto.line_ids:
            p = l.participant_id
            lines.append({
                'partner_name': p.partner_id.name or p.name or '',
                'role': l.role or p.role or '',
                'tier': p.tier or '',
                'share_pct': (p.share_pct or 0) * 100,
                'monthly_min': l.monthly_min or 0,
                'monthly_base': l.monthly_base or 0,
                'monthly_max': l.monthly_max or 0,
            })
            for k in ('monthly_min', 'monthly_base', 'monthly_max',
                      'rolling_12_min', 'rolling_12_base', 'rolling_12_max',
                      'rolling_24_min', 'rolling_24_base', 'rolling_24_max'):
                totals[k] += getattr(l, k, 0) or 0

        return {
            'deal_id': self.id,
            'deal_name': self.name,
            'schema_code': self.schema_code or '',
            'relation_name': self.relation_id.name if self.relation_id else '',
            'revenue_model': self.revenue_model or '',
            'state': self.state or '',
            'prospetto_version': prospetto.version,
            'prospetto_lines': lines,
            'totals': totals,
        }

    def _generate_alias_if_missing(self):
        """29/09/2026 (C5.2): genera email_alias sul nodo deal se mancante.
        Alias del tipo `deal-<id>-<seller-slug>-<buyer-slug>` scritto su
        relation_id.email_alias (il nodo del deal, non la radice).

        Motivo (anti-aggiramento): il contratto con committente e venditore
        obbliga le comunicazioni a passare per un canale ufficiale tracciato.
        L'alias sul nodo deal crea quel canale: le email inviate a
        <alias>@v6sviluppoimpresa.it vengono instradate dal fetchmail al
        nodo deal (relation_id = deal.relation_id), non alla radice del
        progetto. Il matching esiste gia' (aeosv6_dispatch._run_route_project_email).

        Idempotente: se il nodo ha gia' un email_alias, non lo tocca.
        Non solleva errore se collisione slug: in tal caso suffissa con
        l'id deal, che e' gia' unico.
        """
        for d in self:
            node = d.relation_id
            if not node or node.email_alias:
                continue

            def _slug(s):
                return (s or '').lower().strip().replace(' ', '-')[:20] or 'x'

            seller = _slug(d.seller_id.placeholder_code if d.seller_id.is_placeholder
                           else (d.seller_id.name if d.seller_id else 'seller'))
            buyer = _slug(d.buyer_id.placeholder_code if d.buyer_id.is_placeholder
                          else (d.buyer_id.name if d.buyer_id else 'buyer'))
            base = f'deal-{d.id}-{seller}-{buyer}'

            # Unicita': se esiste gia' un nodo con questo alias, suffissa
            Relation = self.env['erpv6.tracking.relation'].sudo()
            if Relation.search_count([('email_alias', '=', base)]) > 0:
                base = f'deal-{d.id}'
            node.sudo().write({'email_alias': base})

    def action_send_to_sign(self, filter_partner_ids=None, force=False):
        """Crea contract_draft Typst, genera PDF, invia a firma su Documenso.

        filter_partner_ids: se specificato, manda SOLO a questi partner_id
                            (utile per test mirati / invii selettivi).
        force: se True, bypassa la guardia checklist (solo per test).
        """
        for d in self:
            d._generate_alias_if_missing()
            if not force:
                d._check_checklist_gates(target_state='signing')
        Draft = self.env['erpv6.contract.draft'].sudo()
        Sign = self.env['erpv6.sign.request'].sudo()
        Template = self.env['erpv6.typst.template'].sudo()

        for d in self:
            if not force and not d.can_sign:
                raise UserError(
                    "Impossibile inviare in firma: congela prima il deal.")
            if not d.current_prospetto_id:
                raise UserError("Nessun prospetto congelato: congela prima.")

            template = Template.search(
                [('code', '=', 'PROSPETTO-DEAL-001')], limit=1)
            if not template:
                raise UserError(
                    "Template 'PROSPETTO-DEAL-001' non trovato. "
                    "Aggiorna erpv6_typst per installarlo.")

            # 1) Contract draft (contenitore PDF)
            counterparty = d.env.company.partner_id
            draft = Draft.create({
                'name': f'{d.name} — prospetto v{d.current_prospetto_id.version}',
                'template_id': template.id,
                'project_id': d.relation_id.id if d.relation_id else False,
                'counterparty_id': counterparty.id if counterparty else False,
                'extra_data': d._build_prospetto_render_data(),
                'pdf_mode': 'official',
            })
            draft.action_generate_pdf()

            if not draft.document_id or not draft.document_id.pdf_file:
                raise UserError(
                    "Generazione PDF fallita: nessun documento prodotto.")

            # 2) Sign request per ogni partecipante con email
            sign_ids = []
            for p in d.participant_ids:
                partner = p.partner_id
                if not partner or not partner.email:
                    continue
                # Filtro opzionale (test mirato)
                if filter_partner_ids and partner.id not in filter_partner_ids:
                    continue
                sr = Sign.create({
                    'name': f'{d.name} — firma {partner.name}',
                    'partner_id': partner.id,
                    'document_id': draft.document_id.id,
                    'contract_draft_id': draft.id,
                    'related_kind': 'deal_prospetto',
                    'related_id': d.id,
                    'related_model': 'erpv6.deal',
                    'notes': f'Prospetto deal {d.name} v{d.current_prospetto_id.version}',
                })
                sign_ids.append(sr.id)

            if not sign_ids:
                raise UserError(
                    "Nessun partecipante con email: impossibile inviare in firma.")

            # 3) Invia a Documenso
            for sr in Sign.browse(sign_ids):
                sr.action_send_to_sign()

            # 4) Collega sign request al prospetto + stato deal
            d.current_prospetto_id.write({
                'sign_request_ids': [(6, 0, sign_ids)],
            })
            d.write({'state': 'signing'})
        return True

    def _generate_prospetto(self, freeze=False):
        self.ensure_one()
        from .deal_engine import compute_prospetto, build_snapshot
        snapshot = build_snapshot(self)
        results = compute_prospetto(self.schema_code, self, snapshot)

        prospetto = self.env['erpv6.deal.prospetto'].create({
            'deal_id': self.id,
            'version': len(self.prospetto_ids) + 1,
            'state': 'frozen' if freeze else 'draft',
            'computed_by': self.env.user.id,
            'snapshot_json': json.dumps(snapshot, default=str),
            'frozen_at': fields.Datetime.now() if freeze else False,
            'frozen_by': self.env.user.id if freeze else False,
        })

        lines = []
        for p in self.participant_ids:
            r = results['per_participant'].get(p.id, {})
            lines.append({
                'prospetto_id': prospetto.id,
                'participant_id': p.id,
                'role': p.role,
                'monthly_min': r.get('monthly_min', 0),
                'monthly_base': r.get('monthly_base', 0),
                'monthly_max': r.get('monthly_max', 0),
                'rolling_12_min': r.get('rolling_12_min', 0),
                'rolling_12_base': r.get('rolling_12_base', 0),
                'rolling_12_max': r.get('rolling_12_max', 0),
                'rolling_24_min': r.get('rolling_24_min', 0),
                'rolling_24_base': r.get('rolling_24_base', 0),
                'rolling_24_max': r.get('rolling_24_max', 0),
            })
        self.env['erpv6.deal.prospetto.line'].create(lines)
        return prospetto

    def action_recompute(self):
        for d in self:
            if d.state in ('frozen', 'signing', 'active', 'closed'):
                raise UserError(
                    "Non si può ricalcolare un deal congelato o firmato.")
            d.current_prospetto_id = d._generate_prospetto().id
        return True

    def action_auto_add_participants(self):
        """Aggiunge automaticamente i participant con scope='global' o
        scope='project' (stesso progetto del deal corrente) a questo deal.
        Evita duplicati per partner_id."""
        self.ensure_one()
        Participant = self.env['erpv6.deal.participant'].sudo()
        existing_partners = set(self.participant_ids.mapped('partner_id').ids)

        # Cerca template: participant attivi su un altro deal dello stesso
        # progetto (o globali) con tier impostato.
        domain = [
            ('deal_id', '!=', self.id),
            '|',
            ('scope', '=', 'global'),
            '&', ('scope', '=', 'project'),
            ('scope_relation_id', '=', self.relation_id.id),
        ]
        templates = Participant.search(domain)
        added = 0
        for t in templates:
            if t.partner_id.id in existing_partners:
                continue
            Participant.create({
                'deal_id': self.id,
                'partner_id': t.partner_id.id,
                'role': t.role,
                'tier': t.tier,
                'scope': t.scope,
                'scope_relation_id': t.scope_relation_id.id if t.scope_relation_id else False,
                'share_pct': t.share_pct,
                'consultant_user_id': t.consultant_user_id.id if t.consultant_user_id else False,
                'is_referral_payer': t.is_referral_payer,
                'notes': 'Auto-aggiunto da deal precedente',
            })
            added += 1

        return added

    def unlink(self):
        for d in self:
            d.current_prospetto_id = False
            d.prospetto_ids.unlink()
            d.participant_ids.unlink()
            d.variable_ids.unlink()
        return super().unlink()


class Erpv6DealVariable(models.Model):
    _name = 'erpv6.deal.variable'
    _description = 'Variabile di un deal'
    _order = 'deal_id, is_critical desc, name'

    deal_id = fields.Many2one('erpv6.deal', required=True, ondelete='cascade',
                              index=True)
    name = fields.Char(required=True)
    label = fields.Char()
    unit = fields.Char()

    value_min = fields.Float(digits=(16, 4))
    value_base = fields.Float(digits=(16, 4))
    value_max = fields.Float(digits=(16, 4))
    value_text = fields.Char()

    source = fields.Selection([
        ('catcher', 'Catcher progetto'),
        ('contract', 'Contratto'),
        ('manual', 'Manuale admin'),
        ('formula', 'Calcolata'),
        ('actual', 'Consuntivo'),
    ], required=True, default='manual')

    source_ref = fields.Char()
    is_critical = fields.Boolean(default=False)
    locked = fields.Boolean(default=False)
    enabled = fields.Boolean(default=True,
        help='Se False, la variabile viene ignorata nel calcolo')
    locked_at = fields.Datetime(readonly=True)
    locked_by = fields.Many2one('res.users', readonly=True)
    notes = fields.Text()

    def action_lock(self):
        for v in self:
            v.write({
                'locked': True,
                'locked_at': fields.Datetime.now(),
                'locked_by': self.env.user.id,
            })

    def action_unlock(self):
        for v in self:
            if v.deal_id.state not in ('forecasting', 'negotiating'):
                raise UserError("Deal congelato: variabile non modificabile.")
            v.write({'locked': False, 'locked_at': False, 'locked_by': False})


class Erpv6DealParticipant(models.Model):
    _name = 'erpv6.deal.participant'

    @api.model_create_multi
    def create(self, vals_list):
        """28/09/2026: applica default transparency del partner se presente."""
        for vals in vals_list:
            if 'partner_id' in vals and 'share_transparency' not in vals:
                partner = self.env['res.partner'].browse(vals['partner_id'])
                if partner.x_v6_share_transparency_default == 'yes':
                    vals['share_transparency'] = True
        return super().create(vals_list)
    _description = 'Partecipante a un deal'

    deal_id = fields.Many2one('erpv6.deal', required=True, ondelete='cascade',
                              index=True)
    partner_id = fields.Many2one('res.partner', required=True,
                                  ondelete='restrict')
    role = fields.Selection([
        ('v6_entity', 'V6 (entità)'),
        ('consultant', 'Consulente'),
        ('referral', 'Referral'),
        ('other', 'Altro'),
    ], required=True)
    tier = fields.Selection([
        ('', 'Nessuno'),
        ('founder', 'Founder'),
        ('associate', 'Associate'),
    ], default='', help='Livello gerarchico (solo etichetta + filtri)')
    scope = fields.Selection([
        ('deal', 'Solo questo deal'),
        ('project', 'Tutti i deal del progetto'),
        ('global', 'Tutti i deal'),
    ], default='deal', required=True,
       help='Su quali deal questo partecipante è automaticamente attivo')
    scope_relation_id = fields.Many2one(
        'erpv6.tracking.relation', string='Progetto (scope)',
        ondelete='set null',
        help='Se scope=project, indica di quale progetto')
    share_pct = fields.Float(digits=(6, 4))
    consultant_user_id = fields.Many2one('res.users')
    share_transparency = fields.Boolean(
        string='Mostra quota agli altri',
        default=False,
        help='Se TUTTI i partecipanti accettano, il consuntivo mostra '
             'la ripartizione completa. Altrimenti ognuno vede solo la sua riga.',
    )
    share_transparency_token = fields.Char(
        string='Token consenso', readonly=True, index=True)
    share_transparency_requested_at = fields.Datetime(
        string='Richiesta consenso il', readonly=True)
    share_transparency_responded_at = fields.Datetime(
        string='Risposta ricevuta il', readonly=True)
    is_referral_payer = fields.Boolean(
        string='Paga il referral',
        help="Se True, il costo referral e' dedotto dalla quota di questo "
             "partecipante invece che dal pool generale")
    notes = fields.Char()


class Erpv6DealLeg(models.Model):
    """Leg di un deal: un venditore (o Camera di Commercio) che fornisce
    una quota di TEE al deal. Un deal può avere N leg (aggregazione).
    Se leg_ids è vuoto, il deal usa le variabili prezzo_tee/quantita_mese
    (modalità single-leg retrocompatibile)."""
    _name = 'erpv6.deal.leg'
    _description = 'Leg di un deal (venditore / Camera di Commercio)'
    _order = 'deal_id, sequence, id'

    deal_id = fields.Many2one('erpv6.deal', required=True, ondelete='cascade',
                               index=True)
    sequence = fields.Integer(default=10)
    seller_id = fields.Many2one('res.partner', required=True,
                                 ondelete='restrict', string='Venditore')
    seller_is_placeholder = fields.Boolean(
        related='seller_id.is_placeholder', string='Venditore placeholder')

    quantita = fields.Float(string='Quantità (TEE/mese)', digits=(16, 2))
    prezzo_acquisto = fields.Float(string='Prezzo acquisto',
                                    digits=(16, 4),
                                    help='Prezzo pagato al venditore, €/TEE')
    prezzo_vendita = fields.Float(string='Prezzo vendita',
                                   digits=(16, 4),
                                   help='Prezzo al compratore, €/TEE. '
                                        'Se 0, usa il valore del deal')

    referral_id = fields.Many2one('erpv6.referral',
                                    string='Referral specifico del leg',
                                    ondelete='set null')
    notes = fields.Text()


class Erpv6DealProspetto(models.Model):
    _name = 'erpv6.deal.prospetto'
    _description = 'Prospetto di calcolo di un deal'
    _order = 'deal_id, version desc'

    deal_id = fields.Many2one('erpv6.deal', required=True, ondelete='cascade',
                              index=True)
    version = fields.Integer(default=1)
    state = fields.Selection([
        ('draft', 'Bozza'),
        ('shared', 'Condiviso'),
        ('frozen', 'Congelato'),
        ('signed', 'Firmato'),
        ('superseded', 'Superato'),
    ], default='draft', required=True, index=True)

    computed_at = fields.Datetime(default=fields.Datetime.now)
    computed_by = fields.Many2one('res.users')
    snapshot_json = fields.Text()
    pdf_document_id = fields.Many2one('erpv6.typst.document')
    pdf_hash = fields.Char()

    line_ids = fields.One2many('erpv6.deal.prospetto.line', 'prospetto_id',
                                string='Linee')
    sign_request_ids = fields.Many2many(
        'erpv6.sign.request',
        'erpv6_deal_prospetto_sign_rel',
        'prospetto_id', 'sign_request_id',
        string='Richieste di firma')

    frozen_at = fields.Datetime()
    frozen_by = fields.Many2one('res.users')
    signed_at = fields.Datetime()


class Erpv6DealProspettoLine(models.Model):
    _name = 'erpv6.deal.prospetto.line'
    _description = 'Linea prospetto'

    prospetto_id = fields.Many2one('erpv6.deal.prospetto', required=True,
                                    ondelete='cascade', index=True)
    participant_id = fields.Many2one('erpv6.deal.participant', required=True,
                                      ondelete='restrict')
    role = fields.Char()

    monthly_min = fields.Float(digits=(16, 2))
    monthly_base = fields.Float(digits=(16, 2))
    monthly_max = fields.Float(digits=(16, 2))

    rolling_12_min = fields.Float(digits=(16, 2))
    rolling_12_base = fields.Float(digits=(16, 2))
    rolling_12_max = fields.Float(digits=(16, 2))

    rolling_24_min = fields.Float(digits=(16, 2))
    rolling_24_base = fields.Float(digits=(16, 2))
    rolling_24_max = fields.Float(digits=(16, 2))
