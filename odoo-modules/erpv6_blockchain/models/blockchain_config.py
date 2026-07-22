from odoo import models, fields, api


class BlockchainConfig(models.Model):
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

    # Credenziali
    rpc_url = fields.Char('RPC URL', required=True,
                          help='URL del nodo blockchain (es. Alchemy, Infura)')
    private_key = fields.Char('Chiave Privata', required=True,
                              help='Chiave privata per firmare transazioni (mantenere sicura)')
    contract_address = fields.Char(
        'Indirizzo Smart Contract', required=True, help='Indirizzo del contratto DocumentRegistry')

    # Stato
    active = fields.Boolean('Attivo', default=True)
    gas_limit = fields.Integer('Gas Limit', default=100000)

    # Statistiche
    total_certified = fields.Integer(
        'Totale Certificati', compute='_compute_stats')
    total_cost_eth = fields.Float(
        'Costo Totale (ETH)', compute='_compute_stats')

    @api.depends('active')
    def _compute_stats(self):
        for config in self:
            records = self.env['erpv6.blockchain.record'].search([
                ('config_id', '=', config.id),
                ('status', '=', 'confirmed')
            ])
            config.total_certified = len(records)
            config.total_cost_eth = sum(records.mapped('gas_cost_eth'))
