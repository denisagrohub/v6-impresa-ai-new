{
    "name": "ERP V6 Parent Client",
    "version": "18.0.1.0.0",
    "category": "Tools",
    "summary": "Client per comunicazione con istanza parent SaaS",
    "description": """
        Modulo da installare SOLO sulle istanze child.
        - Cache locale delle risposte dal parent
        - Gestione TTL e fallback in caso di errore di rete
    """,
    "author": "V6impresa",
    "website": "https://www.v6impresa.it",
    "license": "LGPL-3",
    "depends": [
        "base",
        "erpv6_core"
    ],
    "data": [
        "security/ir.model.access.csv",
        "views/parent_cache_views.xml"
    ],
    "application": False,
    "installable": True,
    "auto_install": False,
    "external_dependencies": {
        'python': ['requests']
    },
}
