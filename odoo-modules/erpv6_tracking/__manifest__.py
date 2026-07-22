{
    'name': 'ERPv6 Tracking - Sistema di Tracciamento Universale',
    'version': '18.0.1.0.0',
    'category': 'Tools',
    'summary': 'Sistema di tracciamento lotti universale per prodotti, documenti, progetti',
    'description': """
        Sistema di tracciamento a due livelli:
        - Lotto Batch: contenitore che segue tutto il flusso
        - Lotto Definitivo: codice univoco sul prodotto finito (AAA-YYGGG-PI-HHMM)
        
        Configurabile per diverse tipologie:
        - Prodotti
        - Documenti
        - Progetti
        - Ordini
        - Custom (aggiungibili)
    """,
    'author': 'ERPv6',
    'website': 'https://erpv6.it',
    'license': 'LGPL-3',
    'depends': [
        'base',
        'product',
    ],
    'data': [
        'security/ir.model.access.csv',
        'data/default_config.xml',
        'views/tracking_config_views.xml',
        'views/tracking_lot_views.xml',
        'views/menu_views.xml',
    ],
    'installable': True,
    'application': True,
    'auto_install': False,
}