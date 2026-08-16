from odoo import models, fields, api
import logging

_logger = logging.getLogger(__name__)

DISCLAIMER_NON_DISPONIBILE = (
    "Certificazione simulata: l'integrazione blockchain reale non è ancora "
    "implementata (nessuna rete, wallet o smart contract collegato in "
    "produzione). Questo record NON è verificabile su nessuna chain."
)


class BlockchainRecord(models.Model):
    _name = 'erpv6.blockchain.record'
    _description = 'Record Blockchain'
    _order = 'create_date desc'

    config_id = fields.Many2one('erpv6.blockchain.config', required=True, domain=[('active', '=', True)])
    document_model = fields.Char(required=True)
    document_id = fields.Integer(required=True)
    document_name = fields.Char()
    document_hash = fields.Char(required=True)
    lot_number = fields.Char()

    tx_hash = fields.Char(readonly=True)
    block_number = fields.Integer(readonly=True)
    gas_used = fields.Integer(readonly=True)
    gas_cost_eth = fields.Float(readonly=True)

    status = fields.Selection([
        ('pending', 'In Attesa'),
        ('confirmed', 'Confermato'),
        ('failed', 'Fallito'),
        ('non_disponibile', 'Non Disponibile (integrazione reale non ancora attiva)'),
    ], default='pending', required=True)

    error_message = fields.Text(readonly=True)
    disclaimer = fields.Text(
        string='Nota di Trasparenza',
        readonly=True,
        help="Visibile quando il record non è una certificazione blockchain "
             "reale e verificabile.",
    )

    def action_certify(self):
        """Richiede la certificazione del documento su blockchain.

        L'integrazione blockchain reale (invio di una transazione a uno
        smart contract) non è ancora implementata: nessuna rete, wallet o
        contratto è collegato in produzione. Il metodo marca onestamente il
        record come non disponibile invece di simulare una conferma, per
        evitare di presentare un documento come certificato quando non lo è.
        """
        self.ensure_one()
        self.write({
            'status': 'non_disponibile',
            'tx_hash': False,
            'disclaimer': DISCLAIMER_NON_DISPONIBILE,
        })
        return True
