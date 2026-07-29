{
    'name': 'ERP V6 - Integrity Check',
    'version': '18.0.1.0.0',
    'category': 'Tools',
    'summary': 'Verifica integrita moduli',
    'author': 'V6 Impresa AI',
    'license': 'LGPL-3',
    'depends': ['base', 'erpv6_core'],
    'data': ['security/ir.model.access.csv', 'data/cron_data.xml', 'views/integrity_views.xml'],
    'installable': True,
    'application': False,
}
