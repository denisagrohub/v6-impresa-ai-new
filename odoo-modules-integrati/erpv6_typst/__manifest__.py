{
    'name': 'ERP V6 - Typst Document Generator',
    'version': '18.0.1.0.0',
    'category': 'Tools',
    'summary': 'Generazione documenti PDF con Typst (Business Plan, NDA, Contratti)',
    'description': """
        Motore di generazione documenti PDF usando Typst.
        - Template per Business Plan, Contratti, NDA, SAL
        - Integrazione con Knowledge Base
        - Export in PDF professionale
        - Template personalizzabili
        - Supporto multi-brand
    """,
    'author': 'V6 Impresa AI',
    'website': 'https://www.v6impresa.ai',
    'license': 'LGPL-3',
    'depends': ['base', 'mail', 'erpv6_core', 'erpv6_kb'],
    'data': [
        'security/ir.model.access.csv',
        'data/typst_templates.xml',
        'views/typst_views.xml',
        'views/typst_template_views.xml',
        'views/typst_document_views.xml',
    ],
    'installable': True,
    'application': True,
   
}
