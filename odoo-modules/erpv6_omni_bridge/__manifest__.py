# -*- coding: utf-8 -*-
{
    'name': 'ERPv6 OmniRoute Bridge',
    'version': '18.0.1.0.0',
    'category': 'Productivity',
    'summary': 'Gestione centralizzata routing AI e provider esterni (OmniRoute)',
    'description': """
Modulo ponte per integrare il sistema OmniRoute con Odoo.
Permette di gestire chiavi API, routing intelligente, fallback e bilanciamento del carico
per tutte le chiamate AI verso provider esterni (OpenAI, Anthropic, Groq, Deepgram, ecc.).

Funzionalità principali:
- Configurazione centrale provider AI
- Routing dinamico basato su costo/velocità/qualità
- Fallback automatico in caso di errore
- Logging e monitoraggio costi
- Integrazione con erpv6_kb per contesto RAG
    """,
    'author': 'V6 Impresa AI Team',
    'website': 'https://v6-impresa.ai',
    'license': 'LGPL-3',
    'depends': [
        'base',
        'erpv6_core',
        'erpv6_kb',
    ],
    'data': [
        'security/ir.model.access.csv',
        'views/omni_provider_views.xml',
        'views/omni_route_config_views.xml',
        'views/omni_call_log_views.xml',
        'views/menu_views.xml',
        'data/omni_default_providers.xml',
    ],
    'installable': True,
    'application': False,
    'auto_install': False,
}
