{
    'name': 'PI Booking - Calendario e Prenotazioni',
    'version': '18.0.1.0.0',
    'category': 'Consulting',
    'summary': 'Gestione calendario consulenti e slot pubblici prenotabili',
    'description': """
        Modulo per gestire:
        - Calendario generale dei consulenti
        - Slot pubblici prenotabili dal sito
        - Sync con Google Calendar (bidirezionale)
        - Email di conferma automatiche
        - Creazione automatica lead CRM
    """,
    'author': 'Progetto Impresa',
    'website': 'https://progettoimpresa.it',
    'license': 'LGPL-3',
    'depends': [
        'base',
        'calendar',
        'crm',
        'mail',
    ],
    'data': [
        'security/ir.model.access.csv',
        'views/calendar_event_views.xml',
        'data/mail_templates.xml',
        'data/automated_actions.xml',
    ],
    'installable': True,
    'application': False,
    'auto_install': False,
}