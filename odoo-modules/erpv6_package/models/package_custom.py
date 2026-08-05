from odoo import api, fields, models

class Erpv6PackageCustom(models.Model):
    _name = 'erpv6.package.custom'
    _description = 'Pacchetto personalizzato'

    name = fields.Char(required=True)
    partner_id = fields.Many2one('res.partner', required=True)
    module_ids = fields.Many2many('erpv6.package.module')
    total_price = fields.Monetary(compute='_compute_total', store=True)
    currency_id = fields.Many2one('res.currency', default=lambda self: self.env.company.currency_id)
    discount = fields.Float(default=0.0)
    final_price = fields.Monetary(compute='_compute_final', store=True)
    status = fields.Selection([
        ('draft', 'Bozza'),
        ('confirmed', 'Confermato'),
        ('sold', 'Venduto'),
    ], default='draft')
    
    # TASK 1 - Campi aggregati per intervista e generazione documento
    aggregated_interview = fields.Text(
        string='Intervista Aggregata',
        compute='_compute_aggregated_interview',
        store=True,
        help='Unione delle domande intervista di tutti i moduli selezionati (deduplicate)'
    )
    aggregated_required_fields = fields.Json(
        string='Campi Richiesti Aggregati',
        compute='_compute_aggregated_required_fields',
        store=True,
        help='Merge degli JSON Schema required_fields di tutti i moduli selezionati'
    )
    document_style = fields.Selection([
        ('minimal', 'Minimal'),
        ('strafigo', 'Strafigo'),
    ], string='Stile Documento', default='minimal', required=True,
        help='Stile Typst applicato all\'intero documento finale, non per singola sezione'
    )

    @api.depends('module_ids')
    def _compute_total(self):
        for rec in self:
            rec.total_price = sum(rec.module_ids.mapped('price'))

    @api.depends('total_price', 'discount')
    def _compute_final(self):
        for rec in self:
            rec.final_price = rec.total_price * (1 - rec.discount / 100)
    
    @api.depends('module_ids', 'module_ids.interview_questions')
    def _compute_aggregated_interview(self):
        """Unisce le interview_questions di tutti i moduli, deduplicando per testo identico."""
        for rec in self:
            questions_set = set()
            for module in rec.module_ids:
                if module.interview_questions:
                    for line in module.interview_questions.strip().split('\n'):
                        line = line.strip()
                        if line:
                            questions_set.add(line)
            rec.aggregated_interview = '\n'.join(sorted(questions_set))
    
    @api.depends('module_ids', 'module_ids.required_fields')
    def _compute_aggregated_required_fields(self):
        """Merge degli required_fields JSON di tutti i moduli selezionati."""
        for rec in self:
            merged = {}
            for module in rec.module_ids:
                if module.required_fields:
                    # Merge dei dizionari (se ci sono chiavi duplicate, l'ultimo sovrascrive)
                    merged.update(module.required_fields)
            rec.aggregated_required_fields = merged
