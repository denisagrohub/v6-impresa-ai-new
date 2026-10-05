# pylint: disable=import-error
"""Estende erpv6.tracking.relation con O2M processi certificati."""
from odoo import api, fields, models


class Erpv6TrackingRelation(models.Model):
    _inherit = 'erpv6.tracking.relation'

    certificate_process_ids = fields.One2many(
        'erpv6.certificate.process', 'relation_id',
        string='Processi certificati')

    certificate_process_active_count = fields.Integer(
        string='Processi attivi',
        compute='_compute_certificate_process_active_count')

    @api.depends('certificate_process_ids.is_active')
    def _compute_certificate_process_active_count(self):
        for r in self:
            r.certificate_process_active_count = len(
                r.certificate_process_ids.filtered('is_active'))
