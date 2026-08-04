{
    'name': 'ERP V6 - Deep Source',
    'version': '18.0.1.0.0',
    'category': 'V6 Impresa AI',
    'summary': 'Estrazione dati da fonti esterne (API, scraping) tramite microservizio scraper e AI',
    'author': 'V6 Impresa AI',
    'license': 'LGPL-3',
    'depends': ['base', 'mail', 'erpv6_core', 'erpv6_kb', 'erpv6_omni_bridge', 'erpv6_crypto'],
    'external_dependencies': {
        'python': ['requests'],
    },
    'data': [
        'security/ir.model.access.csv',
        'views/deep_source_views.xml',
        'data/deep_source_config_data.xml',
    ],
    'installable': True,
    'application': True,
}
