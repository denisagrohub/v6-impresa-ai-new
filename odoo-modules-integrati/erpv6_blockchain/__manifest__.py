{
    'name': 'ERP V6 - Blockchain Certification',
    'version': '18.0.1.0.0',
    'category': 'Tools',
    'summary': 'Certificazione documenti su blockchain (Polygon)',
    'depends': ['base', 'mail', 'erpv6_core'],
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
