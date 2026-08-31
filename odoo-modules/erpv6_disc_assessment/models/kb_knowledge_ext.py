from odoo import fields, models


class Erpv6KbDiscAssessmentExt(models.Model):
    """Estende erpv6.kb (definito in erpv6_kb) in modo ADDITIVO -- selection_add,
    MAI un file di erpv6_kb toccato (Denis, 30/08/2026, prompt #21).
    KB_TYPE_SELECTION e' statica (non un Selection dinamico come process_key,
    corretto per quello nel prompt #15) -- per aggiungere un valore nuovo
    senza modificare il modulo esistente, questo e' il meccanismo Odoo
    sanzionato per farlo."""
    _inherit = 'erpv6.kb'

    kb_type = fields.Selection(
        selection_add=[('disc_assessment', 'DISC Assessment (dipendenti)')],
        ondelete={'disc_assessment': 'cascade'},
    )


class Erpv6KbCategoryDiscAssessmentExt(models.Model):
    """erpv6.kb.category ha un campo kb_type SEPARATO (stessa lista statica
    KB_TYPE_SELECTION, ma un'altra Selection sulla classe) -- va esteso
    anche qui, altrimenti la categoria dedicata non potrebbe usare
    kb_type='disc_assessment'. Trovato verificando, non presunto."""
    _inherit = 'erpv6.kb.category'

    kb_type = fields.Selection(
        selection_add=[('disc_assessment', 'DISC Assessment (dipendenti)')],
        ondelete={'disc_assessment': 'cascade'},
    )
