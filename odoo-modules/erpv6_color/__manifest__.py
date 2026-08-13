{
    'name': 'ERP V6 - color',
    'version': '18.0.1.0.0',
    'depends': ['base', 'mail', 'erpv6_core', 'erpv6_brand', 'erpv6_kb'],
    'data': [
        'security/ir.model.access.csv',
        'views/brand_project_palette_views.xml',
    ],
    'installable': True,
    'application': False,
}
