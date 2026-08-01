{
    'name': 'ERP V6 - API Gateway',
    'version': '18.0.2.0.0',
    'category': 'V6 Impresa AI',
    'summary': 'Orchestratore API per Next.js e AI',
    'depends': [
        'base', 'web', 'mail', 'crm',
        'erpv6_core', 'erpv6_kb', 'erpv6_booking',
        'erpv6_consulting', 'erpv6_tracking',
        'erpv6_omni_bridge',  # 🔗 Aggiunto per integrazione AI
        'erpv6_saas',  # Per endpoint SaaS
    ],
    'data': [
        'security/ir.model.access.csv',
        'data/default_api_keys.xml',
    ],
    'installable': True,
    'application': True,
    'external_dependencies': {
        'python': ['jwt', 'cryptography', 'requests']
    },
}
