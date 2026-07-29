{
    'name': 'ERP V6 - Package Engine',
    'version': '1.0.0',
    'category': 'Sales',
    'summary': 'Gestione pacchetti personalizzati e motore di costo',
    'depends': ['base', 'mail', 'sale', 'erpv6_core'],
    'data': ['security/ir.model.access.csv', 'views/package_views.xml'],
    'installable': True,
    'application': False,
}
