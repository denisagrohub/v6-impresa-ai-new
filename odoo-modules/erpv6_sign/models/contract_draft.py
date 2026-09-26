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

        self.write({
            'document_id': doc.id,
            'state': 'generated',
            'revision': new_rev,
            'last_generated_at': fields.Datetime.now(),
        })

        self.message_post(body=f"PDF generato — revisione {new_rev} ({len(pdf_bytes)} byte)")

        return {
            'success': True,
            'document_id': doc.id,
            'pdf_size': len(pdf_bytes),
            'revision': new_rev,
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

        # Blocco placeholder
        data = self._build_render_data()
        placeholders = [
            k for k, v in data.items()
            if isinstance(v, str) and (
                '[DA DEFINIRE]' in v.upper() or
                '[DA COMPILARE]' in v.upper() or
                v.strip() == ''
            )
        ]
        # Escludi i campi che possono essere vuoti legittimamente
        ALLOWED_EMPTY = {
            'controparte_cf', 'controparte_telefono', 'v6_telefono',
            'v6_cf', 'base_tipo', 'base_valore', 'base_unita',
            'pdf_mode', 'revision', 'progetto_id',
        }
        blocking = [k for k in placeholders if k not in ALLOWED_EMPTY]

        if blocking:
            raise UserError(
                'Impossibile inviare per firma. Campi mancanti o placeholder:\n'
                + '\n'.join(f'  • {k}' for k in blocking)
            )

        # Crea sign request (logica delegata al modulo sign)
        # In attesa di definire chi firma (V6 + controparte? solo controparte?)
        # Lasciamo aperto: per ora crea solo una nota, l'invio firma vero e proprio
        # lo aggiungiamo nello Step 2
        self.write({'state': 'sent'})
        self.message_post(body="Inviato per firma (workflow da completare nello Step 2).")
        return {'success': True, 'state': 'sent'}
