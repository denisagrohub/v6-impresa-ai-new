{
    "name": "ERP V6 Product Pricing",
    "version": "18.0.1.0.0",
    "category": "Sales",
    "summary": "Quota di setup una tantum e commissione variabile sui prodotti",
    "description": """
Motore generico a-settoriale per prodotti con pricing misto.

- Quota di setup una tantum (x_setup_fee), separata dal prezzo di vendita ricorrente
- Commissione percentuale variabile opzionale (x_commission_percentage), es. per offerte con fee calcolata su volumi/vendite online

Non installato: sale_subscription (Enterprise) — questo modulo copre il caso d'uso minimo senza dipendere da moduli Enterprise.
    """,
    "author": "V6impresa",
    "website": "https://www.v6impresa.it",
    "license": "LGPL-3",
    "depends": [
        "product",
    ],
    "data": [
        "views/product_template_views.xml",
    ],
    "application": False,
    "installable": True,
    "auto_install": False,
}
