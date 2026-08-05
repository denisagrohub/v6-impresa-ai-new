# -*- coding: utf-8 -*-
{
    'name': 'ERP V6 - Deep Source',
    'version': '18.0.1.0.0',
    'category': 'V6 Impresa AI',
    'summary': 'Estrazione dati da fonti esterne (API, scraping) tramite microservizio scraper e AI',
    'description': """
        Modulo per estrazione dati da fonti esterne:
        - Scraping via browser headless (microservizio scraper)
        - API ufficiali (Google Trends, Amazon, ecc.)
        - Estrazione strutturata tramite AI (erpv6_omni_bridge)
        - Integrazione con KB cifrata
    """,
    'author': 'V6 Impresa AI',
    'license': 'LGPL-3',
    'depends': ['base', 'mail', 'erpv6_core', 'erpv6_kb', 'erpv6_omni_bridge', 'erpv6_crypto'],
    'external_dependencies': {
        'python': ['requests'],
    },
    'data': [
        'security/ir.model.access.csv',
        'views/deep_source_config_views.xml',
        'data/deep_source_config_data.xml',
    ],
    'installable': True,
    'application': True,
}
