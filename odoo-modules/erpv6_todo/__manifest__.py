{
    'name': 'V6 Impresa — Todo',
    'version': '18.0.1.0.0',
    'category': 'V6 Impresa',
    'summary': 'TODO personali per consulenti e admin',
    'description': """
        TODO operativi V6 Impresa.

        Ogni utente vede e gestisce i propri TODO. L'admin vede tutti.
        Campi di aggancio a erpv6.tracking.relation (progetto partner)
        e erpv6.deal. Placeholder is_auto/source per TODO generati
        automaticamente (C1b).

        Fuori scope: API Next.js e UI dashboard (C1a-2).
    """,
    'author': 'V6 Impresa AI',
    'license': 'LGPL-3',
    'depends': [
        'base',
        'erpv6_winwin_renderdata',
    ],
    'data': [
        'security/ir.model.access.csv',
        'security/todo_security.xml',
        'views/todo_views.xml',
    ],
    'installable': True,
    'application': False,
}
