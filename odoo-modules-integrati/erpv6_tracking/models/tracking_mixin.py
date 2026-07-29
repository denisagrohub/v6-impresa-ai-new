from odoo import models, fields, api
from odoo.exceptions import UserError


class TrackingMixin(models.AbstractModel):
    _name = 'erpv6.tracking.mixin'
    _description = 'Mixin per Tracciamento Lotti'

    # Campi comuni a tutti i modelli tracciabili
    tracking_lot_ids = fields.Many2many(
        'erpv6.tracking.lot',
        string='Lotti di Tracciamento',
        help='Lotti associati a questo record'
    )
    batch_lot_id = fields.Many2one(
        'erpv6.tracking.lot',
        string='Lotto Batch',
        domain=[('tracking_type', '=', 'batch')],
        help='Lotto batch (contenitore) principale'
    )
    definitive_lot_id = fields.Many2one(
        'erpv6.tracking.lot',
        string='Lotto Definitivo',
        domain=[('tracking_type', '=', 'definitive')],
        help='Lotto definitivo (prodotto finito)'
    )
    tracking_enabled = fields.Boolean(
        'Tracciamento Abilitato',
        default=False,
        help='Abilita il tracciamento lotti per questo record'
    )

    def action_create_batch_lot(self, config_code='product'):
        """Crea un lotto batch per questo record"""
        self.ensure_one()
        config = self.env['erpv6.tracking.config'].get_default_config(
            config_code)
        if not config:
            raise UserError('Configurazione tracciamento non trovata')

        lot = self.env['erpv6.tracking.lot'].create_batch_lot(
            config_id=config.id,
            product_id=self.product_id.id if hasattr(
                self, 'product_id') else None,
            quantity=self.quantity if hasattr(self, 'quantity') else 1.0,
            notes=f'Creato da {self._name} ID {self.id}'
        )

        self.write({
            'batch_lot_id': lot.id,
            'tracking_lot_ids': [(4, lot.id)],
            'tracking_enabled': True,
        })

        return lot

    def action_create_definitive_lot(self, config_code='product'):
        """Crea un lotto definitivo per questo record"""
        self.ensure_one()
        config = self.env['erpv6.tracking.config'].get_default_config(
            config_code)
        if not config:
            raise UserError('Configurazione tracciamento non trovata')

        lot = self.env['erpv6.tracking.lot'].create_definitive_lot(
            config_id=config.id,
            batch_lot_id=self.batch_lot_id.id if self.batch_lot_id else None,
            product_id=self.product_id.id if hasattr(
                self, 'product_id') else None,
            quantity=self.quantity if hasattr(self, 'quantity') else 1.0,
            notes=f'Creato da {self._name} ID {self.id}'
        )

        self.write({
            'definitive_lot_id': lot.id,
            'tracking_lot_ids': [(4, lot.id)],
            'tracking_enabled': True,
        })

        return lot
