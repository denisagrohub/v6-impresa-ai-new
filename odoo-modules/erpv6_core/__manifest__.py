{
    'name': 'ERP V6 - Core',
    'version': '18.0.1.0.0',
    'category': 'V6 Impresa AI',
    'summary': 'Modulo base condiviso per tutti i moduli V6',
    'author': 'V6 Impresa AI',
    'website': 'https://www.v6impresa.ai',
    'license': 'LGPL-3',
    'depends': ['base', 'mail'],
    'data': [
        'views/core_views.xml',
        'security/ir.model.access.csv',
    ],
    'installable': True,
    'application': True,
}
