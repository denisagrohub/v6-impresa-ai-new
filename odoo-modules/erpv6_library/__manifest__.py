{
    'name': 'ERP V6 - Library',
    'version': '18.0.1.0.0',
    'category': 'V6 Impresa AI',
    'summary': 'Gestione documentale per progetti',
    'author': 'V6 Impresa AI',
    'license': 'LGPL-3',
    'depends': ['base', 'mail', 'erpv6_core', 'erpv6_tracking', 'erpv6_blockchain', 'erpv6_brand'],
    'data': [
        'security/ir.model.access.csv',
        'views/library_views.xml',
        'views/brand_project_views.xml',
    ],
    'installable': True,
    'application': True,
}
