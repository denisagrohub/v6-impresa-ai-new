{
    'name': 'ERP V6 - brand',
    'version': '18.0.1.0.0',
    'depends': ['base', 'mail', 'erpv6_core', 'erpv6_kb', 'erpv6_omni_bridge'],
    'data': [
        'security/ir.model.access.csv',
        'views/brand_views.xml',
    ],
    'installable': True,
    'application': False,
}
