from odoo import api, fields, models


class Erpv6Matrix5sAssessment(models.Model):
    _name = 'erpv6.matrix5s.assessment'
    _description = 'Valutazione Matrix 5S - Motore generico per analisi sprechi'

    res_model = fields.Char(string='Modello Collegato', required=True, index=True)
    res_id = fields.Integer(string='ID Record', required=True, index=True)
    area = fields.Char(
        string='Area/Dimensione Valutata',
        required=True,
        help="Nome libero dell'area valutata (es. 'Strategia e Visione', 'Economico-Finanziaria'). "
             "NON hardcoded: estendibile a dimensioni di altri verticali."
    )
    line_ids = fields.One2many('erpv6.matrix5s.line', 'assessment_id', string='Righe 5S')
    
    name = fields.Char(string='Nome', compute='_compute_name', store=True)

    @api.depends('res_model', 'res_id', 'area')
    def _compute_name(self):
        for rec in self:
            try:
                if rec.res_model and rec.res_id:
                    model = self.env[rec.res_model]
                    record = model.browse(rec.res_id).exists()
                    if record:
                        rec.name = f"5S - {rec.area} - {record.display_name}"
                    else:
                        rec.name = f"5S - {rec.area}"
                else:
                    rec.name = f"5S - {rec.area}"
            except Exception:
                rec.name = f"5S - {rec.area}"
