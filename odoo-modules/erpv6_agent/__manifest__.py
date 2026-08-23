{
    'name': 'ERP V6 - Agent Engine',
    'version': '18.0.1.0.0',
    'category': 'V6 Impresa AI',
    'summary': 'Base comune per agenti AI: registro configurazioni + proposta con gate umano',
    'description': """
        Estratto da erpv6_kaizen il 20/08/2026 (primo agente reale: Kaizen)
        su richiesta esplicita dell'utente: "gli agenti hanno vita in un
        modulo a se'?" -- si'. Un agente qui e' identita' (nome/codice) +
        dove trova le istruzioni (una categoria erpv6.kb) + quale route
        erpv6_omni_bridge chiamare. L'esecuzione (cosa l'agente fa
        concretamente coi dati e col risultato AI) resta specifica per
        agente, definita nel modulo che lo registra (es. erpv6_kaizen) --
        questo modulo NON esegue nulla da solo, e' solo la base condivisa.

        erpv6.agent.proposal e' il gate umano condiviso da tutti gli agenti:
        una proposta AI resta sempre in attesa di revisione, mai
        auto-applicata (stesso principio gia' seguito ovunque nel progetto).
    """,
    'author': 'V6 Impresa AI',
    'license': 'LGPL-3',
    'depends': ['base', 'crm', 'mail', 'erpv6_kb', 'erpv6_omni_bridge', 'erpv6_library', 'erpv6_crypto'],
    'data': [
        'security/ir.model.access.csv',
        'data/agent_pattern_data.xml',
        'views/agent_views.xml',
        'views/agent_confirmation_views.xml',
        'views/library_document_views.xml',
        'data/agent_andrea_data.xml',
        'data/agent_susanna_data.xml',
        'data/agent_telegram_cron_data.xml',
        'data/agent_monitor_data.xml',
        'data/agent_monitor_rules_data.xml',
    ],
    'installable': True,
    'application': False,
}
