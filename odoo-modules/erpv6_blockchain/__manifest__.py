{
    'name': 'ERPv6 Blockchain - Certificazione Documenti',
    'version': '18.0.1.0.0',
    'category': 'Tools',
    'summary': 'Certificazione blockchain per documenti e transazioni',
    'description': """
        Modulo per certificare l'integrità di documenti su blockchain:
        - Supporto Polygon Mainnet / Mumbai Testnet
        - Hash SHA-256 dei documenti
        - Verifica pubblica via API
        - Integrazione nativa con erpv6_tracking
    """,
    'author': 'ERPv6',
    'website': 'https://erpv6.it',
    'license': 'LGPL-3',
    'depends': [
        'base',
        'erpv6_tracking',
    ],
    'external_dependencies': {
        'python': ['web3'],
    },
    'data': [
        'security/ir.model.access.csv',
        'data/default_config.xml',
        'views/blockchain_config_views.xml',
        'views/blockchain_record_views.xml',
    ],
    'installable': True,
    'application': True,
    'auto_install': False,
}
