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
        """Crea un lotto batch per questo record -- chiama DAVVERO il nodo
        AEOSv6 (erpv6_tracking.node_crea_lotto_batch, process_key=
        'create_tracking_lot') invece di duplicare la chiamata a
        erpv6.tracking.lot.create_batch_lot() (Denis, 30/08/2026, prompt
        #17, sblocca §O -- stesso principio gia' applicato a erpv6_color
        nel prompt #8: il vecchio percorso chiama il nuovo, non lo
        duplica). batch_lot_id/tracking_lot_ids/tracking_enabled restano
        scritti qui esplicitamente (non via output_binding_*): sono TRE
        scritture coordinate su questo stesso record, una delle quali e' un
        comando Many2many -- output_binding_* scrive un solo campo scalare
        per costruzione, non il caso giusto qui."""
        self.ensure_one()
        config = self.env['erpv6.tracking.config'].get_default_config(
            config_code)
        if not config:
            raise UserError('Configurazione tracciamento non trovata')

        # create_batch_lot() non accetta product_id (bug pre-esistente: mai
        # stato nella firma del metodo, vedi tracking_lot.py) - passarlo
        # come qui prima faceva sempre TypeError, per qualunque modello
        # ereditasse questo mixin, mai scoperto perche' mai chiamato prima.
        # Invariato da questa migrazione: non toccato, fuori scope.
        node = self.env.ref('erpv6_tracking.node_crea_lotto_batch')
        execution = node.run_process({
            'lot_type': 'batch',
            'config_id': config.id,
            'quantity': self.quantity if hasattr(self, 'quantity') else 1.0,
            'notes': f'Creato da {self._name} ID {self.id}',
        })
        lot = self.env['erpv6.tracking.lot'].browse(execution.output_data['lot_id'])

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

        # Denis, 29/08/2026: stesso bug del metodo gemello sopra
        # (action_create_batch_lot) -- create_definitive_lot() non ha mai
        # accettato product_id, non era stato corretto qui quando lo si e'
        # tolto dall'altro metodo. TypeError garantito se mai chiamato.
        lot = self.env['erpv6.tracking.lot'].create_definitive_lot(
            config_id=config.id,
            batch_lot_id=self.batch_lot_id.id if self.batch_lot_id else None,
            quantity=self.quantity if hasattr(self, 'quantity') else 1.0,
            notes=f'Creato da {self._name} ID {self.id}'
        )

        self.write({
            'definitive_lot_id': lot.id,
            'tracking_lot_ids': [(4, lot.id)],
            'tracking_enabled': True,
        })

        return lot
