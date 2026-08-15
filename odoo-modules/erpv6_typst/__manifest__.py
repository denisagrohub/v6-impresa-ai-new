{
    'name': 'ERPv6 Typst Document Engine',
    'version': '18.0.1.0.0',
    'summary': 'Motore di generazione documenti professionali (Business Plan, Report) con Tipst',
    'description': """
        Modulo per la generazione automatica di documenti PDF professionali 
        utilizzando il motore Tipst. Integra dati da CRM, Contabilità e Bandi
        per creare Business Plan, Report Finanziari e Documenti per Candidature.
        
        Funzionalità:
        - Template .typ versionati e criptati in KB
        - Generazione asincrona PDF
        - Supporto multi-lingua e multi-valuta
        - Integrazione con erpv6_kb per storage sicuro
        - API REST per frontend Next.js
    """,
    'category': 'Productivity/Reporting',
    'author': 'V6 Impresa AI',
    'website': 'https://v6impresa.ai',
    'license': 'LGPL-3',
    'depends': [
        'base', 
        'web', 
        'erpv6_kb', 
        'erpv6_consulting', 
        'erpv6_bandi',
        'account',
        'crm'
    ],
    'data': [
        'security/ir.model.access.csv',
        'views/typst_document_views.xml',
        'views/typst_template_views.xml',
        'views/menu_views.xml',
        'data/typst_templates_data.xml',
    ],
    'demo': [],
    'installable': True,
    'application': False,
    'auto_install': False,
}
