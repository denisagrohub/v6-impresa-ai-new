from odoo import models, fields, api
from odoo.exceptions import UserError
import logging

_logger = logging.getLogger(__name__)


class BlockchainRecord(models.Model):
    _name = 'erpv6.blockchain.record'
    _description = 'Record Blockchain'
    _order = 'create_date desc'

    # Relazioni
    config_id = fields.Many2one(
        'erpv6.blockchain.config', string='Configurazione', required=True, domain=[('active', '=', True)])

    # Dati documento
    document_model = fields.Char(
        'Modello Documento', required=True, help='es. erpv6.tracking.lot')
    document_id = fields.Integer('ID Documento', required=True)
    document_name = fields.Char('Nome Documento')
    document_hash = fields.Char('Hash SHA-256', required=True)
    lot_number = fields.Char(
        'Numero Lotto', help='Collegamento a erpv6_tracking')

    # Dati blockchain
    tx_hash = fields.Char('TX Hash', readonly=True)
    block_number = fields.Integer('Numero Blocco', readonly=True)
    gas_used = fields.Integer('Gas Usato', readonly=True)
    gas_cost_eth = fields.Float('Costo Gas (ETH)', readonly=True)

    # Metadata
    timestamp = fields.Datetime('Timestamp Blockchain', readonly=True)
    registrant = fields.Many2one(
        'res.users', string='Registrato da', default=lambda self: self.env.user, readonly=True)

    # Stato
    status = fields.Selection([
        ('pending', 'In Attesa'),
        ('confirmed', 'Confermato'),
        ('failed', 'Fallito'),
    ], string='Stato', default='pending', required=True)

    error_message = fields.Text('Messaggio Errore', readonly=True)
    verification_url = fields.Char(
        'URL Verifica Pubblica', compute='_compute_verification_url')

    @api.depends('tx_hash', 'config_id')
    def _compute_verification_url(self):
        base_url = self.env['ir.config_parameter'].sudo(
        ).get_param('web.base.url')
        for record in self:
            if record.tx_hash and record.config_id:
                record.verification_url = f"{base_url}/api/blockchain/verify/{record.tx_hash}"
            else:
                record.verification_url = False

    def action_certify(self):
        """Certifica il documento su blockchain"""
        self.ensure_one()
        if self.status == 'confirmed':
            raise UserError('Documento già certificato')

        try:
            from web3 import Web3

            w3 = Web3(Web3.HTTPProvider(self.config_id.rpc_url))
            if not w3.is_connected():
                raise UserError(
                    'Impossibile connettersi alla blockchain. Verifica l\'RPC URL.')

            # ABI semplificato del contratto DocumentRegistry
            contract_abi = [{
                "inputs": [
                    {"name": "_hash", "type": "string"},
                    {"name": "_lot", "type": "string"},
                    {"name": "_model", "type": "string"},
                    {"name": "_docId", "type": "uint256"}
                ],
                "name": "registerDocument",
                "outputs": [],
                "stateMutability": "nonpayable",
                "type": "function"
            }]

            contract = w3.eth.contract(
                address=self.config_id.contract_address, abi=contract_abi)
            account = w3.eth.account.from_key(self.config_id.private_key)
            nonce = w3.eth.get_transaction_count(account.address)

            tx = contract.functions.registerDocument(
                self.document_hash,
                self.lot_number or '',
                self.document_model,
                self.document_id
            ).build_transaction({
                'from': account.address,
                'nonce': nonce,
                'gas': self.config_id.gas_limit,
                'gasPrice': w3.eth.gas_price,
            })

            signed_tx = w3.eth.account.sign_transaction(
                tx, private_key=self.config_id.private_key)
            tx_hash = w3.eth.send_raw_transaction(signed_tx.rawTransaction)

            _logger.info(f'⏳ In attesa di conferma per TX: {tx_hash.hex()}')
            receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)

            self.write({
                'tx_hash': tx_hash.hex(),
                'block_number': receipt.blockNumber,
                'gas_used': receipt.gasUsed,
                'gas_cost_eth': float(w3.from_wei(receipt.gasUsed * receipt.effectiveGasPrice, 'ether')),
                'timestamp': fields.Datetime.now(),
                'status': 'confirmed',
            })

            _logger.info(
                f'✅ Documento certificato con successo: {self.tx_hash}')
            return {
                'type': 'ir.actions.client',
                'tag': 'display_notification',
                'params': {'title': 'Certificato', 'message': f'TX: {self.tx_hash[:10]}...', 'type': 'success'}
            }

        except ImportError:
            raise UserError(
                'Libreria web3 non installata. Esegui: pip install web3')
        except Exception as e:
            self.write({'status': 'failed', 'error_message': str(e)})
            _logger.error(f'❌ Errore certificazione: {e}')
            raise UserError(f'Errore durante la certificazione: {str(e)}')
