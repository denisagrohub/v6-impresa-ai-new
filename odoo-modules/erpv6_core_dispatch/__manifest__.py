{
    'name': 'ERP V6 - Core Dispatch',
    'version': '18.0.1.0.0',
    'category': 'V6 Impresa AI',
    'summary': 'Registro condiviso di Motori (SAFE_PROCESSES) senza dipendenze da moduli dominio',
    'description': """
        Denis, 30/08/2026, prompt #15 (§O dell'addendum): erpv6_core_engine
        dipende oggi da quasi tutti i moduli dominio (erpv6_tracking,
        erpv6_sign, erpv6_library, erpv6_kaizen, ...) solo per poter
        chiamare i loro modelli dentro i propri _run_*. Questo crea un ciclo
        quando un modulo dominio deve a sua volta dipendere da
        erpv6_core_engine per una vera sostituzione (bloccato sul prompt
        #13, erpv6_tracking).

        erpv6_core_dispatch e' minuscolo apposta, zero dipendenze da moduli
        dominio: ospita solo un registro condiviso (SAFE_PROCESSES,
        popolato da register_process()) a cui i moduli dominio si
        registrano al proprio caricamento -- erpv6_core_engine legge da
        qui invece di importare/dipendere direttamente da ognuno.

        Prompt #19: ospita anche erpv6.core.library_category (catalogo
        condiviso, non logica di esecuzione) -- spostato qui da
        erpv6_core_engine perche' erpv6_library possa dichiarare
        category_id come campo NATIVO su erpv6.library.document, invece
        che tramite _inherit da erpv6_core_engine (l'unico pezzo non
        dispatch-abile che teneva in piedi il ciclo scoperto nel #18).
    """,
    'author': 'V6 Impresa AI',
    'license': 'LGPL-3',
    'depends': ['base'],
    'data': [
        'security/ir.model.access.csv',
    ],
    'installable': True,
    'application': False,
}
