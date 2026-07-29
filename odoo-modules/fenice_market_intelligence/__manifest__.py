{
    'name': 'Fenice Market Intelligence',
    'version': '18.0.1.0.0',
    'category': 'Sales/Analytics',
    'summary': 'Raccolta e analisi dati di mercato da API esterne',
    'depends': ['base', 'sale_management', 'product', 'mail'],
    'data': [
        'security/fenice_market_intelligence_security.xml',
        'views/fenice_market_trend_views.xml',
        'views/menu.xml',
        'data/cron_jobs.xml',
    ],
    'installable': True,
    'application': True,
    'license': 'LGPL-3',
}