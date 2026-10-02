# pylint: disable=import-error
"""Estende res.partner con pulsanti DISC (C1b-DISC).

G1: la sezione è visibile solo a admin/chief (via groups sulla view).
G7: pulsante "Rigenera" su persona fisica senza legame business
richiede conferma esplicita (vedi _infer_profile).
"""
from odoo import _, api, fields, models
from odoo.exceptions import UserError


class ResPartner(models.Model):
    _inherit = 'res.partner'

    disc_profile_current_id = fields.Many2one(
        'erpv6.partner.disc_profile',
        string='Profilo DISC corrente',
        compute='_compute_disc_current', store=False)

    disc_profile_version_count = fields.Integer(
        string='Versioni DISC',
        compute='_compute_disc_current', store=False)

    @api.depends()
    def _compute_disc_current(self):
        Profile = self.env['erpv6.partner.disc_profile'].sudo()
        for p in self:
            cur = Profile.search([
                ('partner_id', '=', p.id),
                ('is_current', '=', True),
            ], limit=1)
            p.disc_profile_current_id = cur.id if cur else False
            p.disc_profile_version_count = Profile.search_count([
                ('partner_id', '=', p.id),
            ])

    def action_regenerate_disc_profile(self):
        self.ensure_one()
        Profile = self.env['erpv6.partner.disc_profile'].sudo()
        force = self.env.context.get('disc_force_person', False)
        try:
            new = Profile._regenerate_for_partner(self, force_person=force)
        except UserError as e:
            # G7: persona fisica senza legame → apri dialog conferma
            return {
                'type': 'ir.actions.act_window',
                'name': _('Conferma profilazione'),
                'res_model': 'erpv6.disc.confirm.wizard',
                'view_mode': 'form',
                'target': 'new',
                'context': {
                    'default_partner_id': self.id,
                    'default_message': str(e),
                },
            }
        return {
            'type': 'ir.actions.act_window',
            'res_model': 'erpv6.partner.disc_profile',
            'res_id': new.id,
            'view_mode': 'form',
            'target': 'current',
        }

    def action_delete_disc_profile(self):
        self.ensure_one()
        Profile = self.env['erpv6.partner.disc_profile'].sudo()
        n = Profile.search([('partner_id', '=', self.id)])
        n.unlink()
        return True

    def action_view_disc_profile(self):
        self.ensure_one()
        return {
            'type': 'ir.actions.act_window',
            'res_model': 'erpv6.partner.disc_profile',
            'view_mode': 'list,form',
            'domain': [('partner_id', '=', self.id)],
            'context': {'default_partner_id': self.id},
        }
