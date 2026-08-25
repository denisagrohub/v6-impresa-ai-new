{
    'name': 'ERP V6 - Core',
    'version': '18.0.1.0.0',
    'category': 'V6 Impresa AI',
    'summary': 'Modulo base condiviso per tutti i moduli V6',
    'author': 'V6 Impresa AI',
    'website': 'https://www.v6impresa.ai',
    'license': 'LGPL-3',
    'depends': ['base', 'mail'],
    'data': [
        'security/erpv6_security_groups.xml',
        'views/core_views.xml',
        'security/ir.model.access.csv',
    ],
    'assets': {
        'web.assets_backend': [
            'erpv6_core/static/src/js/error_reporter.js',
        ],
    },
    'installable': True,
    'application': True,
}
