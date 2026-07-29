from odoo import models, fields

class SendFunnelWizard(models.TransientModel):
    _name = 'fenice.send.funnel.wizard'
    _description = 'Wizard Invio Funnel Manuale'
    lead_ids = fields.Many2many('crm.lead', string='Lead')
    step_number = fields.Selection([('1','Email 1'),('2','Email 2'),('3','Email 3'),('4','Email 4'),('5','Email 5')], string='Step Email', required=True)
    def action_send(self):
        for lead in self.lead_ids: lead._send_funnel_email(int(self.step_number))
        return {'type': 'ir.actions.act_window_close'}
