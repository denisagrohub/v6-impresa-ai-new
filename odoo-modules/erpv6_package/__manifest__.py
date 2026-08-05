{
    'name': 'ERP V6 - Package Engine',
    'version': '18.0.1.0.0',
    'category': 'Sales',
    'summary': 'Gestione pacchetti personalizzati e motore di costo',
    # TASK 1 - Aggiunte dipendenze per erpv6_typst (che porta erpv6_kb tramite la catena erpv6_typst -> erpv6_bandi -> erpv6_deep_source -> erpv6_kb)
    # Verifica: erpv6_package non è dipendenza di nessun modulo nella catena, quindi nessuna dipendenza circolare
    'depends': ['base', 'mail', 'sale', 'erpv6_core', 'erpv6_typst', 'erpv6_kb'],
    'data': [
        'security/ir.model.access.csv',
        'views/package_views.xml',
    ],
    'installable': True,
    'application': False,
}
