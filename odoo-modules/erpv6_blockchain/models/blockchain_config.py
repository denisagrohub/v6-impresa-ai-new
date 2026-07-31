from odoo import models, fields, api
import json


class BlockchainConfig(models.Model):
    """
    🔐 Configurazione Blockchain con private_key cifrata.
    
    La private_key viene cifrata automaticamente con erpv6_crypto
    al salvataggio e decifrata solo per uso interno (firma transazioni).
    """
    _name = 'erpv6.blockchain.config'
    _description = 'Configurazione Blockchain'
    
    name = fields.Char('Nome Configurazione', required=True, 
                       default='Polygon Mumbai Testnet')
    network = fields.Selection([
        ('polygon', 'Polygon Mainnet'),
        ('mumbai', 'Polygon Mumbai (Test)'),
        ('ethereum', 'Ethereum Mainnet'),
        ('sepolia', 'Sepolia Testnet'),
    ], string='Rete', required=True, default='mumbai')
    rpc_url = fields.Char('RPC URL', required=True)
    
    # 🔐 CAMPO CIFRATO: Viene cifrato automaticamente in create/write
    private_key = fields.Char('Chiave Privata (Cifrata)', required=True)
    
    contract_address = fields.Char('Indirizzo Smart Contract', required=True)
    active = fields.Boolean('Attivo', default=True)
    gas_limit = fields.Integer('Gas Limit', default=100000)

    @api.model
    def create(self, vals):
        """Cifra la private_key automaticamente alla creazione"""
        if 'private_key' in vals and vals['private_key']:
            vals['private_key'] = self._encrypt_key(vals['private_key'])
        return super().create(vals)

    def write(self, vals):
        """Cifra la private_key automaticamente all'aggiornamento"""
        if 'private_key' in vals and vals['private_key']:
            vals['private_key'] = self._encrypt_key(vals['private_key'])
        return super().write(vals)

    def _encrypt_key(self, key):
        """Cifra la chiave con erpv6_crypto"""
        try:
            json.loads(key)
            return key  # Già cifrata
        except (json.JSONDecodeError, TypeError):
            return self.env['erpv6.crypto.engine'].encrypt(key)

    def get_decrypted_private_key(self):
        """🔐 Restituisce la private_key in chiaro per uso interno"""
        self.ensure_one()
        if not self.private_key:
            return ''
        try:
            payload = json.loads(self.private_key)
            if 'data' in payload:
                return self.env['erpv6.crypto.engine'].decrypt(self.private_key)
        except (json.JSONDecodeError, TypeError):
            pass
        return self.private_key  # Fallback legacy
