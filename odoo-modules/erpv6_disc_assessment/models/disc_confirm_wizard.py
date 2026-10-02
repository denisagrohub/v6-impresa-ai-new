# pylint: disable=import-error
"""Wizard di conferma G7 per profilazione persona fisica.

Quando l'utente clicca "Rigenera profilo DISC" su un partner che è
persona fisica senza legame business, viene chiesta conferma esplicita
(GDPR art. 22).
"""
from odoo import _, fields, models


class Erpv6DiscConfirmWizard(models.TransientModel):
    _name = 'erpv6.disc.confirm.wizard'
    _description = 'Conferma profilazione DISC persona fisica'

    partner_id = fields.Many2one('res.partner', required=True)
    message = fields.Text(readonly=True)

    def action_confirm(self):
        self.ensure_one()
        return self.partner_id.with_context(disc_force_person=True) \
            .action_regenerate_disc_profile()

    def action_cancel(self):
        return {'type': 'ir.actions.act_window_close'}
