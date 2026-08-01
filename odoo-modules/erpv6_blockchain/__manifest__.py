{
    'name': 'ERP V6 - Blockchain Certification',
    'version': '18.0.2.0.0',
    'category': 'Tools',
    'summary': 'Certificazione documenti su blockchain (Polygon)',
    'depends': ['base', 'mail', 'erpv6_core', 'erpv6_crypto'],  # 🔐 Aggiunto crypto
    'data': [
        'security/ir.model.access.csv',
        'views/blockchain_views.xml',
    ],
    'installable': True,
    'application': False,
    'external_dependencies': {
        'python': ['web3'],
    },
}
