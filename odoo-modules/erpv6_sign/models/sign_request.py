from odoo import api, fields, models, _
from odoo.exceptions import UserError
import logging

_logger = logging.getLogger(__name__)


class SignRequest(models.Model):
    _name = 'erpv6.sign.request'
    _description = 'Richiesta di Firma'
    _inherit = ['mail.thread', 'mail.activity.mixin']
    _order = 'create_date desc'

    name = fields.Char(string='Nome Richiesta', required=True, tracking=True)
    contract_id = fields.Many2one('erpv6.contract', string='Contratto')
    document_id = fields.Many2one('erpv6.typst.document', string='Documento')
    partner_id = fields.Many2one('res.partner', string='Firmatario', required=True, tracking=True)
    
    # Stato
    status = fields.Selection([
        ('draft', 'Bozza'),
        ('sent', 'Inviata'),
        ('viewed', 'Visualizzata'),
        ('signed', 'Firmata'),
        ('expired', 'Scaduta'),
        ('declined', 'Rifiutata'),
        ('cancelled', 'Annullata'),
    ], string='Stato', default='draft', tracking=True)
    
    # Documenso
    external_id = fields.Char(string='ID Envelope (Documenso)', readonly=True)
    envelope_item_id = fields.Char(string='ID Elemento Envelope (Documenso)', readonly=True)
    request_url = fields.Char(string='URL Firma', readonly=True)
    
    # Timestamps
    sent_at = fields.Datetime(string='Inviata il')
    viewed_at = fields.Datetime(string='Visualizzata il')
    signed_at = fields.Datetime(string='Firmata il')
    
    # Firma
    signature_hash = fields.Char(string='Hash Firma', readonly=True)
    signed_document = fields.Binary(string='Documento Firmato', attachment=True, readonly=True)
    
    # Metadata
    notes = fields.Text(string='Note')

    # 23/09/2026: riferimento al progetto se la firma e' un accordo split V6.
    split_project_id = fields.Many2one(
        'erpv6.tracking.relation', string='Progetto (split V6)',
        ondelete='set null',
        help="Valorizzato quando la firma e' un accordo split V6 per un consulente.")

    # 23/09/2026: dispatch generico per il webhook. Il tipo di documento
    # firmato determina quale handler applicare al callback Documenso.
    related_kind = fields.Selection([
        ('referral', 'Accordo Referral'),
        ('split_v6', 'Accordo Split V6'),
        ('nda', 'NDA'),
        ('ncnd', 'NCND'),
        ('contratto', 'Contratto'),
        ('altro', 'Altro'),
    ], string='Tipo documento', default='altro', index=True)
    related_id = fields.Integer(
        string='ID record correlato',
        help='ID del record sorgente (es. erpv6.tracking.relation.id per split_v6).')
    related_model = fields.Char(
        string='Modello correlato',
        help='Nome tecnico del modello sorgente (es. erpv6.tracking.relation).')
    
    def _get_adapter(self):
        """23/09/2026: ritorna l'adapter del provider firma attivo."""
        self.ensure_one()
        config = self.env['erpv6.sign.config'].search([('active', '=', True)], limit=1)
        if not config:
            raise UserError(_('Configurazione firma non trovata'))
        if config.provider == 'documenso' and not config.api_key:
            raise UserError(_('API Key Documenso non configurata'))
        if config.provider == 'certyneo' and not config.certyneo_api_key:
            raise UserError(_('API Key Certyneo non configurata'))
        return config.get_provider_adapter()

    def action_send_to_sign(self):
        """Invia il documento a firma tramite il provider attivo."""
        self.ensure_one()
        try:
            adapter = self._get_adapter()
            result = adapter.send(self)
            self.write({
                'status': result.get('status', 'sent'),
                'external_id': result.get('external_id'),
                'envelope_item_id': result.get('envelope_item_id'),
                'request_url': result.get('request_url') or '',
                'sent_at': fields.Datetime.now(),
            })
            self.env['erpv6.sign.log'].create({
                'request_id': self.id,
                'action': 'sent',
                'details': result.get('details') or 'Firma inviata',
            })
            self.message_post(body=_("Richiesta di firma inviata a %s") % self.partner_id.name)
        except UserError:
            raise
        except Exception as e:
            _logger.exception('Invio firma fallito')
            raise UserError(_('Errore durante l\'invio della richiesta: %s') % str(e))


    def action_check_status(self):
        """Legge stato dal provider e aggiorna il record locale."""
        self.ensure_one()
        if not self.external_id:
            return
        try:
            adapter = self._get_adapter()
            result = adapter.check_status(self)
            if not result:
                return
            new_status = result.get('status')
            if new_status and new_status != self.status:
                vals = {'status': new_status}
                if new_status == 'viewed':
                    vals['viewed_at'] = fields.Datetime.now()
                elif new_status == 'signed':
                    vals['signed_at'] = fields.Datetime.now()
                self.write(vals)
                self.env['erpv6.sign.log'].create({
                    'request_id': self.id,
                    'action': f'status_{new_status}',
                    'details': result.get('details') or f'Stato {new_status}',
                })
            if new_status == 'signed' and not self.signed_document:
                self._fetch_signed_document()
            if new_status == 'signed':
                self._sync_signed_contract_document()
        except Exception:
            _logger.exception('Verifica stato firma fallita')


    def action_cancel(self):
        """Annulla la richiesta di firma (se non ancora firmata)."""
        self.ensure_one()
        if self.status not in ('sent', 'viewed', 'draft'):
            raise UserError(_('Impossibile annullare: la richiesta è in stato "%s"') % self.status)
        try:
            adapter = self._get_adapter()
            result = adapter.cancel(self)
            self.write({'status': result.get('status', 'cancelled')})
            self.env['erpv6.sign.log'].create({
                'request_id': self.id,
                'action': 'cancelled',
                'details': result.get('details') or 'Firma annullata',
            })
            self.message_post(body=_("Richiesta di firma annullata"))
            return True
        except UserError:
            raise
        except Exception as e:
            _logger.exception('Annullamento firma fallito')
            raise UserError(_('Errore durante l\'annullamento: %s') % str(e))


    def _sync_signed_contract_document(self):
        """Propaga il completamento firma al documento sorgente, quando
        questa richiesta viene dal flusso NDA/contratto/promessa di
        pagamento di erpv6_production (Compito "documenso-invio-reale",
        26/08/2026) - riusa il riferimento generico gia' scritto da
        erpv6.typst.engine.generate_document su document_id.res_model/
        res_id, nessun nuovo campo di collegamento introdotto. Chiamata
        sia dal poll manuale (action_check_status) sia dal webhook
        DOCUMENT_COMPLETED, che passano entrambi da qui.

        signed_by NON viene valorizzato qui: erpv6.contract.document.signed_by
        e' tipizzato res.users (utente interno), ma il vero firmatario di
        questo flusso e' self.partner_id (res.partner, il cliente esterno) -
        tipi incompatibili. Non inventiamo una mappatura utente/partner:
        decisione di design da confermare con Denis (vedi report)."""
        self.ensure_one()
        doc = self.document_id
        if not doc:
            return

        import base64
        import hashlib
        sig_hash = None
        if self.signed_document:
            sig_hash = hashlib.sha256(base64.b64decode(self.signed_document)).hexdigest()

        # 20/09/2026: due possibili destinazioni del PDF firmato:
        # 1) erpv6.contract.document (contratti commerciali, originale)
        # 2) erpv6.referral (accordi di segnalazione - nuovo)
        if doc.res_model == 'erpv6.contract.document' and doc.res_id:
            contract_doc = self.env['erpv6.contract.document'].sudo().browse(doc.res_id)
            if contract_doc.exists():
                vals = {'signed_at': self.signed_at or fields.Datetime.now()}
                if sig_hash:
                    vals['signature_hash'] = sig_hash
                contract_doc.write(vals)

        elif doc.res_model == 'erpv6.referral' and doc.res_id:
            referral = self.env['erpv6.referral'].sudo().browse(doc.res_id)
            if referral.exists():
                referral.write({
                    'state': 'attivo',
                    'accordo_firmato_il': self.signed_at or fields.Datetime.now(),
                })
                if sig_hash:
                    # salva hash firma sul referral (nuovo campo opzionale)
                    try:
                        referral.write({'firma_hash': sig_hash})
                    except Exception:
                        pass  # campo non ancora presente, skip silenzioso
                partner_name = self.partner_id.name or '?'
                sign_date = (self.signed_at or fields.Datetime.now()).strftime('%d/%m/%Y %H:%M')
                hash_short = (sig_hash[:16] + '...') if sig_hash else '-'
                msg = "Accordo firmato da %s il %s. Hash firma: %s" % (partner_name, sign_date, hash_short)
                referral.message_post(body=msg)
                # Notifica al responsabile (via activity sul referral)
                responsible = referral.segnalante_user_id or referral.create_uid
                if responsible:
                    try:
                        referral.activity_schedule(
                            'mail.mail_activity_data_todo',
                            user_id=responsible.id,
                            summary=f'Accordo referral firmato: {referral.name}',
                            note=(self.partner_id.name or '?') + ' ha firmato l\'accordo il ' +
                                 (self.signed_at or fields.Datetime.now()).strftime('%d/%m/%Y %H:%M') + '.',
                        )
                    except Exception:
                        pass  # activity_schedule fallisce se mail.activity.mixin assente

    def _fetch_signed_document(self):
        """Scarica il PDF firmato tramite l'adapter."""
        self.ensure_one()
        try:
            adapter = self._get_adapter()
            content = adapter.fetch_signed(self)
            if content:
                import base64
                self.write({'signed_document': base64.b64encode(content)})
        except Exception:
            _logger.exception('Download documento firmato fallito')

