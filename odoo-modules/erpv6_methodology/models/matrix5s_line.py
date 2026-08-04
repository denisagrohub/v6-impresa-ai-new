from odoo import api, fields, models, _
from odoo.exceptions import ValidationError


class Erpv6Matrix5sLine(models.Model):
    _name = 'erpv6.matrix5s.line'
    _description = 'Riga Valutazione 5S'

    assessment_id = fields.Many2one('erpv6.matrix5s.assessment', string='Valutazione', required=True, ondelete='cascade')
    fase = fields.Selection([
        ('1s', '1S - Seiri (Elimina)'),
        ('2s', '2S - Seiton (Ordina)'),
        ('3s', '3S - Seiso (Pulisci)'),
        ('4s', '4S - Seiketsu (Standardizza)'),
        ('5s', '5S - Shitsuke (Sostieni)'),
    ], string='Fase 5S', required=True)
    azione_tipica = fields.Text(string='Azione Tipica della Fase')
    spreco_identificato = fields.Text(string='Spreco Identificato')
    guadagno_potenziale = fields.Text(string='Guadagno Potenziale')

    _sql_constraints = [
        ('unique_assessment_fase', 'UNIQUE(assessment_id, fase)', 
         'Può esistere una sola riga per fase 5S per ogni valutazione.'),
    ]
