# -*- coding: utf-8 -*-
{
    'name': 'ERPv6 OmniRoute Bridge',
    'version': '18.0.2.0.0',
    'category': 'Productivity',
    'summary': 'Gestione centralizzata routing AI, fallback e proxy sicuro (OmniRoute)',
    'description': """
Modulo ponte per integrare il sistema OmniRoute con ERPV6.
- Configurazione centrale provider AI
- Routing dinamico basato su costo/velocità/qualità
- Fallback automatico in caso di errore
- Logging e monitoraggio costi
- 🔐 API Key cifrate con erpv6_crypto
- 🔐 Proxy di esecuzione: Next.js non vede mai le API Key
    """,
    'author': 'V6 Impresa AI Team',
    'website': 'https://v6-impresa.ai',
    'license': 'LGPL-3',
    'depends': [
        'base',
        'web',
        'erpv6_core',
        'erpv6_kb',
        'erpv6_crypto',  # 🔐 Aggiunto per cifratura API Key
    ],
    'data': [
        'security/ir.model.access.csv',
        'views/omni_route_config_views.xml',
        'views/omni_call_log_views.xml',
        'views/omni_provider_views.xml',
        'views/menu_views.xml',
        'data/omni_default_providers.xml',
        'data/omni_package_metadata_routes.xml',
        'data/omni_brand_routes.xml',
    ],
    'installable': True,
    'application': False,
    'auto_install': False,
}
