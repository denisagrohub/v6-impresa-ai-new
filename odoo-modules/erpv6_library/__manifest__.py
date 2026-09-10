{
    'name': 'ERP V6 - Library',
    'version': '18.0.1.0.0',
    'category': 'V6 Impresa AI',
    'summary': 'Gestione documentale per progetti',
    'author': 'V6 Impresa AI',
    'license': 'LGPL-3',
    # 10/09/2026, incidente in produzione: 'erpv6_core_engine' rimosso da
    # qui. Era l'arco condiviso di DUE cicli reali (erpv6_library ->
    # erpv6_core_engine -> erpv6_production -> erpv6_library, ed erpv6_
    # library -> erpv6_core_engine -> erpv6_sign -> erpv6_typst ->
    # erpv6_library), entrambi tollerati per settimane dal registro Odoo
    # gia' in memoria finche' una serie di `-u all` stanotte non ha
    # forzato una ricostruzione completa del grafo, bloccando l'avvio
    # (erpv6.production.order irraggiungibile per il frontend). Verificato
    # PRIMA di tagliare: l'unico uso reale di erpv6_core_engine qui e'
    # env['erpv6.core.output'] dentro _run_label_output
    # (models/aeosv6_dispatch.py) - una lookup a runtime dentro una
    # funzione registrata via dispatch (mai eseguita al caricamento del
    # modulo), non un _inherit ne' un campo Many2one strutturale, e
    # nessun dato XML di questo modulo referenzia erpv6_core_engine.* -
    # a differenza del tentativo (poi revertito) di togliere erpv6_sign
    # da erpv6_core_engine, che aveva rotto un _inherit reale.
    'depends': [
        'base', 'mail', 'erpv6_core', 'erpv6_tracking', 'erpv6_blockchain', 'erpv6_brand',
        'erpv6_core_dispatch',
    ],
    'data': [
        'security/ir.model.access.csv',
        'data/tracking_config_data.xml',
        'views/library_views.xml',
        'views/brand_project_views.xml',
    ],
    'installable': True,
    'application': True,
}
