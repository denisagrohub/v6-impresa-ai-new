from odoo import http
from odoo.http import request
import json


class BlockchainController(http.Controller):

    @http.route('/api/blockchain/verify/<string:tx_hash>', type='http', auth='public', methods=['GET'], csrf=False)
    def verify_document(self, tx_hash, **kwargs):
        """Verifica pubblica di un documento certificato"""
        record = request.env['erpv6.blockchain.record'].sudo().search([
            ('tx_hash', '=', tx_hash),
            ('status', '=', 'confirmed')
        ], limit=1)

        if not record:
            return request.make_response(
                json.dumps(
                    {'success': False, 'error': 'Record non trovato o non confermato'}),
                headers=[('Content-Type', 'application/json')]
            )

        return request.make_response(
            json.dumps({
                'success': True,
                'data': {
                    'tx_hash': record.tx_hash,
                    'block_number': record.block_number,
                    'timestamp': record.timestamp.isoformat() if record.timestamp else None,
                    'document_name': record.document_name,
                    'lot_number': record.lot_number,
                    'document_hash': record.document_hash,
                    'verification_url': record.verification_url,
                }
            }),
            headers=[('Content-Type', 'application/json')]
        )
