{
    'name': 'ERP V6 - Core Engine (Adaptive EOSv6)',
    'version': '18.0.1.0.0',
    'category': 'V6 Impresa AI',
    'summary': 'Grafo eseguibile Nodo/Circuito/Arco/Fase -- pilota sul circuito 6 Giudici',
    'description': """
        Layer generico "Adaptive EOSv6": rappresenta ed esegue circuiti di
        orchestrazione come grafo (Nodo/Circuito, Arco/Azione, rombo KB, Fase)
        invece di scrivere codice Python dedicato per ogni caso.

        PILOTA: rappresenta il circuito "6 Giudici" di erpv6_validation e
        dimostra che il grafo guida davvero l'esecuzione reale -- disattivare
        l'arco tra un Analista e il Gate cambia quanti analisti girano in una
        sessione vera -- avvolgendo la logica esistente invece di riscriverla.
    """,
    'author': 'V6 Impresa AI',
    'license': 'LGPL-3',
    # erpv6_production e' dipendenza TEMPORANEA/PILOTA-ONLY: serve solo per
    # referenziare via ref() gli xmlid dei 6 prompt KB gia' esistenti
    # (kb_prompt_data.xml) nel seed del circuito 6 Giudici. Da rimuovere
    # quando i rombi KB diventeranno indipendenti dal verticale specifico.
    # erpv6_sign, stesso spirito (Denis, 29/08/2026, decomposizione
    # erpv6_contract/erpv6_sign): Motore Esterno che invia a Documenso via
    # erpv6.sign.request.action_send_to_sign(), e sign_request_ext.py
    # estende erpv6.sign.request per chiudere l'esecuzione quando arriva il
    # completamento vero (webhook o poll) -- stesso pattern gia' in uso per
    # validation_session_ext.py su erpv6_validation.
    'depends': [
        'base', 'mail', 'erpv6_core', 'erpv6_kb', 'erpv6_validation', 'erpv6_production',
        'erpv6_omni_bridge', 'erpv6_sign', 'erpv6_tracking', 'erpv6_library', 'erpv6_kaizen',
    ],
    'data': [
        'security/ir.model.access.csv',
        'views/core_node_views.xml',
        'views/core_circuit_run_views.xml',
        'data/circuit_workspace_root_data.xml',
        'data/circuit_six_judges_data.xml',
        'data/circuit_produzione_fasi_data.xml',
        'data/circuit_ipo_prototype_data.xml',
        'data/circuit_color_prototype_data.xml',
        'data/circuit_tracciabilita_data.xml',
        'data/circuit_kaizen_data.xml',
        'data/circuit_acquisizione_data.xml',
        'data/circuit_process_spec_data.xml',
    ],
    'installable': True,
    'application': True,
}
