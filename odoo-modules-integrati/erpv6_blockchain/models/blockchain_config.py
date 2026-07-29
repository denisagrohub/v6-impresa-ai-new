from odoo import models, fields, api

class BlockchainConfig(models.Model):
    _name = 'erpv6.blockchain.config'
    _description = 'Configurazione Blockchain'

    name = fields.Char('Nome Configurazione', required=True, default='Polygon Mumbai Testnet')
    network = fields.Selection([
        ('polygon', 'Polygon Mainnet'),
        ('mumbai', 'Polygon Mumbai (Test)'),
        ('ethereum', 'Ethereum Mainnet'),
        ('sepolia', 'Sepolia Testnet'),
    ], string='Rete', required=True, default='mumbai')
    
    rpc_url = fields.Char('RPC URL', required=True)
    private_key = fields.Char('Chiave Privata', required=True)
    contract_address = fields.Char('Indirizzo Smart Contract', required=True)
    
    active = fields.Boolean('Attivo', default=True)
    gas_limit = fields.Integer('Gas Limit', default=100000)
