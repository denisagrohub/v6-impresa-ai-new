from odoo import api, fields, models, _
from odoo.exceptions import UserError
import requests
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
    
    def action_send_to_sign(self):
        """Crea un envelope su Documenso (API v2, /envelope/*) e lo invia al firmatario.

        Documenso sta migrando la sua API pubblica da "Document"/"Template" a
        "Envelope": entrambe sono ancora attive su questa istanza (v2.16.0), ma
        Envelope è la scelta forward-looking, quindi è quella usata qui.
        """
        self.ensure_one()

        if not self.document_id or not self.document_id.pdf_file:
            raise UserError(_('Documento non disponibile'))
        if not self.partner_id.email:
            raise UserError(_('Il firmatario non ha un indirizzo email'))

        config = self.env['erpv6.sign.config'].search([('active', '=', True)], limit=1)
        if not config:
            raise UserError(_('Configurazione Documenso non trovata'))
        if not config.api_key:
            raise UserError(_('API Key Documenso non configurata'))

        import base64
        import json as json_lib

        base = config._api_base()
        headers = config._api_headers()
        pdf_bytes = base64.b64decode(self.document_id.pdf_file)
        filename = self.document_id.pdf_filename or f'{self.name}.pdf'

        # Un solo campo firma di default, in basso a destra sulla prima pagina.
        # Coordinate/percentuali: posizionamento fine campi è fuori scope qui,
        # va gestito lato Documenso (editor) se serve un layout diverso.
        create_payload = {
            'title': self.name,
            'type': 'DOCUMENT',
            'recipients': [{
                'email': self.partner_id.email,
                'name': self.partner_id.name or self.partner_id.email,
                'role': 'SIGNER',
                'fields': [{
                    'type': 'SIGNATURE',
                    'page': 1,
                    'positionX': 70,
                    'positionY': 85,
                    'width': 25,
                    'height': 6,
                }],
            }],
        }

        try:
            create_resp = requests.post(
                f'{base}/envelope/create',
                headers=headers,
                data={'payload': json_lib.dumps(create_payload)},
                files={'files': (filename, pdf_bytes, 'application/pdf')},
                timeout=30,
            )
            if create_resp.status_code != 200:
                raise UserError(_('Errore creazione envelope Documenso: %s') % create_resp.text)
            envelope_id = create_resp.json()['id']

            # Recupera l'id dell'envelope item (serve per scaricare il PDF firmato).
            detail_resp = requests.get(f'{base}/envelope/{envelope_id}', headers=headers, timeout=15)
            detail_resp.raise_for_status()
            envelope = detail_resp.json()
            envelope_items = envelope.get('envelopeItems') or []
            envelope_item_id = envelope_items[0]['id'] if envelope_items else False

            distribute_resp = requests.post(
                f'{base}/envelope/distribute',
                headers=headers,
                json={
                    'envelopeId': envelope_id,
                    'meta': {
                        'subject': _('Documento da firmare: %s') % self.name,
                        'message': self.notes or '',
                        'distributionMethod': 'EMAIL',
                    },
                },
                timeout=30,
            )
            if distribute_resp.status_code != 200:
                raise UserError(_('Errore invio envelope Documenso: %s') % distribute_resp.text)

            distribute_data = distribute_resp.json()
            recipients = distribute_data.get('recipients') or []
            signing_url = recipients[0].get('signingUrl') if recipients else ''

            self.write({
                'status': 'sent',
                'external_id': envelope_id,
                'envelope_item_id': envelope_item_id,
                'request_url': signing_url or '',
                'sent_at': fields.Datetime.now(),
            })

            self.env['erpv6.sign.log'].create({
                'request_id': self.id,
                'action': 'sent',
                'details': f'Documento inviato a Documenso: {envelope_id}',
            })

            self.message_post(body=_("Richiesta di firma inviata a %s") % self.partner_id.name)

        except UserError:
            raise
        except Exception as e:
            _logger.error(f'Errore invio firma: {e}')
            raise UserError(_('Errore durante l\'invio della richiesta: %s') % str(e))

    def action_check_status(self):
        """Verifica lo stato dell'envelope su Documenso (GET /envelope/{id}).

        Chiamato sia manualmente (pulsante 'Verifica Stato') sia dal controller
        webhook su evento DOCUMENT_COMPLETED, per riusare la stessa logica di
        mappatura stato invece di duplicarla nel webhook.
        """
        self.ensure_one()

        if not self.external_id:
            return

        config = self.env['erpv6.sign.config'].search([('active', '=', True)], limit=1)
        if not config or not config.api_key:
            return

        try:
            response = requests.get(
                f'{config._api_base()}/envelope/{self.external_id}',
                headers=config._api_headers(),
                timeout=15,
            )
            if response.status_code != 200:
                _logger.warning(f'Verifica stato Documenso fallita: {response.status_code} {response.text}')
                return

            envelope = response.json()
            envelope_status = envelope.get('status')  # DRAFT/PENDING/COMPLETED/REJECTED/CANCELLED

            recipient = None
            for r in envelope.get('recipients') or []:
                if (r.get('email') or '').lower() == (self.partner_id.email or '').lower():
                    recipient = r
                    break

            new_status = self.status
            if envelope_status == 'COMPLETED':
                new_status = 'signed'
            elif envelope_status in ('REJECTED', 'CANCELLED'):
                new_status = 'declined'
            elif recipient and recipient.get('signingStatus') == 'SIGNED':
                new_status = 'signed'
            elif recipient and recipient.get('readStatus') == 'OPENED':
                new_status = 'viewed'

            if new_status != self.status:
                vals = {'status': new_status}
                if new_status == 'viewed':
                    vals['viewed_at'] = fields.Datetime.now()
                elif new_status == 'signed':
                    vals['signed_at'] = fields.Datetime.now()
                self.write(vals)

                self.env['erpv6.sign.log'].create({
                    'request_id': self.id,
                    'action': f'status_{new_status}',
                    'details': f'Stato aggiornato: {new_status}',
                })

            if new_status == 'signed' and not self.signed_document and self.envelope_item_id:
                self._fetch_signed_document(config)

        except Exception as e:
            _logger.error(f'Errore verifica stato: {e}')

    def _fetch_signed_document(self, config):
        """Scarica il PDF firmato (GET /envelope/item/{envelopeItemId}/download).

        A differenza di quasi tutti gli altri endpoint v2, questo NON restituisce
        JSON ma il PDF grezzo (application/pdf) direttamente nel body: verificato
        con una chiamata reale, non documentato esplicitamente nello schema OpenAPI.
        """
        self.ensure_one()
        try:
            doc_resp = requests.get(
                f'{config._api_base()}/envelope/item/{self.envelope_item_id}/download',
                headers=config._api_headers(),
                timeout=30,
            )
            if doc_resp.status_code == 200:
                import base64
                self.write({'signed_document': base64.b64encode(doc_resp.content)})
            else:
                _logger.warning(f'Download documento firmato fallito: {doc_resp.status_code} {doc_resp.text}')
        except Exception as e:
            _logger.error(f'Errore download documento firmato: {e}')
