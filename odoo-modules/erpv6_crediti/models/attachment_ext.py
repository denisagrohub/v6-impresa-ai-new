# pylint: disable=import-error
"""Estende ir.attachment con flag idempotenza watcher crediti."""
from odoo import fields, models


class IrAttachment(models.Model):
    _inherit = 'ir.attachment'

    is_credit_processed = fields.Boolean(
        default=False, index=True,
        help='True se già processato dal watcher crediti '
             '(C-crediti-1b). Evita doppi portfolio.')
