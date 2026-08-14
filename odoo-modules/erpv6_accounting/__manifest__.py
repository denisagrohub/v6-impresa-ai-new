{
    'name': 'ERP V6 - Contabilità Predittiva & Fiscale',
    'version': '18.0.1.0.0',
    'category': 'Accounting/Accounting',
    'summary': 'Contabilità predittiva con motore fiscale italiano, match inventario e bandi',
    'description': """
        Estende il modulo contabilità nativo di ERPV6 con:
        - Motore previsionale tasse in tempo reale (IVA, IRES, IRAP)
        - Match inventario ↔ quote deducibili (suggerimenti acquisti)
        - Gestione cespiti con bandi 4.0/5.0 e Transizione 5.0
        - Kairós Finanziario (score 5-15 basato su 5 indicatori)
        - Supporto multi-regime (Ordinario, Semplificato, Forfettario, Agricolo)
        - Integrazione con erpv6_kb per regole fiscali cifrate
        - Dashboard fiscale con simulazioni what-if
    """,
    'author': 'V6 Impresa AI',
    'website': 'https://v6impresa.it',
    'license': 'LGPL-3',
    'depends': [
        'base',
        'account',
        'l10n_it',
        'contacts',
        'product',
        'stock',
        'purchase',
        'mail',          # <-- AGGIUNTO: Necessario per mail.thread
        'erpv6_core',
    ],
    'data': [
        'security/ir.model.access.csv',
        'data/deduction_rules.xml',
        'data/ateco_regime_map.xml',
        'data/cron_jobs.xml',       # <-- AGGIUNTO: File ora creato
        'views/fiscal_prediction_views.xml',
        'views/deduction_suggestion_views.xml',
        'views/asset_advisor_views.xml',
        'views/account_move_views.xml',
        'views/res_partner_views.xml',
        'views/menu_views.xml',
    ],
    'demo': [],
    'installable': True,
    'application': False,
    'auto_install': False,
}