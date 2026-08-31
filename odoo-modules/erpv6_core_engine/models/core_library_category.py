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
        "libero indovinato a runtime."
    )

    name = fields.Char(required=True, index=True)
    active = fields.Boolean(default=True)

    _sql_constraints = [
        ('name_unique', 'unique(name)', "Nome categoria libreria univoco!"),
    ]
