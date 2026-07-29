{
    'name': 'ERP V6 - Contract Management',
    'version': '18.0.1.0.0',
    'category': 'Sales',
    'summary': 'Gestione contratti, NDA e firme',
    'depends': ['base', 'mail', 'erpv6_core', 'erpv6_package'],
    'data': [
        'security/ir.model.access.csv',
        'views/contract_views.xml',
    ],
    'installable': True,
    'application': False,
}
