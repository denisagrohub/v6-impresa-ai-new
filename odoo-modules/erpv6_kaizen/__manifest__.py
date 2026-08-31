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
    # Denis, 30/08/2026, prompt #22: erpv6_core_dispatch + erpv6_core_engine
    # aggiunti -- neo4j_write_fix/kaizen_signal_to_context si registrano da
    # sole qui (models/aeosv6_dispatch.py), e data/circuit_kaizen_data.xml
    # (spostato da erpv6_core_engine) crea davvero erpv6.core.node/.arc/
    # .kb_link/.output/.output_link, che vivono in erpv6_core_engine.
    # Verificato in Fase 0: nessun ciclo, erpv6_kaizen non e' nella catena
    # di dipendenze di erpv6_core_engine dopo questa rimozione.
    'depends': [
        'base', 'crm', 'account', 'erpv6_methodology', 'erpv6_kb', 'erpv6_production', 'erpv6_agent',
        'erpv6_core_dispatch', 'erpv6_core_engine',
    ],
    'data': [
        'security/ir.model.access.csv',
        'data/kaizen_cron.xml',
        'data/kaizen_agent_config.xml',
        'data/kaizen_plain_language_data.xml',
        'data/circuit_kaizen_data.xml',
        'views/kaizen_views.xml',
        'views/dashboard_views.xml',
        'views/product_proposal_wizard_views.xml',
    ],
    'installable': True,
    'application': False,
}
