{
    "name": "ERPv6 Validation (6 Giudici)",
    "version": "18.0.1.0.0",
    "summary": "Motore generico di validazione multi-round anti-allucinazione",
    "description": """
        Sistema di validazione "6 Giudici" per contenuti critici.
        - 5 Analisti indipendenti analizzano il materiale
        - Sesto Uomo confronta le analisi e rileva discrepanze/allucinazioni
        - Cicli iterativi fino a convergenza o escalation umana
        - Integrazione completa con erpv6_omni_bridge per tracciabilità costi
    """,
    "author": "ERPv6 Team",
    "website": "https://erpv6.it",
    "license": "LGPL-3",
    "depends": [
        "base",
        "mail",
        "erpv6_core",
        "erpv6_omni_bridge"
    ],
    "data": [
        "security/ir.model.access.csv",
        "views/validation_session_views.xml",
        "data/omni_validation_routes.xml",
        "data/validation_retry_cron.xml"
    ],
    "application": True,
    "installable": True,
    "auto_install": False
}
