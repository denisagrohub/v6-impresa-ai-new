{
    "name": "ERP V6 Setup Wizard",
    "version": "18.0.1.0.0",
    "category": "Tools",
    "summary": "Wizard di setup iniziale per istanze child SaaS",
    "description": """
        Modulo da installare SOLO sulle istanze child.
        - Wizard guidato per configurazione verticale
        - Installazione automatica moduli in base al verticale scelto
    """,
    "author": "V6impresa",
    "website": "https://www.v6impresa.it",
    "license": "LGPL-3",
    "depends": [
        "base",
        "erpv6_core"
    ],
    "data": [
        "views/setup_wizard_views.xml",
        "views/menu_views.xml"
    ],
    "application": True,
    "installable": True,
    "auto_install": False
}
