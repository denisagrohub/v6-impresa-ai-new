{
    'name': 'V6 Impresa — Signals',
    'version': '18.0.1.0.0',
    'category': 'V6 Impresa',
    'summary': 'Facciata unificata per segnali (Kaizen + Heinrich + Suggestion)',
    'author': 'V6 Impresa AI',
    'license': 'LGPL-3',
    'depends': [
        'base',
        'mail',
        'erpv6_kaizen',
        'erpv6_methodology',
        'erpv6_suggestions',
        'aeosv6_relation',
        'erpv6_winwin_renderdata',
        'erpv6_todo',  # 03/10/2026 (C5-P3): accept→TODO
    ],
    'data': [
        'security/ir.model.access.csv',
        'security/signal_security.xml',
        'views/signal_views.xml',
        'views/signal_menu.xml',
        'data/ir_cron_sync.xml',
        'data/ir_cron_mute_cleanup.xml',
    ],
    'installable': True,
    'application': False,
}
