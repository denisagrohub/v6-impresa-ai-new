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
        'erpv6_bandi',        # richiesto da bandi_api.py
        'erpv6_methodology',  # richiesto da methodology_api.py
        'erpv6_validation',   # richiesto da validation_api.py
        'erpv6_library',      # richiesto da library_api.py
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
