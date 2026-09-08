{
    'name': 'ERP V6 - Project Relay (AEOSV6)',
    'version': '18.0.1.0.0',
    'category': 'Sales',
    'summary': 'Email di progetto (catch-all v6sviluppoimpresa.it) e creazione nodi progetto, composti nativamente nel grafo AEOSV6',
    'author': 'V6 Impresa AI',
    'license': 'LGPL-3',
    'depends': ['base', 'mail', 'project', 'aeosv6_relation', 'erpv6_core_dispatch', 'erpv6_core_engine'],
    'data': [
        'security/ir.model.access.csv',
        'data/circuit_progetti_data.xml',
        'views/project_email_log_views.xml',
        'views/new_project_wizard_views.xml',
        'views/send_project_email_wizard_views.xml',
    ],
    'installable': True,
    'application': False,
}
