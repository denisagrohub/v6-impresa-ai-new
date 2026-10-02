{
    'name': 'V6 Impresa — Email Read State',
    'version': '18.0.1.0.0',
    'category': 'V6 Impresa',
    'summary': 'Stato lettura per-utente delle email di progetto',
    'description': """
        Traccia chi ha letto ogni email su erpv6.project.email.log.

        Modello: erpv6.email.read.state (join email × utente con
        timestamp di lettura). Lazy: nessuna riga creata al
        ricevimento; una riga nasce al primo mark-read.

        "Unread per utente U" = email ricevuta senza riga (email, U).
        "Chi ha letto" = destinatari (owner/access della relation +
        admin) con left join sulle righe esistenti.
    """,
    'author': 'V6 Impresa AI',
    'license': 'LGPL-3',
    'depends': [
        'base',
        'aeosv6_project_relay',
        'aeosv6_relation',
    ],
    'data': [
        'security/ir.model.access.csv',
        'security/email_read_security.xml',
    ],
    'installable': True,
    'application': False,
}
