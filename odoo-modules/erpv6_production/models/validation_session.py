from odoo import models


class Erpv6ValidationSession(models.Model):
    _inherit = 'erpv6.validation.session'

    def action_human_approve(self):
        result = super().action_human_approve()
        for session in self:
            if session.res_model == 'erpv6.production.order':
                order = self.env['erpv6.production.order'].browse(session.res_id)
                if order.exists():
                    order.evaluate_and_advance(trigger='validation_approved')
        return result
