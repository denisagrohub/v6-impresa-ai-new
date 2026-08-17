from odoo import fields, models


class Erpv6ProductionEvent(models.Model):
    _name = 'erpv6.production.event'
    _description = 'Interazione o trigger che ha fatto avanzare (o tentato di avanzare) una produzione'
    _order = 'create_date desc'

    order_id = fields.Many2one('erpv6.production.order', string='Produzione', required=True, ondelete='cascade', index=True)
    event_type = fields.Selection([
        ('interazione_consulente', 'Interazione consulente'),
        ('cron_automatico', 'Cron automatico'),
        ('documento_generato', 'Documento generato'),
        ('risorsa_assegnata', 'Risorsa assegnata'),
    ], required=True, default='interazione_consulente')
    description = fields.Text()
    triggered_by = fields.Many2one('res.users', string='Attivato da', default=lambda self: self.env.user)

    phase_before_id = fields.Many2one('erpv6.production.phase', string='Fase Prima')
    phase_after_id = fields.Many2one('erpv6.production.phase', string='Fase Dopo')

    decision_method = fields.Selection([
        ('deterministico', 'Deterministico'),
        ('ai', 'AI'),
    ], string='Metodo Decisione')

    # Collegamenti di audit - valorizzati solo dalla logica reale (Fase 2/3),
    # nullable già da ora per non dover fare una migrazione dopo.
    omni_call_log_id = fields.Many2one(
        'erpv6.omni.call.log', string='Log Chiamata AI',
        help='Valorizzato se questo evento ha coinvolto una chiamata AI (execute_ai_task)'
    )
    kb_request_id = fields.Many2one(
        'erpv6.kb.request', string='Richiesta KB',
        help='Valorizzato se erpv6.kb.engine.process() non ha trovato una KB specifica ed e\' stata creata un\'escalation admin'
    )
    validation_session_id = fields.Many2one(
        'erpv6.validation.session', string='Sessione Validazione (6 Giudici)',
        help='Valorizzato se l\'output di questo evento e\' stato sottoposto alla validazione 6 Giudici'
    )
