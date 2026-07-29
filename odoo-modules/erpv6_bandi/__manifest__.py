{
    'name': 'ERPv6 Bandi & Finanziamenti',
    'version': '18.0.1.0.0',
    'summary': 'Motore Bandi e Finanziamenti con matching automatico',
    'description': """
        Modulo per la gestione automatica di bandi e finanziamenti:
        - Scraping automatico da fonti istituzionali
        - Matching intelligente con clienti/progetti
        - Scoring di elegibilità
        - Gestione candidature
        - Integrazione con KB cifrata
    """,
    'category': 'Productivity',
    'author': 'V6 Impresa AI',
    'website': 'https://v6impresa.ai',
    'license': 'LGPL-3',
    'depends': [
        'base',
        'mail',
        'erpv6_deep_source',
        'erpv6_kb',
        'erpv6_consulting',
        'erpv6_core',
    ],
    'data': [
        'security/ir.model.access.csv',
        'data/bandi_sources.xml',
        'data/bandi_cron.xml',
        'data/mail_templates.xml',
        'views/bando_views.xml',
        'views/bando_match_views.xml',
        'views/bando_application_views.xml',
        'views/menu_views.xml',
    ],
    'demo': [
        'demo/bandi_demo.xml',
    ],
    'installable': True,
    'application': True,
    'auto_install': False,
}
