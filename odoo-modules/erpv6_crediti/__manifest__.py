{
    'name': 'V6 Impresa — Crediti',
    'version': '18.0.1.0.0',
    'category': 'V6 Impresa',
    'summary': 'Cassetto fiscale AdE — portfolio + parser PDF',
    'author': 'V6 Impresa AI',
    'license': 'LGPL-3',
    'depends': [
        'base', 'mail', 'aeosv6_relation', 'erpv6_winwin_renderdata',
        'erpv6_kb', 'erpv6_signals',
    ],
    'data': [
        'security/ir.model.access.csv',
        'views/credit_portfolio_views.xml',
        'views/credit_line_views.xml',
    ],
    'installable': True,
    'application': False,
}
