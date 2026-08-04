from odoo import api, fields, models, _
from odoo.exceptions import ValidationError


class Erpv6ParetoItem(models.Model):
    _name = 'erpv6.pareto.item'
    _description = 'Elemento Analisi Pareto'
    _order = 'punteggio DESC, id'

    analysis_id = fields.Many2one('erpv6.pareto.analysis', string='Analisi', required=True, ondelete='cascade')
    name = fields.Char(string='Problema Identificato', required=True)
    frequenza = fields.Integer(string='Frequenza (1-5)', required=True)
    impatto = fields.Integer(string='Impatto (1-5)', required=True)
    punteggio = fields.Integer(string='Punteggio', compute='_compute_punteggio', store=True)
    cumulata_pct = fields.Float(string='Percentuale Cumulata', compute='_compute_cumulata', store=True)
    is_priority = fields.Boolean(string='Prioritario (top 20%)', compute='_compute_is_priority', store=True)

    @api.constrains('frequenza', 'impatto')
    def _check_frequenza_impatto_range(self):
        for rec in self:
            if not (1 <= rec.frequenza <= 5):
                raise ValidationError(_("La frequenza deve essere compresa tra 1 e 5."))
            if not (1 <= rec.impatto <= 5):
                raise ValidationError(_("L'impatto deve essere compreso tra 1 e 5."))

    @api.depends('frequenza', 'impatto')
    def _compute_punteggio(self):
        for item in self:
            item.punteggio = item.frequenza * item.impatto

    @api.depends('punteggio', 'analysis_id.item_ids.punteggio')
    def _compute_cumulata(self):
        """
        Calcola la percentuale cumulata ordinando gli item per punteggio decrescente.
        """
        for item in self:
            if not item.analysis_id:
                item.cumulata_pct = 0.0
                continue
            items_sorted = item.analysis_id.item_ids.sorted(key=lambda x: x.punteggio, reverse=True)
            total = sum(i.punteggio for i in items_sorted)
            cumulative = 0.0
            found = False
            for i in items_sorted:
                if total > 0:
                    cumulative += i.punteggio
                    if i.id == item.id:
                        item.cumulata_pct = (cumulative / total) * 100
                        found = True
                        break
                else:
                    item.cumulata_pct = 0.0
                    found = True
                    break
            if not found:
                item.cumulata_pct = 0.0

    @api.depends('cumulata_pct')
    def _compute_is_priority(self):
        """
        Marca come prioritari gli item che rientrano cumulativamente nell'80% dell'effetto totale.
        """
        for item in self:
            item.is_priority = item.cumulata_pct <= 80.0
