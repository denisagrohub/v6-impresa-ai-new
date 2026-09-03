{
    'name': 'ERP V6 - Tracking',
    'version': '18.0.1.0.0',
    'category': 'V6 Impresa AI',
    'summary': 'Tracciamento lotti',
    'author': 'V6 Impresa AI',
    'license': 'LGPL-3',
    'depends': [
        'base', 'mail', 'erpv6_core', 'erpv6_consulting', 'erpv6_accounting',
        'erpv6_core_dispatch', 'erpv6_core_engine',
    ],
    'data': [
        'security/ir.model.access.csv',
        'views/tracking_views.xml',
        'views/res_config_settings_views.xml',
        'data/circuit_tracciabilita_data.xml',
    ],
    'installable': True,
    'application': False,
}
