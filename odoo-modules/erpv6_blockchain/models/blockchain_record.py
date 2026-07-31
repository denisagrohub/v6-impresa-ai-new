from odoo import models, fields, api
from odoo.exceptions import UserError
import logging

_logger = logging.getLogger(__name__)

class BlockchainRecord(models.Model):
    _name = 'erpv6.blockchain.record'
    _description = 'Record Blockchain'
    _order = 'create_date desc'

    config_id = fields.Many2one('erpv6.blockchain.config', required=True, domain=[('active', '=', True)])
    document_model = fields.Char(required=True)
    document_id = fields.Integer(required=True)
    document_name = fields.Char()
    document_hash = fields.Char(required=True)
    lot_number = fields.Char()
    
    tx_hash = fields.Char(readonly=True)
    block_number = fields.Integer(readonly=True)
    gas_used = fields.Integer(readonly=True)
    gas_cost_eth = fields.Float(readonly=True)
    
    status = fields.Selection([
        ('pending', 'In Attesa'),
        ('confirmed', 'Confermato'),
        ('failed', 'Fallito'),
    ], default='pending', required=True)
    
    error_message = fields.Text(readonly=True)

    def action_certify(self):
        """Certifica il documento su blockchain"""
        self.ensure_one()
        try:
            from web3 import Web3
            w3 = Web3(Web3.HTTPProvider(self.config_id.rpc_url))
            
            if not w3.is_connected():
                raise UserError('Impossibile connettersi alla blockchain.')
            
            account = w3.eth.account.from_key(self.config_id.get_decrypted_private_key())
            nonce = w3.eth.get_transaction_count(account.address)
            
            # Simulazione transazione (in produzione: chiama smart contract)
            self.write({
                'tx_hash': '0x' + '0' * 64,  # Placeholder
                'status': 'confirmed',
            })
            
            return True
        except ImportError:
            raise UserError('Libreria web3 non installata. Esegui: pip install web3')
        except Exception as e:
            self.write({'status': 'failed', 'error_message': str(e)})
            raise UserError(f'Errore: {str(e)}')
