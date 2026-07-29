# -*- coding: utf-8 -*-
{
    'name': 'V6 Enterprise White Label',
    'version': '18.0.1.0.0',
    'summary': 'Modulo White Label per personalizzazione branding aziendale',
    'description': """
        Modulo per personalizzare il branding di Odoo 18 Community.
        
        Funzionalità:
        - Personalizzazione logo aziendale
        - Favicon personalizzata
        - Colori primari e secondari del brand
        - Override template web backend
        - Configurazione multi-azienda
    """,
    'category': 'Productivity',
    'author': 'V6 Enterprise',
    'website': 'https://v6-enterprise.com',
    'license': 'LGPL-3',
    'depends': [
        'base',
        'web',
        'mail',
    ],
    'data': [
        'security/ir.model.access.csv',
        'views/whitelabel_config_views.xml',
        'views/web_assets.xml',
        'data/default_config_data.xml',
    ],
    'demo': [],
    'installable': True,
    'application': False,
    'auto_install': False,
    'images': ['static/description/icon.png'],
}
