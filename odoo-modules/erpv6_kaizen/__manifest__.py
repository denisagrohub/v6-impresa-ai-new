{
    'name': 'ERP V6 - Kaizen Detection',
    'version': '18.0.1.0.0',
    'category': 'V6 Impresa AI',
    'summary': 'Rilevamento automatico di segnali tecnici da stati gia\' strutturati (nessun log parsing, nessun autofix)',
    'description': """
        Collante minimale tra i motori generici (erpv6_methodology) e i moduli
        che monitora (erpv6_validation, erpv6_production): un cron interroga
        SOLO campi gia' strutturati nel database (mai testo di log libero) e
        registra i segnali trovati tramite erpv6.heinrich.indicator.log_signal
        e erpv6.pareto.analysis.log_item.

        Confini espliciti, decisi il 20/08/2026: non ripara nulla, non apre
        PR, non tocca lo stato dei record che monitora. E' solo il sensore,
        non l'autofix (di cui si e' deciso di ragionare separatamente).
    """,
    'author': 'V6 Impresa AI',
    'license': 'LGPL-3',
    'depends': ['base', 'crm', 'account', 'erpv6_methodology', 'erpv6_kb', 'erpv6_production', 'erpv6_agent'],
    'data': [
        'security/ir.model.access.csv',
        'data/kaizen_cron.xml',
        'data/kaizen_agent_config.xml',
        'data/kaizen_plain_language_data.xml',
        'views/kaizen_views.xml',
        'views/dashboard_views.xml',
    ],
    'installable': True,
    'application': False,
}
