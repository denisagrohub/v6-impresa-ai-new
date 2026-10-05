{
    'name': 'V6 Impresa — Processi certificati',
    'version': '18.0.1.0.0',
    'category': 'V6 Impresa',
    'summary': 'Processi certificati attivabili su progetto partner',
    'author': 'V6 Impresa AI',
    'license': 'LGPL-3',
    'depends': [
        'base', 'mail',
        'aeosv6_relation',
        'erpv6_kb',
        'erpv6_crediti',
    ],
    'data': [
        'security/ir.model.access.csv',
        'views/certificate_process_views.xml',
        'data/processes_seed.xml',
    ],
    'installable': True,
    'application': False,
}
