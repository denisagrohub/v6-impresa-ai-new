{
    'name': 'ERP V6 - Knowledge Base',
    'version': '18.0.1.0.0',
    'category': 'V6 Impresa AI',
    'summary': 'Knowledge Base con crittografia e versionamento',
    'author': 'V6 Impresa AI',
    'license': 'LGPL-3',
    'depends': ['base', 'mail', 'erpv6_core', 'erpv6_crypto', 'erpv6_consulting'],
    'data': [
        'security/ir.model.access.csv',
        'data/kb_category_data.xml',
        'views/kb_views.xml',
    ],
    'installable': True,
    'application': True,
}
