{
    'name': 'V6 Impresa — Suggestions',
    'version': '18.0.1.0.0',
    'category': 'V6 Impresa',
    'summary': 'Motore di suggerimenti automatici per utente',
    'description': """
        Motore C1b: genera max 5 suggerimenti operativi al giorno per
        utente basandosi su eventi deal, firme pending, email non lette.

        Regole configurabili da UI (Impostazioni > Regole suggerimenti).
        6 matcher generici + parametri (soglie, stati, template) come dati.
        Cron giornaliero 06:00 UTC.
    """,
    'author': 'V6 Impresa AI',
    'license': 'LGPL-3',
    'depends': [
        'base',
        'erpv6_winwin_renderdata',
        'aeosv6_relation',
        'erpv6_sign',
        'aeosv6_project_relay',
        'erpv6_omni_bridge',
    ],
    'data': [
        'security/ir.model.access.csv',
        'security/suggestion_security.xml',
        'data/rules_seed.xml',
        'data/omni_route.xml',
        'data/ir_cron.xml',
        'views/suggestion_rule_views.xml',
    ],
    'installable': True,
    'application': False,
}
