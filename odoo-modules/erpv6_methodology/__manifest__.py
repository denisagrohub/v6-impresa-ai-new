{
    'name': 'ERP V6 - Methodology Engines',
    'version': '18.0.1.0.0',
    'category': 'V6 Impresa AI',
    'summary': 'Motori generici del Metodo V6 (Pareto, Kairós, Matrix 5S, Heinrich)',
    'author': 'V6 Impresa AI',
    'license': 'LGPL-3',
    'depends': ['base', 'mail', 'erpv6_core'],
    'data': [
        'security/ir.model.access.csv',
        'views/methodology_views.xml',
    ],
    'installable': True,
    'application': True,
}
