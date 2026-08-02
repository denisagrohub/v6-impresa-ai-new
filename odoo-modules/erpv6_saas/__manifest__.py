{
    "name": "ERP V6 SaaS",
    "version": "18.0.1.0.0",
    "category": "Tools",
    "summary": "Gestione tenant SaaS e verticali per erpv6",
    "description": """
        Modulo per la gestione dei tenant SaaS e del catalogo verticali.
        - Gestione tenant con stato sottoscrizione
        - Catalogo verticali con lista moduli associati
        - Cron per sincronizzazione stato sottoscrizioni
    """,
    "author": "V6impresa",
    "website": "https://www.v6impresa.it",
    "license": "LGPL-3",
    "depends": [
        "base",
        "mail",
        "erpv6_core",
        "erpv6_api_gateway",
        "erpv6_kb"
    ],
    "data": [
        "security/ir.model.access.csv",
        "views/saas_tenant_views.xml",
        "views/vertical_catalog_views.xml",
        "data/cron_data.xml"
    ],
    "application": True,
    "installable": True,
    "auto_install": False
}
