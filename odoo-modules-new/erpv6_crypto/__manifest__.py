{
    'name': 'ERP V6 - Crypto Engine',
    'version': '18.0.1.0.0',
    'category': 'Tools',
    'summary': 'Motore crittografia con doppia cifratura e rotazione chiavi',
    'author': 'V6 Impresa AI',
    'website': 'https://www.v6impresa.ai',
    'license': 'LGPL-3',
    'depends': ['base', 'mail', 'erpv6_core'],
    'data': [
        'security/ir.model.access.csv',
        'views/crypto_views.xml',
        'data/cron_data.xml',
    ],
    'installable': True,
    'application': False,
    'external_dependencies': {
        'python': ['cryptography'],
    },
}
