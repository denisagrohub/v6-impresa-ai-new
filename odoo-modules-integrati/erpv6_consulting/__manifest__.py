{
    'name': 'ERP V6 - Consulting',
    'version': '18.0.1.0.0',
    'category': 'V6 Impresa AI',
    'summary': 'Gestione brand e consulenti',
    'author': 'V6 Impresa AI',
    'license': 'LGPL-3',
    'depends': ['base', 'mail', 'erpv6_core'],
    'data': [
        'security/ir.model.access.csv',
        'data/default_brands.xml',
        'views/consulting_views.xml',
    ],
    'installable': True,
    'application': False,
}
