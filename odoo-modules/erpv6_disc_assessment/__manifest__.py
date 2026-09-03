{
    'name': 'ERP V6 - DISC Assessment (dipendenti)',
    'version': '18.0.1.0.0',
    'category': 'V6 Impresa AI',
    'summary': 'Primo modulo NATIVO Adaptive EOSv6 -- costruito da zero, non convertito',
    'description': """
        Denis, 30/08/2026, prompt #21: non una migrazione -- la domanda era
        se erpv6_core + erpv6_core_dispatch + erpv6_core_engine bastano da
        soli per costruire qualcosa di reale, senza dipendere da nessun
        modulo dominio legacy (erpv6_tracking/erpv6_library/erpv6_production/
        ecc., bloccati nel ciclo scoperto nei prompt #17-#20).

        Fase A del layout DISC dipendenti: intervista minima (banco domande
        campione) -> Motore IPO 'disc_interview_score' (KB-driven, stesso
        principio di kb_engine_process ma auto-contenuto qui, mai toccato
        erpv6_kb) -> risultato scritto su res.users (il "dipendente" reale
        in questo sistema oggi -- nessun modulo HR installato, nessun
        modello erpv6 dedicato trovato in Fase 0) via Output Binding.

        Fase B (correzione da comportamento osservato) NON implementata --
        bloccata dal vincolo legale gia' segnato nell'addendum architetturale.
    """,
    'author': 'V6 Impresa AI',
    'license': 'LGPL-3',
    # Denis, 30/08/2026, Fase 0 -- 'erpv6_kb' aggiunto, non previsto
    # esplicitamente dallo scope originale del prompt: kb_type su erpv6.kb
    # e' una Selection STATICA chiusa (KB_TYPE_SELECTION in erpv6_kb/
    # models/kb_knowledge.py), non dinamica come process_key (corretto nel
    # prompt #15). Aggiungere 'disc_assessment' come valore valido richiede
    # _inherit + selection_add (vedi models/kb_knowledge_ext.py) -- NESSUN
    # file di erpv6_kb toccato, ma e' un _inherit strutturale reale, quindi
    # la dipendenza va dichiarata esplicitamente (stesso principio del
    # prompt #20). erpv6_core_engine dipende gia' da erpv6_kb (nessun
    # ciclo nuovo), ma la dichiaro qui comunque per onesta' -- e' un uso
    # diretto di questo modulo nuovo, non solo transitivo.
    'depends': ['erpv6_core', 'erpv6_core_dispatch', 'erpv6_core_engine', 'erpv6_kb'],
    'data': [
        'security/ir.model.access.csv',
        'data/kb_disc_assessment_data.xml',
        'views/disc_wizard_views.xml',
    ],
    'installable': True,
    'application': False,
}
