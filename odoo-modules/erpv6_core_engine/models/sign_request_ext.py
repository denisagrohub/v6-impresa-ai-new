from odoo import models


class Erpv6SignRequestCoreEngineExt(models.Model):
    """Estende erpv6.sign.request (definito in erpv6_sign) per chiudere
    l'esecuzione del Motore Esterno collegata quando arriva DAVVERO il
    completamento della firma -- non quando l'invio ritorna. Stesso
    pattern gia' in uso in validation_session_ext.py su erpv6_validation:
    erpv6_core_engine avvolge/estende, non riscrive."""
    _inherit = 'erpv6.sign.request'

    def action_check_status(self):
        # action_check_status() e' il punto di sincronizzazione condiviso
        # (Denis, 29/08/2026): lo chiamano sia il pulsante 'Verifica Stato'
        # manuale sia il webhook Documenso su DOCUMENT_COMPLETED (vedi
        # odoo-modules/erpv6_sign/controllers/main.py) -- estenderlo qui
        # copre entrambi i percorsi con un solo hook, nessuna duplicazione.
        result = super().action_check_status()
        for rec in self:
            if rec.status != 'signed':
                continue
            executions = self.env['erpv6.core.node.execution'].search([
                ('sign_request_id', '=', rec.id), ('status', '=', 'in_attesa_esterna'),
            ])
            if executions:
                executions.write({
                    'status': 'done',
                    'output_data': {
                        'success': True, 'completed': True, 'sign_request_id': rec.id,
                        'signature_hash': rec.signature_hash or False,
                    },
                })
        return result
