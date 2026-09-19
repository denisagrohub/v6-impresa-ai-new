from odoo import http
from odoo.http import request
import json


class BlockchainController(http.Controller):

    @http.route('/api/blockchain/verify/<string:identifier>',
                type='http', auth='public', methods=['GET'], csrf=False)
    def verify_document(self, identifier, **kwargs):
        """Verifica pubblica di un documento ancorato.

        identifier = tx_hash (Polygon) oppure record_id per OTS.
        Ritorna JSON con dati del record.
        """
        Record = request.env['erpv6.blockchain.record'].sudo()

        record = Record.search([
            ('tx_hash', '=', identifier),
            ('status', 'in', ['submitted', 'confirmed']),
        ], limit=1)

        if not record and identifier.isdigit():
            record = Record.browse(int(identifier))
            if not record.exists():
                record = None

        if not record:
            return request.make_response(
                json.dumps({'success': False, 'error': 'Record non trovato'}),
                headers=[('Content-Type', 'application/json')]
            )

        data = {
            'success': True,
            'data': {
                'id': record.id,
                'provider': record.provider,
                'document_name': record.document_name,
                'document_hash': record.document_hash,
                'status': record.status,
                'created_at': record.create_date.isoformat() if record.create_date else None,
                'tx_hash': record.tx_hash or None,
                'block_number': record.block_number or None,
                'ots_submitted_at': record.ots_submitted_at.isoformat() if record.ots_submitted_at else None,
                'ots_confirmed_at': record.ots_confirmed_at.isoformat() if record.ots_confirmed_at else None,
            }
        }
        return request.make_response(
            json.dumps(data),
            headers=[('Content-Type', 'application/json')]
        )
