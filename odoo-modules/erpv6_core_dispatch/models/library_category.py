from odoo import fields, models


class Erpv6CoreLibraryCategory(models.Model):
    _name = 'erpv6.core.library_category'
    _description = (
        "Categoria di libreria dichiarata da un circuito (Denis, 29/08/2026: "
        "'il circuito creazione business plan deve dichiarare output con "
        "etichetta business plan'). Estende in modo ADDITIVO "
        "erpv6.library.document.category (Selection chiusa nel codice, letta "
        "come stringa da 4 moduli diversi -- erpv6_agent/marketing/production/"
        "kaizen -- mai toccata qui) con un catalogo vero, che i circuiti "
        "possono far crescere dichiarando nuove etichette, non un valore "
        "libero indovinato a runtime.\n\n"
        "Denis, 30/08/2026, prompt #19: spostato qui da erpv6_core_engine -- "
        "e' un catalogo condiviso, non logica di esecuzione, e vivere in "
        "erpv6_core_dispatch (neutro, senza dipendenze da moduli dominio) "
        "permette a erpv6_library di dichiarare category_id come campo "
        "NATIVO su erpv6.library.document invece che tramite _inherit da "
        "erpv6_core_engine -- l'estensione di classe era l'unico pezzo non "
        "dispatch-abile che teneva in piedi il ciclo erpv6_tracking-> "
        "erpv6_core_engine->erpv6_library->erpv6_tracking (scoperto nel "
        "prompt #18)."
    )

    name = fields.Char(required=True, index=True)
    active = fields.Boolean(default=True)

    _sql_constraints = [
        ('name_unique', 'unique(name)', "Nome categoria libreria univoco!"),
    ]
