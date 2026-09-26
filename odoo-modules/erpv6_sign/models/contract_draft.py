from odoo import api, fields, models
from odoo.exceptions import UserError
import json
import base64
import logging

_logger = logging.getLogger(__name__)


class Erpv6ContractDraft(models.Model):
    """Bozza di contratto/documento da generare e far firmare.

    26/09/2026: modello generico per il composer admin.
    Funziona per QUALSIASI template: NDA, introduzione, split, contratto, ecc.
    Pesca dati da progetto + controparte + company, utente compila il resto.
    """
    _name = 'erpv6.contract.draft'
    _description = 'Bozza contratto/documento'
    _inherit = ['mail.thread']
    _order = 'create_date desc'

    name = fields.Char(string='Titolo', required=True, tracking=True)

    # === SORGENTI ===
    template_id = fields.Many2one(
        'erpv6.typst.template', string='Template', required=True,
        help='Template Typst da usare per generare il PDF')
    project_id = fields.Many2one(
        'erpv6.tracking.relation', string='Progetto',
        help='Progetto da cui pescare dati (parti, charter, base compenso). Opzionale.')
    counterparty_id = fields.Many2one(
        'res.partner', string='Controparte',
        help='Chi firma il documento insieme a V6 (o destinatario). Opzionale.')

    # === DATI AGGIUNTIVI ===
    extra_data = fields.Json(
        string='Dati aggiuntivi',
        help="JSON con i campi compilati dall'utente. Merge sopra quelli auto da progetto/partner.")

    # === PDF ===
    pdf_mode = fields.Selection([
        ('preview', 'Anteprima (filigrana)'),
        ('official', 'Ufficiale'),
    ], string='Modalità PDF', default='official', required=True,
       help='Anteprima = filigrana ANTEPRIMA, non inviabile per firma. Ufficiale = PDF definitivo.')

    document_id = fields.Many2one(
        'erpv6.typst.document', string='Documento generato', readonly=True)

    # === FIRME ===
    sign_request_ids = fields.One2many(
        'erpv6.sign.request', 'contract_draft_id', string='Richieste di firma')

    # === VERSIONING ===
    revision = fields.Integer(string='Revisione', default=1, readonly=True)
    revision_notes = fields.Text(string='Note revisione')
    last_generated_at = fields.Datetime(string='Ultima generazione', readonly=True)

    # === STATO ===
    state = fields.Selection([
        ('draft', 'Bozza'),
        ('generated', 'PDF Generato'),
        ('sent', 'Inviato per firma'),
        ('signed', 'Firmato'),
        ('cancelled', 'Annullato'),
    ], string='Stato', default='draft', tracking=True)

    # === FIRMA V6 (controfirma) ===
    needs_v6_signature = fields.Boolean(
        string='Richiede firma V6', default=True,
        help='Se True, V6 deve controfirmare il documento dopo la controparte.')
    v6_signer_id = fields.Many2one(
        'res.users', string='Firma per V6',
        default=lambda self: self.env.user,
        help='Utente V6 che controfirma il documento.')
    v6_sign_order = fields.Selection([
        ('first', 'V6 firma per primo'),
        ('second', 'V6 controfirma dopo controparte'),
        ('parallel', 'Firma parallela'),
    ], string='Ordine firma', default='second', required=True)

    # === INTEGRITÀ / ANTI-ALTERAZIONE ===
    original_pdf_hash = fields.Char(
        string='Hash SHA-256 originale', readonly=True,
        help='Hash SHA-256 del PDF al momento della generazione.')
    counterparty_signed_pdf_hash = fields.Char(
        string='Hash PDF firmato controparte', readonly=True)
    v6_signed_pdf_hash = fields.Char(
        string='Hash PDF firmato V6', readonly=True)
    integrity_verified = fields.Boolean(
        string='Integrità verificata', readonly=True, default=False)
    integrity_verified_at = fields.Datetime(
        string='Verifica integrità il', readonly=True)
    integrity_notes = fields.Text(string='Note verifica integrità')

    # === BLOCKCHAIN / ANCHOR ===
    blockchain_anchor_original = fields.Char(
        string='Tx hash anchor originale', readonly=True)
    blockchain_anchor_cp_signed = fields.Char(
        string='Tx hash anchor controparte', readonly=True)
    blockchain_anchor_v6_signed = fields.Char(
        string='Tx hash anchor V6', readonly=True)

    # === LINK AI SIGN REQUEST ===
    counterparty_sign_request_id = fields.Many2one(
        'erpv6.sign.request', string='Firma controparte', readonly=True)
    v6_sign_request_id = fields.Many2one(
        'erpv6.sign.request', string='Firma V6', readonly=True)

    # ================================================================
    # DATA BUILDING
    # ================================================================
    def _build_render_data(self):
        """Costruisce il dict dati per il rendering Typst.
        Merge di: company + progetto + controparte + extra_data (utente).
        """
        self.ensure_one()
        data = {}

        # 1. Da COMPANY (V6)
        company = self.env.company
        if not company:
            company = self.env['res.company'].sudo().search(
                [('name', 'ilike', 'V6 Impresa')], limit=1)
        if company:
            data.update({
                'v6_nome': company.name or 'V6 Impresa',
                'v6_sede': ', '.join(filter(None, [
                    company.street or '', company.street2 or '',
                    f"{company.zip or ''} {company.city or ''}".strip(),
                ])),
                'v6_piva': company.vat or '',
                'v6_cf': getattr(company, 'l10n_it_codice_fiscale', None) or '',
                'v6_email': getattr(company, 'x_v6_contact_email', None) or company.email or '',
                'v6_telefono': company.phone or '',
            })

        # 2. Da PROGETTO
        if self.project_id:
            proj = self.project_id
            data.update({
                'progetto_nome': proj.name or '',
                'progetto_id': proj.id,
            })
            # Base compenso da charter (se esiste)
            if proj.x_v6_charter:
                try:
                    charter = json.loads(proj.x_v6_charter)
                    bc = (charter.get('data') or {}).get('baseCompenso') or {}
                    if bc:
                        data.update({
                            'base_tipo': bc.get('tipo') or 'fisso_unita',
                            'base_valore': str(bc.get('valore') or 0),
                            'base_unita': bc.get('unita') or 'EUR',
                        })
                except (json.JSONDecodeError, TypeError, AttributeError):
                    pass

        # 3. Da CONTROPARTE
        if self.counterparty_id:
            p = self.counterparty_id
            data.update({
                'controparte_nome': p.name or '',
                'controparte_indirizzo': ', '.join(filter(None, [
                    p.street or '', p.street2 or '',
                    f"{p.zip or ''} {p.city or ''}".strip(),
                    p.state_id.name if p.state_id else '',
                    p.country_id.name if p.country_id else '',
                ])),
                'controparte_piva': p.vat or '',
                'controparte_cf': getattr(p, 'l10n_it_codice_fiscale', None) or '',
                'controparte_email': p.email or '',
                'controparte_telefono': p.phone or '',
                'controparte_rappresentante': p.name or '',
            })

        # 4. EXTRA_DATA (utente sovrascrive tutto)
        if self.extra_data and isinstance(self.extra_data, dict):
            data.update(self.extra_data)

        # 5. Metadati sempre presenti
        data.setdefault('data_generazione', fields.Date.today().strftime('%d/%m/%Y'))
        data['pdf_mode'] = self.pdf_mode
        data['revision'] = self.revision

        return data

    # ================================================================
    # GENERAZIONE PDF
    # ================================================================
    def action_generate_pdf(self):
        """Genera (o rigenera) il PDF tramite engine.
        Se già esiste un documento, lo sovrascrive e incrementa revision.
        """
        self.ensure_one()
        if not self.template_id:
            raise UserError('Template mancante')

        data = self._build_render_data()
        engine = self.env['erpv6.typst.engine'].sudo()

        source = self.template_id.typst_source or ''
        result = engine.preview_source(source, data)

        if not result.get('ok'):
            return {
                'success': False,
                'errors': result.get('errors', []),
                'raw': result.get('raw_stderr', ''),
            }

        pdf_bytes = result['pdf']

        if self.document_id:
            # Rigenera: aggiorna il documento esistente + revision
            self.document_id.sudo().write({
                'render_data': data,
                'pdf_file': base64.b64encode(pdf_bytes),
                'pdf_filename': f'{self.name}.pdf',
                'status': 'ready',
                'rendered_at': fields.Datetime.now(),
            })
            doc = self.document_id
            new_rev = self.revision + 1
        else:
            doc = self.env['erpv6.typst.document'].sudo().create({
                'name': self.name,
                'template_id': self.template_id.id,
                'res_model': 'erpv6.contract.draft',
                'res_id': self.id,
                'render_data': data,
                'pdf_file': base64.b64encode(pdf_bytes),
                'pdf_filename': f'{self.name}.pdf',
                'status': 'ready',
                'rendered_at': fields.Datetime.now(),
            })
            new_rev = self.revision

        # 26/09/2026: calcola hash SHA-256 per anti-alterazione + anchor blockchain
        import hashlib
        original_hash = hashlib.sha256(pdf_bytes).hexdigest()
        anchor_tx = self._anchor_hash_on_blockchain(original_hash)

        self.write({
            'document_id': doc.id,
            'state': 'generated',
            'revision': new_rev,
            'last_generated_at': fields.Datetime.now(),
            'original_pdf_hash': original_hash,
            'blockchain_anchor_original': anchor_tx or False,
            'integrity_verified': False,  # nuovo hash = nuova verifica
            'integrity_verified_at': False,
        })

        self.message_post(body=(
            f"PDF generato — revisione {new_rev} ({len(pdf_bytes)} byte)\n"
            f"Hash SHA-256: {original_hash[:16]}...\n"
            f"Anchor blockchain: {anchor_tx or 'non disponibile'}"
        ))

        return {
            'success': True,
            'document_id': doc.id,
            'pdf_size': len(pdf_bytes),
            'revision': new_rev,
            'original_hash': original_hash,
        }

    def action_regenerate(self):
        """Alias esplicito per rigenerare (usato dalla UI)."""
        return self.action_generate_pdf()

    # ================================================================
    # MODIFICA / RIPORTA IN BOZZA
    # ================================================================
    def action_edit(self):
        """Riporta la bozza in stato editabile.
        - draft/generated: no-op (già editabile)
        - sent: cancella sign request attive → torna a 'draft'
        - signed: BLOCCA (contratto firmato = immutabile)
        """
        self.ensure_one()
        if self.state == 'signed':
            raise UserError(
                'Contratto firmato: non modificabile. '
                'Crea un addendum o una nuova bozza separata.'
            )
        if self.state == 'sent':
            # Cancella sign request attive
            for sr in self.sign_request_ids.filtered(
                lambda s: s.status in ('sent', 'viewed', 'draft')
            ):
                try:
                    sr.action_cancel()
                except Exception:
                    sr.write({'status': 'cancelled'})
            self.write({'state': 'draft'})
            self.message_post(body="Riportato in bozza: firme attive annullate.")
        return True

    def action_duplicate(self):
        """Crea una copia come nuova bozza (per riusare un contratto come base)."""
        self.ensure_one()
        new_draft = self.copy({
            'name': f'{self.name} (copia)',
            'state': 'draft',
            'revision': 1,
            'document_id': False,
        })
        return {
            'type': 'ir.actions.act_window',
            'res_model': 'erpv6.contract.draft',
            'res_id': new_draft.id,
            'view_mode': 'form',
            'target': 'current',
        }

    # ================================================================
    # INVIO PER FIRMA (con blocco placeholder)
    # ================================================================
    def _anchor_hash_on_blockchain(self, hash_value):
        """Anchor SHA-256 su OpenTimestamps (best-effort).
        Ritorna tx hash se riesce, None altrimenti."""
        try:
            Model = self.env.get('erpv6.blockchain.record')
            if not Model:
                return None
            rec = Model.sudo().create({
                'name': f'Contratto {self.name}',
                'document_hash': hash_value,
                'model_name': 'erpv6.contract.draft',
                'record_id': self.id,
            })
            # Chiama anchor se il metodo esiste
            if hasattr(rec, 'action_anchor_opentimestamps'):
                rec.action_anchor_opentimestamps()
            return rec.tx_hash if hasattr(rec, 'tx_hash') else str(rec.id)
        except Exception as e:
            _logger.warning('Anchor blockchain fallito: %s', e)
            return None

    def action_verify_integrity(self):
        """Verifica che il PDF attuale corrisponda all'hash originale.
        Blocca la controfirma se c'è alterazione."""
        self.ensure_one()
        if not self.document_id or not self.document_id.pdf_file:
            raise UserError('Nessun PDF generato.')
        if not self.original_pdf_hash:
            raise UserError('Hash originale mancante. Rigenera il PDF.')

        import hashlib, base64
        pdf_bytes = base64.b64decode(self.document_id.pdf_file)
        current_hash = hashlib.sha256(pdf_bytes).hexdigest()

        match = (current_hash == self.original_pdf_hash)
        if match:
            self.write({
                'integrity_verified': True,
                'integrity_verified_at': fields.Datetime.now(),
                'integrity_notes': f'Verificato: {current_hash[:16]}... corrisponde all\'originale.',
            })
            self.message_post(body=f"✓ Integrità verificata — hash {current_hash[:16]}...")
            return {'success': True, 'match': True, 'hash': current_hash}
        else:
            self.write({
                'integrity_verified': False,
                'integrity_notes': f'ALTERATO: atteso {self.original_pdf_hash[:16]}... trovato {current_hash[:16]}...',
            })
            self.message_post(body=f"✗ INTEGRITÀ FALLITA — hash diverso!")
            return {
                'success': False,
                'match': False,
                'expected': self.original_pdf_hash,
                'actual': current_hash,
            }

    def action_send_for_signature(self, partner_ids=None):
        """Invia il documento per firma. Blocca se:
        - PDF non generato
        - pdf_mode = 'preview' (le anteprime non si firmano)
        - campi placeholder '[DA DEFINIRE]' ancora presenti
        """
        self.ensure_one()

        if not self.document_id:
            raise UserError('Genera prima il PDF.')

        if self.pdf_mode == 'preview':
            raise UserError(
                'Impossibile inviare per firma un PDF in modalità Anteprima. '
                'Cambia pdf_mode su "Ufficiale" e rigenera.'
            )

        # Blocco placeholder: SOLO se il valore è un placeholder esplicito
        # (es. "[DA COMPILARE]" o formato [CONTROPARTE_PIVA]). I campi
        # legittimamente vuoti (P.IVA per persona fisica, PEC assente, ecc.)
        # NON bloccano.
        import re as _re
        PLACEHOLDER_FORMAT = _re.compile(r'^\[[A-Z][A-Z_0-9/ ]+\]$')

        data = self._build_render_data()
        blocking = []
        for k, v in data.items():
            if not isinstance(v, str):
                continue
            vstrip = v.strip()
            if not vstrip:
                continue  # vuoto: OK (campo non applicabile)
            vup = vstrip.upper()
            if '[DA DEFINIRE]' in vup or '[DA COMPILARE]' in vup:
                blocking.append(k)
            elif PLACEHOLDER_FORMAT.match(vstrip):
                blocking.append(k)

        if blocking:
            raise UserError(
                'Impossibile inviare per firma. Campi ancora con placeholder:\n'
                + '\n'.join(f'  • {k}' for k in blocking)
            )

        # 26/09/2026: crea un sign request per la controparte e invia via Documenso.
        # Se partner_ids è passato esplicitamente, li usa; altrimenti usa la controparte.
        target_partner_ids = partner_ids or ([self.counterparty_id.id] if self.counterparty_id else [])
        if not target_partner_ids:
            raise UserError('Nessuna controparte o destinatario specificato per la firma.')

        Sign = self.env['erpv6.sign.request'].sudo()
        Partner = self.env['res.partner'].sudo()

        # 26/09/2026: flusso Modo A — V6 controfirma dopo controparte.
        # Ordine:
        #  - 'second' (default): prima controparte, poi V6 quando arriva firma
        #  - 'first': prima V6, poi controparte
        #  - 'parallel': entrambi subito
        order = self.v6_sign_order or 'second'
        send_cp_now = order in ('first', 'parallel')  # controparte subito se non 'second'
        send_v6_now = order in ('first', 'parallel') or not self.needs_v6_signature

        if order == 'second':
            send_cp_now = True
            send_v6_now = False
        elif order == 'first':
            send_cp_now = False
            send_v6_now = True

        cp_sr_id = None
        v6_sr_id = None

        # 1. Firma controparte (se previsto ora)
        if send_cp_now:
            for pid in target_partner_ids:
                partner = Partner.browse(pid)
                if not partner.exists():
                    continue
                sr = Sign.create({
                    'name': self.name,
                    'partner_id': pid,
                    'document_id': self.document_id.id,
                    'contract_draft_id': self.id,
                    'related_kind': self._get_related_kind(),
                    'related_id': self.id,
                    'related_model': 'erpv6.contract.draft',
                    'notes': f'Bozza rev. {self.revision} — firma controparte',
                })
                try:
                    sr.action_send_to_sign()
                    cp_sr_id = sr.id
                    _logger.info('Sign request controparte %s inviato a %s', sr.id, partner.name)
                except Exception as e:
                    _logger.exception('Errore invio firma a %s: %s', partner.name, e)
                break  # per ora: primo partner = controparte principale

        # 2. Firma V6 (se previsto ora)
        if self.needs_v6_signature and send_v6_now and self.v6_signer_id:
            v6_partner = self.v6_signer_id.partner_id
            sr = Sign.create({
                'name': self.name,
                'partner_id': v6_partner.id,
                'document_id': self.document_id.id,
                'contract_draft_id': self.id,
                'related_kind': self._get_related_kind(),
                'related_id': self.id,
                'related_model': 'erpv6.contract.draft',
                'notes': f'Bozza rev. {self.revision} — firma V6',
            })
            try:
                sr.action_send_to_sign()
                v6_sr_id = sr.id
                _logger.info('Sign request V6 %s inviato a %s', sr.id, v6_partner.name)
            except Exception as e:
                _logger.exception('Errore invio firma V6: %s', e)

        if not cp_sr_id and not v6_sr_id:
            raise UserError('Nessun sign request creato. Controlla i log.')

        vals = {'state': 'sent'}
        if cp_sr_id:
            vals['counterparty_sign_request_id'] = cp_sr_id
        if v6_sr_id:
            vals['v6_sign_request_id'] = v6_sr_id
        self.write(vals)

        self.message_post(body=(
            f"Inviato per firma (ordine={order}). "
            f"Controparte sr={cp_sr_id or '-'} V6 sr={v6_sr_id or '-'}"
        ))

        return {
            'success': True,
            'state': 'sent',
            'counterparty_sr_id': cp_sr_id,
            'v6_sr_id': v6_sr_id,
        }

    def _get_related_kind(self):
        """Mappa il template_code in un related_kind valido per sign_request.
        26/09/2026: ritorna sempre 'contratto' per contract_draft, il dispatch
        usa contract_draft_id per instradare a _handle_contract_draft."""
        return 'contratto'
