{
    'name': 'ERP V6 - API Gateway',
    'version': '18.0.1.0.0',
    'category': 'V6 Impresa AI',
    'summary': 'Orchestratore API per Next.js e AI',
    'author': 'V6 Impresa AI',
    'license': 'LGPL-3',
    'depends': ['base', 'web', 'mail', 'crm', 'erpv6_core', 'erpv6_kb', 'erpv6_booking', 'erpv6_consulting', 'erpv6_tracking'],
    'data': ['security/ir.model.access.csv', 'data/default_api_keys.xml'],
    'installable': True,
    'application': True,
    'external_dependencies': {'python': ['jwt', 'cryptography', 'requests']},
}
