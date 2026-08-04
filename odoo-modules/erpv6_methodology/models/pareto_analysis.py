from odoo import api, fields, models


class Erpv6ParetoAnalysis(models.Model):
    _name = 'erpv6.pareto.analysis'
    _description = 'Analisi di Pareto - Motore generico 80/20'

    res_model = fields.Char(string='Modello Collegato', required=True, index=True)
    res_id = fields.Integer(string='ID Record', required=True, index=True)
    name = fields.Char(string='Nome Analisi', required=True)
    item_ids = fields.One2many('erpv6.pareto.item', 'analysis_id', string='Elementi')
    notes = fields.Text(string='Note')
    
    total_score = fields.Integer(compute='_compute_totals', store=True)
    priority_count = fields.Integer(compute='_compute_totals', store=True, string='Elementi Prioritari')

    @api.depends('item_ids.punteggio', 'item_ids.is_priority')
    def _compute_totals(self):
        for analysis in self:
            analysis.total_score = sum(item.punteggio for item in analysis.item_ids)
            analysis.priority_count = sum(1 for item in analysis.item_ids if item.is_priority)

    def compute_pareto(self):
        """
        Ordina gli item per punteggio decrescente, calcola la percentuale cumulata sul totale,
        e marca is_priority=True sugli item che rientrano cumulativamente nell'80% dell'effetto totale.
        """
        for analysis in self:
            items = analysis.item_ids.sorted(key=lambda x: x.punteggio, reverse=True)
            total = sum(item.punteggio for item in items)
            cumulative = 0.0
            for item in items:
                if total > 0:
                    cumulative += item.punteggio
                    item.cumulata_pct = (cumulative / total) * 100
                    # is_priority sarà calcolato dal campo compute sull'item
                else:
                    item.cumulata_pct = 0.0
        return True
