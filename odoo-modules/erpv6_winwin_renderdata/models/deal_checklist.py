# -*- coding: utf-8 -*-
"""28/09/2026: Checklist deal V6 — wizard per fase."""
import logging

from odoo import api, fields, models
from odoo.exceptions import UserError

_logger = logging.getLogger(__name__)

COMPLETION_TYPES = [
    ('sign', 'Firma elettronica (Documenso)'),
    ('upload', 'Carica documento firmato'),
    ('check', 'Conferma manuale'),
    ('system', 'Evento di sistema'),
    ('external', 'Attesa esterna'),
]

STEP_STATUS = [
    ('pending', 'Da fare'),
    ('in_progress', 'In corso'),
    ('done', 'Completato'),
    ('skipped', 'Saltato'),
    ('na', 'Non applicabile'),
]


class Erpv6DealSchemaStep(models.Model):
    _name = 'erpv6.deal.schema.step'
    _description = 'Template step checklist deal'
    _order = 'schema_id, sequence, id'

    schema_id = fields.Many2one('erpv6.deal.schema', required=True, ondelete='cascade', index=True)
    sequence = fields.Integer(default=10)
    code = fields.Char(required=True, index=True)
    label = fields.Char(required=True)
    description = fields.Text()
    completion_type = fields.Selection(COMPLETION_TYPES, default='check', required=True)
    blocks_deal_state = fields.Boolean(default=False)
    requires_codes = fields.Char()
    template_document_code = fields.Char()
    auto_generate = fields.Boolean(default=True)

    # 30/09/2026 (F2 B2): CHI firma + CON QUALE provider
    signer_roles = fields.Char(
        string='Ruoli firmatari',
        help='CSV di ruoli: v6_admin, buyer, seller, consultant, associate, '
             'all_participants, counterparty, hera_comm, esco_partner. '
             'Vuoto = nessuna firma prevista.')
    signature_provider = fields.Selection([
        ('auto', 'Auto (policy)'),
        ('documenso', 'Documenso'),
        ('certyneo', 'Certyneo'),
    ], string='Provider firma', default='auto')
    signature_level = fields.Selection([
        ('SES', 'SES — Semplice'),
        ('AES', 'AES — Avanzata'),
        ('QES', 'QES — Qualificata eIDAS'),
    ], string='Livello firma', default='AES')

    _sql_constraints = [
        ('unique_code_per_schema', 'UNIQUE(schema_id, code)',
         'Esiste già uno step con questo codice nello schema.'),
    ]


class Erpv6DealChecklist(models.Model):
    _name = 'erpv6.deal.checklist'
    _description = 'Step checklist deal (istanza)'
    _order = 'deal_id, sequence, id'
    _inherit = ['mail.thread']

    deal_id = fields.Many2one('erpv6.deal', required=True, ondelete='cascade', index=True)
    sequence = fields.Integer(default=10)
    code = fields.Char(required=True, index=True)
    label = fields.Char(required=True)
    description = fields.Text()
    completion_type = fields.Selection(COMPLETION_TYPES, default='check', required=True)
    blocks_deal_state = fields.Boolean(default=False)
    requires_codes = fields.Char()
    template_document_code = fields.Char()
    status = fields.Selection(STEP_STATUS, default='pending', required=True, tracking=True, index=True)

    # 30/09/2026 (F2 B2): copiati dallo schema.step al momento della generazione
    signer_roles = fields.Char(string='Ruoli firmatari')
    signature_provider = fields.Selection([
        ('auto', 'Auto (policy)'),
        ('documenso', 'Documenso'),
        ('certyneo', 'Certyneo'),
    ], string='Provider firma', default='auto')
    signature_level = fields.Selection([
        ('SES', 'SES — Semplice'),
        ('AES', 'AES — Avanzata'),
        ('QES', 'QES — Qualificata eIDAS'),
    ], string='Livello firma', default='AES')

    sign_request_id = fields.Many2one('erpv6.sign.request', string='Richiesta firma', ondelete='set null')
    attachment_id = fields.Many2one('ir.attachment', string='Documento firmato', ondelete='set null')
    external_reference = fields.Char(string='Rif. esterno')

    started_at = fields.Datetime(readonly=True)
    completed_at = fields.Datetime(readonly=True, tracking=True)
    completed_by = fields.Many2one('res.users', readonly=True, tracking=True)
    evidence_note = fields.Text()

    is_ready = fields.Boolean(compute='_compute_is_ready')
    is_blocking = fields.Boolean(compute='_compute_is_ready')

    @api.depends('requires_codes', 'deal_id.checklist_ids.code',
                 'deal_id.checklist_ids.status', 'blocks_deal_state', 'status')
    def _compute_is_ready(self):
        for rec in self:
            if rec.requires_codes:
                required = [c.strip() for c in rec.requires_codes.split(',') if c.strip()]
                done_codes = set(rec.deal_id.checklist_ids.filtered(lambda c: c.status == 'done').mapped('code'))
                rec.is_ready = all(c in done_codes for c in required)
            else:
                rec.is_ready = True
            rec.is_blocking = rec.blocks_deal_state and rec.status != 'done'

    def action_start(self):
        for rec in self:
            if rec.status == 'pending':
                rec.write({'status': 'in_progress', 'started_at': fields.Datetime.now()})
        return True

    def action_complete(self, note=None, attachment=None):
        for rec in self:
            if rec.status == 'done':
                continue
            vals = {'status': 'done', 'completed_at': fields.Datetime.now(), 'completed_by': self.env.user.id}
            if note:
                vals['evidence_note'] = note
            if attachment:
                vals['attachment_id'] = attachment
            rec.write(vals)
            rec.deal_id.message_post(body=f"✓ Step: {rec.label}" + (f" — {note}" if note else ""))
        return True

    def action_preview_document(self):
        """Genera il PDF dello step in modalità 'preview' (filigrana ANTEPRIMA)
        SENZA inviarlo in firma. Ritorna {draft_id, pdf_base64, filename}.

        Serve al bottone 'Anteprima' dell'UI: l'admin vede il documento
        compilato prima di decidere se inviarlo. Il draft viene marchiato
        come '__ANTEPRIMA__' nel nome per essere riconoscibile dal cleanup
        (cron notturno cancella draft __ANTEPRIMA__ più vecchi di 2 ore).

        29/09/2026 (C6a): primo rilascio."""
        self.ensure_one()
        if not self.template_document_code:
            raise UserError("Nessun template documento configurato per questo step.")

        Template = self.env['erpv6.typst.template'].sudo()
        tpl = Template.search(
            [('code', '=', self.template_document_code)], limit=1)
        if not tpl:
            raise UserError(
                f"Template '{self.template_document_code}' non trovato.")

        deal = self.deal_id
        # Prende il primo firmatario con email (stessa logica dell'invio)
        partner = self.env['res.partner']
        for p in deal.participant_ids:
            if p.partner_id and p.partner_id.email:
                partner = p.partner_id
                break

        seller = deal.seller_id
        buyer = deal.buyer_id
        extra = {
            'deal_name': deal.name or '',
            'deal_id': deal.id,
            'deal_schema_code': deal.schema_code or '',
            'seller_name': (seller.placeholder_code if seller and seller.is_placeholder
                            else (seller.name if seller else '')),
            'buyer_name': (buyer.placeholder_code if buyer and buyer.is_placeholder
                           else (buyer.name if buyer else '')),
            'prospetto_version': (deal.current_prospetto_id.version
                                  if deal.current_prospetto_id else 1),
            'step_code': self.code,
            'step_label': self.label,
        }

        Draft = self.env['erpv6.contract.draft'].sudo()
        draft = Draft.create({
            'name': f'__ANTEPRIMA__ {deal.name} — {self.label}',
            'template_id': tpl.id,
            'project_id': deal.relation_id.id if deal.relation_id else False,
            'counterparty_id': partner.id if partner else False,
            'extra_data': extra,
            'pdf_mode': 'preview',
        })
        draft.action_generate_pdf()

        if not draft.document_id or not draft.document_id.pdf_file:
            raise UserError("Generazione anteprima PDF fallita.")

        pdf_b64 = draft.document_id.pdf_file
        if isinstance(pdf_b64, bytes):
            pdf_b64 = pdf_b64.decode('ascii')

        return {
            'draft_id': draft.id,
            'document_id': draft.document_id.id,
            'pdf_base64': pdf_b64,
            'filename': draft.document_id.pdf_filename or 'anteprima.pdf',
        }

    @api.model
    def cron_cleanup_anteprima_drafts(self):
        """29/09/2026 (C6a): cancella draft __ANTEPRIMA__ piu' vecchi di 2h.
        Il cleanup principale avviene alla chiusura della modale (DELETE),
        questo cron e' la rete di sicurezza per il caso 'browser chiuso
        senza click su Chiudi' o errori a meta' flusso.

        Frequenza consigliata: ogni ora."""
        from datetime import timedelta
        threshold = fields.Datetime.now() - timedelta(hours=2)
        Draft = self.env['erpv6.contract.draft'].sudo()
        orphans = Draft.search([
            ('name', 'like', '__ANTEPRIMA__%'),
            ('create_date', '<', threshold),
        ])
        count = 0
        for d in orphans:
            doc = d.document_id
            try:
                d.unlink()
                if doc:
                    try: doc.unlink()
                    except Exception: pass
                count += 1
            except Exception:
                _logger.exception('Cleanup draft anteprima id=%s fallito', d.id)
        _logger.info('C6a cron: cancellati %s draft anteprima orfani', count)
        return count

    def action_send_sign_document(self, partner_id=None):
        """Genera il PDF del documento dello step e invia firma al partner.
        Riusa erpv6.contract.draft (pattern esistente)."""
        self.ensure_one()
        if not self.template_document_code:
            raise UserError(
                "Nessun template documento configurato per questo step.")
        if self.completion_type != 'sign':
            raise UserError(
                f"Step '{self.label}' non prevede firma (tipo: {self.completion_type}).")

        Template = self.env['erpv6.typst.template'].sudo()
        tpl = Template.search(
            [('code', '=', self.template_document_code)], limit=1)
        if not tpl:
            raise UserError(
                f"Template '{self.template_document_code}' non trovato.")

        kind_map = {
            'NCND': 'ncnd', 'NDA': 'nda',
            'CONTRATTO_QUADRO': 'contratto',
            'SPLIT_V6': 'split_v6',
            'PROSPETTO_FIRMA': 'deal_prospetto',
        }
        related_kind = kind_map.get(self.code, 'altro')

        deal = self.deal_id
        Partner = self.env['res.partner'].sudo()
        Draft = self.env['erpv6.contract.draft'].sudo()
        Sign = self.env['erpv6.sign.request'].sudo()

        if partner_id:
            partner_ids = [partner_id]
        else:
            partner_ids = [p.partner_id.id for p in deal.participant_ids
                           if p.partner_id and p.partner_id.email][:1]
        if not partner_ids:
            raise UserError("Nessun firmatario con email.")

        partner = Partner.browse(partner_ids[0])
        if not partner.email:
            raise UserError(f"Il partner {partner.name} non ha email.")

        seller = deal.seller_id
        buyer = deal.buyer_id
        extra = {
            'deal_name': deal.name or '',
            'deal_id': deal.id,
            'deal_schema_code': deal.schema_code or '',
            'seller_name': (seller.placeholder_code if seller and seller.is_placeholder
                            else (seller.name if seller else '')),
            'buyer_name': (buyer.placeholder_code if buyer and buyer.is_placeholder
                           else (buyer.name if buyer else '')),
            'prospetto_version': (deal.current_prospetto_id.version
                                  if deal.current_prospetto_id else 1),
            'step_code': self.code,
            'step_label': self.label,
        }

        draft = Draft.create({
            'name': f'{deal.name} — {self.label}',
            'template_id': tpl.id,
            'project_id': deal.relation_id.id if deal.relation_id else False,
            'counterparty_id': partner.id,
            'extra_data': extra,
            'pdf_mode': 'official',
        })
        draft.action_generate_pdf()

        if not draft.document_id or not draft.document_id.pdf_file:
            raise UserError("Generazione PDF fallita.")

        sr = Sign.create({
            'name': f'{deal.name} — {self.label} ({partner.name})',
            'partner_id': partner.id,
            'document_id': draft.document_id.id,
            'contract_draft_id': draft.id,
            'related_kind': related_kind,
            'related_id': deal.id,
            'related_model': 'erpv6.deal',
            'notes': f'Step {self.code} del deal {deal.name}',
        })
        sr.action_send_to_sign()

        self.write({
            'sign_request_id': sr.id,
            'status': 'in_progress',
            'started_at': fields.Datetime.now(),
            'external_reference': draft.document_id.pdf_filename or '',
        })
        self.message_post(
            body=f"Documento inviato in firma a {partner.name}.")

        _logger.info('Step %s -> SR %s a %s', self.code, sr.id, partner.name)
        return {
            'sign_request_id': sr.id,
            'contract_draft_id': draft.id,
            'document_id': draft.document_id.id,
            'external_id': sr.external_id,
            'request_url': sr.request_url,
        }

    def action_skip(self, reason=None):
        for rec in self:
            if rec.blocks_deal_state:
                raise UserError(f"Impossibile saltare '{rec.label}': step bloccante.")
            rec.write({
                'status': 'skipped',
                'evidence_note': (reason or '') + ' [SALTATO]',
                'completed_at': fields.Datetime.now(),
                'completed_by': self.env.user.id,
            })
            rec.deal_message_post = rec.deal_id.message_post
            rec.deal_id.message_post(body=f"⏭ Step saltato: {rec.label}")
        return True
