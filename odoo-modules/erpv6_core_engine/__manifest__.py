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
        'base', 'mail', 'web_hierarchy', 'erpv6_core', 'erpv6_core_dispatch', 'erpv6_kb',
        'erpv6_validation', 'erpv6_production', 'erpv6_sign',
    ],
    # Denis, 30/08/2026, prompt #22: erpv6_kaizen RIMOSSO da qui.
    # neo4j_write_fix/kaizen_signal_to_context si sono spostate in
    # erpv6_kaizen/models/aeosv6_dispatch.py, si registrano da sole via
    # erpv6_core_dispatch. circuit_kaizen_data.xml (5 xmlid reali
    # referenziati a tempo di caricamento: 4 cron + 1 KB) si e' spostato
    # con loro -- vive in erpv6_kaizen/data/ ora. Verificato in Fase 0
    # (prompt #22): nessuno dei moduli rimasti in depends (erpv6_kb,
    # erpv6_validation, erpv6_production, erpv6_sign) dipende da
    # erpv6_kaizen -- nessun ciclo, a differenza di erpv6_tracking/
    # erpv6_library (bloccati da erpv6_production->erpv6_library, mai
    # risolto, vedi commento sotto).
    # Denis, 30/08/2026, prompt #17+#19 (sblocca §O per davvero): sia
    # erpv6_tracking sia erpv6_library RIMOSSI da qui. create_tracking_lot
    # si e' spostato in erpv6_tracking/models/aeosv6_dispatch.py (#17),
    # file_to_library/label_output in erpv6_library/models/aeosv6_dispatch.py
    # (#19), tutti si registrano da se' via erpv6_core_dispatch.
    # erpv6.core.library_category si e' spostato in erpv6_core_dispatch
    # (#19): era l'unico pezzo non dispatch-abile (un _inherit strutturale
    # da library_document_ext.py, rimosso) che teneva in piedi il ciclo
    # erpv6_tracking->erpv6_core_engine->erpv6_library->erpv6_tracking
    # scoperto nel #18 -- category_id e' ora un campo NATIVO su
    # erpv6.library.document, dichiarato dentro erpv6_library stesso.
    # QUEL CICLO RESTA APERTO (#19 parcheggiato): erpv6_production ha
    # bisogno reale a tempo di CARICAMENTO DATI (non solo Python) di
    # essere in depends -- circuit_produzione_fasi_data.xml crea un
    # erpv6.production.order diretto, e ref="erpv6_production.
    # phase_relazione_generata"/"kb_prompt_validation_*" in piu' file dati
    # -- quindi resta, e il ciclo via erpv6_library->erpv6_tracking non si
    # scioglie da questo principio.
    #
    # Denis, 30/08/2026, prompt #20: erpv6_omni_bridge RIMOSSO da qui --
    # unico modulo con SOLO uso env['erpv6.omni.bridge'] a runtime dentro
    # _run_ai_analyze (core_node.py), zero campo Many2one/One2many
    # strutturale, zero xmlid referenziato in nessun data XML di questo
    # modulo (verificato riga per riga, non a occhio -- vedi audit #20).
    # Se non installato: KeyError esplicito di Odoo SOLO quando un nodo
    # con process_key='ai_analyze' gira davvero, mai al momento
    # dell'installazione -- comportamento non silenzioso, protetto dalla
    # stessa rete di sicurezza (vincolo @api.constrains del #16 + firma/
    # morsettiera del #4/#5/#6). erpv6_kb/erpv6_validation/erpv6_production/
    # erpv6_sign/erpv6_kaizen restano TUTTI in depends nonostante alcuni
    # abbiano solo env[] nel Python, perche' hanno un _inherit reale, un
    # campo Many2one strutturale, o un xmlid referenziato in un data XML di
    # questo modulo (vedi audit #20 per il dettaglio riga per riga) -- il
    # principio si applica SOLO dove Fase 0 lo conferma pulito su
    # entrambi i fronti (Python E dati), non per intuito.
    # Risultato: erpv6_tracking -> erpv6_core_engine ed erpv6_library ->
    # erpv6_core_engine, mai il contrario, zero ciclo.
    'data': [
        'security/ir.model.access.csv',
        'views/core_node_views.xml',
        'views/core_cross_reference_views.xml',
        'views/core_circuit_run_views.xml',
        'data/circuit_workspace_root_data.xml',
        'data/circuit_six_judges_data.xml',
        'data/circuit_produzione_fasi_data.xml',
        'data/circuit_ipo_prototype_data.xml',
        'data/circuit_color_prototype_data.xml',
        'data/circuit_acquisizione_data.xml',
        'data/circuit_process_spec_data.xml',
    ],
    'installable': True,
    'application': True,
}
