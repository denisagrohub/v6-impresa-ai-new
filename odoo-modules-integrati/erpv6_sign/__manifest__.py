{
    'name': 'ERP V6 - Digital Signature',
    'version': '18.0.1.0.0',
    'category': 'Tools',
    'summary': 'Integrazione con OpenSign per firme elettroniche avanzate',
    'description': """
        Sistema di firma elettronica avanzato con OpenSign.
        - Invio documenti per firma
        - Tracking stato firma
        - Callback automatici da OpenSign
        - Log completo operazioni
        - Wizard installazione OpenSign
    """,
    'author': 'V6 Impresa AI',
    'website': 'https://www.v6impresa.ai',
    'license': 'LGPL-3',
    'depends': ['base', 'mail', 'erpv6_core', 'erpv6_contract', 'erpv6_typst'],
    'data': [
        'security/ir.model.access.csv',
        'data/mail_templates.xml',
        'views/sign_views.xml',
        'views/sign_request_views.xml',
        'views/sign_log_views.xml',
        'views/sign_config_views.xml',
        'wizard/install_opensign_view.xml',
    ],
    'installable': True,
    'application': True,
}
