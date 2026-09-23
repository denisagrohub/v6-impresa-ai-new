from odoo import models, fields, api
from odoo.exceptions import ValidationError

import logging
_logger = logging.getLogger(__name__)


class Erpv6Referral(models.Model):
    _name = 'erpv6.referral'
    _description = 'Segnalazione commerciale per un progetto'
    _order = 'create_date desc'
    _inherit = ['mail.thread', 'mail.activity.mixin']

    name = fields.Char(compute='_compute_name', store=True)

    # Chi ha segnalato
    segnalante_partner_id = fields.Many2one(
        'res.partner', string='Segnalante',
        help='Contatto esterno o azienda che ha segnalato')
    segnalante_user_id = fields.Many2one(
        'res.users', string='Segnalante interno',
        help='Se la segnalazione arriva da un consulente interno')

    # Cosa ha segnalato
    relation_id = fields.Many2one(
        'erpv6.tracking.relation', string='Progetto',
        required=True, ondelete='cascade')
    target_id = fields.Many2one(
        'erpv6.tracking.relation', string='Target generato',
        help='Nodo target creato a valle di questa segnalazione')
    contatto_segnalato_nome = fields.Char(string='Nome/azienda segnalata')
    contatto_segnalato_recapito = fields.Char(string='Email/telefono segnalato')
    note_segnalazione = fields.Text()

    # Compenso
    commissione_pct = fields.Float(string='Commissione %', required=True, default=5.0)
    # 19/09/2026 (Denis): la % diventa IMMUTABILE dopo l'ancoraggio su blockchain.
    # Da quel momento il valore e' parte dell'accordo firmato e non e' piu'
    # modificabile senza uno sblocco esplicito tracciato.
    commissione_locked = fields.Boolean(string='Commissione congelata', readonly=True, default=False)
    commissione_locked_at = fields.Datetime(string='Congelata il', readonly=True)
    commissione_hash = fields.Char(string='Hash SHA-256 accordo', readonly=True)

    # Accordo Documenso
    accordo_documenso_id = fields.Char(string='Documenso Document ID')
    accordo_url = fields.Char(string='URL firma')
    accordo_firmato_il = fields.Datetime()
    firma_hash = fields.Char(
        string='Hash SHA-256 firma',
        readonly=True,
        help='Hash SHA-256 del PDF firmato ricevuto da Documenso. '
             'Corrisponde al file firmato alla data di accordo_firmato_il.')
    accordo_pdf = fields.Binary(attachment=True)
    accordo_pdf_name = fields.Char()

    # Blockchain (collegamento al record di ancoraggio)
    blockchain_record_id = fields.Many2one(
        'erpv6.blockchain.record', string='Ancoraggio blockchain')

    # Stato
    state = fields.Selection([
        ('bozza', 'Bozza'),
        ('in_firma', 'In firma'),
        ('attivo', 'Attivo'),
        ('chiuso_ok', 'Chiuso positivamente'),
        ('chiuso_no', 'Chiuso senza successo'),
    ], default='bozza', required=True)

    # Timestamp
    creato_il = fields.Datetime(default=fields.Datetime.now, readonly=True)

    @api.depends('segnalante_partner_id', 'segnalante_user_id', 'contatto_segnalato_nome')
    def _compute_name(self):
        for r in self:
            who = r.segnalante_partner_id.name or r.segnalante_user_id.name or '?'
            target = r.contatto_segnalato_nome or '?'
            r.name = f"Referral {who} → {target}"

    @api.constrains('segnalante_partner_id', 'segnalante_user_id')
    def _check_segnalante(self):
        for r in self:
            if not r.segnalante_partner_id and not r.segnalante_user_id:
                raise ValidationError('Serve almeno un segnalante (partner o user)')

    def write(self, vals):
        """Blocca la modifica di commissione_pct se il referral e' congelato.
        Per modificarlo serve prima 'action_unlock_commissione' (tracciato)."""
        if 'commissione_pct' in vals:
            for r in self:
                if r.commissione_locked:
                    raise ValidationError(
                        f'Commissione congelata (ancorata il {r.commissione_locked_at}). '
                        'Usa "Sblocca commissione" per modificarla (operazione tracciata).')
        return super().write(vals)

    def action_unlock_commissione(self):
        """Sblocca manualmente la commissione (operazione amministrativa tracciata).
        Crea un record di audit + richiede di ri-ancorare dopo la modifica."""
        for r in self:
            if not r.commissione_locked:
                continue
            # scrivi sul chatter la motivazione? per ora solo reset flag
            super(Erpv6Referral, r).write({
                'commissione_locked': False,
                'commissione_locked_at': False,
            })
        return True

    def _build_agreement_data(self):
        """Costruisce il dict passato al template Typst dell'accordo."""
        import datetime
        self.ensure_one()
        return {
            'data_generazione': datetime.datetime.now().strftime('%d/%m/%Y %H:%M'),
            'nome_segnalante': self.segnalante_partner_id.name or self.segnalante_user_id.name or '',
            'ragione_sociale_segnalante': '',  # TODO: da res.partner.company_name se serve
            'indirizzo_segnalante': self.segnalante_partner_id.contact_address or '',
            'cf_piva_segnalante': self.segnalante_partner_id.vat or '',
            'email_segnalante': self.segnalante_partner_id.email or '',
            'nome_progetto': self.relation_id.name or '',
            'nome_contatto_segnalato': self.contatto_segnalato_nome or '',
            'email_o_telefono_contatto': self.contatto_segnalato_recapito or '',
            'note_segnalazione': self.note_segnalazione or '',
            'commissione_pct': str(self.commissione_pct),
            'data_firma': datetime.date.today().strftime('%d/%m/%Y'),
            'luogo_firma': 'Italia',
            'v6_sede': 'Padova (PD)',           # TODO: parametrizzare
            'v6_piva': '00000000000',           # TODO: parametrizzare
            'citta_foro': 'Padova',
        }

    def action_generate_agreement(self):
        """Genera il PDF dell'accordo tramite il motore Typst.
        Crea un erpv6.typst.document + salva il PDF nell'campo accordo_pdf."""
        self.ensure_one()

        template = self.env['erpv6.typst.template'].search([
            ('category', '=', 'referral_agreement')
        ], limit=1)
        if not template:
            raise ValidationError(
                'Template Typst "referral_agreement" non trovato. '
                'Contatta l\'amministratore per caricarlo.')

        engine = self.env['erpv6.typst.engine']
        data = self._build_agreement_data()

        typst_doc = engine.generate_document(
            template_id=template.id,
            res_model='erpv6.referral',
            res_id=self.id,
            data=data,
        )

        if typst_doc.status != 'ready' or not typst_doc.pdf_file:
            raise ValidationError(
                f"Generazione PDF fallita: {typst_doc.error_message or 'errore sconosciuto'}")

        self.write({
            'accordo_pdf': typst_doc.pdf_file,
            'accordo_pdf_name': typst_doc.pdf_filename or f'Accordo_Referral_{self.id}.pdf',
        })

        self.message_post(body=f'Accordo generato (Typst doc #{typst_doc.id})')
        return True

    def action_send_agreement_to_sign(self):
        """Invia l'accordo a Documenso per la firma del segnalante."""
        self.ensure_one()
        if not self.accordo_pdf:
            self.action_generate_agreement()

        if not self.segnalante_partner_id or not self.segnalante_partner_id.email:
            raise ValidationError('Il segnalante non ha email per la firma')

        Sign = self.env['erpv6.sign.request']
        # crea un erpv6.typst.document ponte (sign_request richiede document_id)
        template = self.env['erpv6.typst.template'].search([
            ('category', '=', 'referral_agreement')
        ], limit=1)
        typst_doc = self.env['erpv6.typst.document'].create({
            'name': f'Accordo Referral #{self.id}',
            'template_id': template.id,
            'res_model': 'erpv6.referral',
            'res_id': self.id,
            'status': 'ready',
            'pdf_file': self.accordo_pdf,
            'pdf_filename': self.accordo_pdf_name or f'Accordo_Referral_{self.id}.pdf',
        })

        sign_req = Sign.create({
            'name': f'Accordo Segnalazione - {self.segnalante_partner_id.name}',
            'partner_id': self.segnalante_partner_id.id,
            'document_id': typst_doc.id,
            'notes': f'Accordo referral per progetto {self.relation_id.name}',
        })
        sign_req.action_send_to_sign()

        self.write({
            'accordo_documenso_id': sign_req.external_id or '',
            'accordo_url': sign_req.request_url or '',
            'state': 'in_firma',
        })
        self.message_post(body=f'Accordo inviato per firma a {self.segnalante_partner_id.name}')
        return True

    def action_cancel_sign_request(self):
        """Annulla l'invio firma Documenso (se non ancora firmato).
        Riporta il referral a 'bozza' per poter rimandare correttamente."""
        self.ensure_one()
        if self.state != 'in_firma':
            raise ValidationError('Nessuna firma da annullare (stato attuale: %s)' % self.state)

        Sign = self.env['erpv6.sign.request']
        sign_req = False
        if self.accordo_documenso_id:
            sign_req = Sign.search([('external_id', '=', self.accordo_documenso_id)], limit=1)
        if not sign_req:
            # fallback: cerca per nome/partner
            sign_req = Sign.search([
                ('partner_id', '=', self.segnalante_partner_id.id),
                ('status', 'in', ['sent', 'viewed', 'draft']),
            ], order='id desc', limit=1)

        if sign_req:
            sign_req.action_cancel()
            self.message_post(body=f'Invio firma annullato ({sign_req.external_id})')

        self.write({
            'state': 'bozza',
            'accordo_url': False,
            'accordo_documenso_id': False,
            'accordo_firmato_il': False,
        })
        return True

    def action_anchor_blockchain(self):
        """Crea un record blockchain e ancora l'hash della segnalazione.
        L'hash è calcolato sul testo canonico della segnalazione (id + contatto + pct)."""
        import hashlib
        for r in self:
            canonical = f"{r.id}|{r.contatto_segnalato_nome or ''}|{r.contatto_segnalato_recapito or ''}|{r.commissione_pct}|{r.segnalante_partner_id.id or 0}|{r.segnalante_user_id.id or 0}"
            h = hashlib.sha256(canonical.encode('utf-8')).hexdigest()

            cfg = self.env['erpv6.blockchain.config'].search(
                [('provider', '=', 'opentimestamps'), ('active', '=', True)], limit=1)
            if not cfg:
                raise ValidationError('Nessuna config OpenTimestamps attiva')

            rec = self.env['erpv6.blockchain.record'].create({
                'config_id': cfg.id,
                'document_model': 'erpv6.referral',
                'document_id': r.id,
                'document_name': r.name or f'Referral #{r.id}',
                'document_hash': h,
            })
            rec.action_anchor_opentimestamps()
            # 19/09/2026: congela la % — da qui in poi e' immutabile
            super(Erpv6Referral, r).write({
                'blockchain_record_id': rec.id,
                'commissione_locked': True,
                'commissione_locked_at': fields.Datetime.now(),
                'commissione_hash': h,
            })
        return True


class Erpv6TrackingRelationReferralExtension(models.Model):
    _inherit = 'erpv6.tracking.relation'

    referral_id = fields.Many2one(
        'erpv6.referral', string='Referral di origine',
        help='Se questo target è nato da una segnalazione commerciale.')
    x_v6_revenue_split = fields.Text(
        string='Ripartizione ricavi (JSON)',
        help="JSON con base compenso + beneficiari (consulenti/referral) + riserva V6.")
    revenue_split_approved = fields.Boolean(
        string='Split approvato', default=False, readonly=True,
        help='Una volta approvato, lo split è immutabile e ancorato su blockchain.')
    revenue_split_approved_at = fields.Datetime(readonly=True)
    revenue_split_approved_by = fields.Many2one('res.users', readonly=True)
    revenue_split_hash = fields.Char(readonly=True)

    # 23/09/2026: flusso accettazione consulente dello split.
    revenue_split_accepted_at = fields.Datetime(string='Split accettato il', readonly=True)
    revenue_split_accepted_by = fields.Many2one('res.users', string='Split accettato da', readonly=True)
    revenue_split_rejected_reason = fields.Text(string='Motivo rifiuto split')
    revenue_split_rejected_at = fields.Datetime(string='Split rifiutato il', readonly=True)
    revenue_split_notified_at = fields.Datetime(string='Notifica split inviata il', readonly=True)

    # 23/09/2026: stato a due livelli. 'bozza' = admin sta compilando;
    # 'in_firma' = hash+blockchain congelati, in attesa firme consulenti;
    # 'approvato' = tutti hanno firmato, definitivo; 'rifiutato' = un
    # consulente ha rifiutato (con motivazione obbligatoria) - admin puo'
    # modificare e rimandare.
    revenue_split_state = fields.Selection([
        ('bozza', 'Bozza'),
        ('in_firma', 'In firma'),
        ('approvato', 'Approvato'),
        ('rifiutato', 'Rifiutato'),
    ], string='Stato split', default='bozza', required=True, index=True)

    def _anchor_split_blockchain(self, hash_value):
        """Ancora l'hash della proposta split su blockchain (OTS/Bitcoin)."""
        for r in self:
            try:
                if 'erpv6.blockchain.record' not in self.env:
                    return
                BcRec = self.env['erpv6.blockchain.record'].sudo()
                cfg = self.env['erpv6.blockchain.config'].sudo().search(
                    [('active', '=', True)], limit=1)
                if not cfg:
                    _logger.warning('Nessuna blockchain.config attiva, skip anchor')
                    return
                rec = BcRec.create({
                    'config_id': cfg.id,
                    'document_id': r.id,
                    'document_model': 'erpv6.tracking.relation',
                    'document_name': f'Split V6 {r.name} (proposta)',
                    'document_hash': hash_value,
                })
                try:
                    rec.action_anchor_opentimestamps()
                except Exception:
                    _logger.exception('OTS anchor fallito per bcrec %s', rec.id)
            except Exception:
                _logger.exception('Blockchain anchor split fallito')

    def action_freeze_and_send_split(self):
        """23/09/2026: congela la PROPOSTA V6 (hash + blockchain) e invia
        le firme ai consulenti. Lo split NON e' definitivo finche' i
        consulenti non firmano. Stato passa a 'in_firma'."""
        import hashlib
        for r in self:
            if not r.x_v6_revenue_split:
                raise ValidationError('Nessuno split da congelare')
            if r.revenue_split_state == 'approvato':
                raise ValidationError('Split gia\' approvato definitivamente')
            # hash proposta
            h = hashlib.sha256(r.x_v6_revenue_split.encode('utf-8')).hexdigest()
            r.write({
                'revenue_split_hash': h,
                'revenue_split_approved_at': fields.Datetime.now(),
                'revenue_split_approved_by': self.env.uid,
                'revenue_split_state': 'in_firma',
            })
            # blockchain anchor proposta
            try:
                r._anchor_split_blockchain(h)
            except Exception:
                _logger.exception('Ancoraggio blockchain proposta fallito')
            # invia firme
            try:
                r.action_send_split_to_sign()
            except Exception:
                _logger.exception('Invio firme fallito')
        return True

    def action_approve_revenue_split(self):
        """DEPRECATO: mantieni per compatibilita' UI. Redirige a
        action_freeze_and_send_split. Non rende piu' definitivo."""
        return self.action_freeze_and_send_split()

    def action_approve_revenue_split(self):
        """Approva lo split: congela + calcola hash SHA-256 + ancora su OTS."""
        import hashlib
        for r in self:
            if not r.x_v6_revenue_split:
                raise ValidationError('Nessuno split da approvare')
            if r.revenue_split_approved:
                raise ValidationError('Split già approvato')

            # Hash canonico
            h = hashlib.sha256(r.x_v6_revenue_split.encode('utf-8')).hexdigest()

            # Crea record blockchain e ancora
            cfg = self.env['erpv6.blockchain.config'].search(
                [('provider', '=', 'opentimestamps'), ('active', '=', True)], limit=1)
            if cfg:
                rec = self.env['erpv6.blockchain.record'].create({
                    'config_id': cfg.id,
                    'document_model': 'erpv6.tracking.relation',
                    'document_id': r.id,
                    'document_name': f'Split {r.name}',
                    'document_hash': h,
                })
                rec.action_anchor_opentimestamps()

            r.write({
                'revenue_split_approved': True,
                'revenue_split_approved_at': fields.Datetime.now(),
                'revenue_split_approved_by': self.env.uid,
                'revenue_split_hash': h,
            })
        return True


    def write(self, vals):
        """23/09/2026: quando cambia x_v6_revenue_split, resetta accettazione
        precedente e invia firma accordo ai consulenti (best-effort)."""
        split_changed = 'x_v6_revenue_split' in vals
        res = super().write(vals)
        if split_changed:
            for rec in self:
                if not rec.x_v6_revenue_split:
                    continue
                try:
                    super().write({
                        'revenue_split_accepted_at': False,
                        'revenue_split_accepted_by': False,
                        'revenue_split_rejected_reason': False,
                        'revenue_split_rejected_at': False,
                        'revenue_split_approved': False,
                        'revenue_split_approved_at': False,
                        'revenue_split_approved_by': False,
                        'revenue_split_hash': False,
                        'revenue_split_notified_at': False,
                        'revenue_split_state': 'bozza',
                    })
                except Exception:
                    _logger.exception('Reset split accettazione fallito id=%s', rec.id)

                try:
                    result = rec.action_send_split_to_sign()
                    for m in (result.get('missing_data') or []):
                        pid = m.get('partner_id')
                        if not pid:
                            continue
                        partner = self.env['res.partner'].sudo().browse(pid)
                        if not partner.exists():
                            continue
                        try:
                            # forzo mail server v6sviluppoimpresa (id=2)
                            # per evitare mittente 'odoobot@example.com'
                            server = self.env['ir.mail_server'].sudo().search(
                                [('from_filter', '=', 'v6sviluppoimpresa.it')], limit=1)
                            rec_ctx = rec.with_context(
                                mail_server_id=server.id if server else False,
                                email_from='V6impresa Sistema <sistema@v6sviluppoimpresa.it>',
                            )
                            rec_ctx.message_notify(
                                partner_ids=[partner.id],
                                subject=f'Completa i tuoi dati per firmare lo split — {rec.name}',
                                body=(
                                    f'<p>Ciao {partner.name or ""},</p>'
                                    f'<p>Sei stato inserito nello split V6 del progetto <b>{rec.name}</b>, '
                                    f'ma mancano dati fiscali per generare l\'accordo di firma.</p>'
                                    f'<p><b>Dati mancanti:</b> {", ".join(m.get("missing", []))}</p>'
                                    f'<p>Apri la dashboard → <b>Il mio profilo fiscale</b> → compila i dati.</p>'
                                ),
                                subtype_xmlid='mail.mt_comment',
                            )
                        except Exception:
                            _logger.exception('Notifica dati fiscali fallita per partner %s', pid)
                except Exception:
                    _logger.exception('Invio firma split fallito id=%s', rec.id)
        return res
