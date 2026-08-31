from odoo import api, fields, models


class Erpv6CoreNodeExecution(models.Model):
    _name = 'erpv6.core.node.execution'
    _description = 'Esecuzione reale di un Nodo Motore (Input/Processo/Output)'
    _order = 'create_date desc'

    node_id = fields.Many2one('erpv6.core.node', required=True, ondelete='cascade')
    input_data = fields.Json(string='Input')
    output_data = fields.Json(string='Output')
    # Denis, 30/08/2026, morsettiera in modalita' SOLO SEGNALAZIONE (stesso
    # pattern di erpv6.core.kb_link.format_mismatch): confronta gli input
    # obbligatorio=True di erpv6.core.process.input_spec per il process_key
    # di questo nodo contro le chiavi presenti in input_data -- nessun
    # raise, nessun cambio di status, run_process()/run_circuit() invariati.
    # Calcolato da input_data GIA' ARRICCHITO (dopo upstream_outputs/
    # linked_outputs, che run_process() aggiunge PRIMA di create()) invece
    # che dal dict grezzo pre-arricchimento -- scelta deliberata, non un
    # compromesso: l'arricchimento aggiunge SOLO le due chiavi sintetiche
    # 'upstream_outputs'/'linked_outputs', non tocca mai le chiavi originali
    # (nessuna delle 39 righe obbligatorio=True oggi si chiama cosi'), quindi
    # per qualunque input_key nominato reale il risultato e' identico a
    # leggere il dict grezzo. Un vero compute Odoo (@api.depends, store=True)
    # e' piu' idiomatico di un'iniezione manuale dentro run_process() per un
    # campo puramente diagnostico, stesso principio di format_mismatch.
    firma_soddisfatta = fields.Boolean(
        compute='_compute_firma_soddisfatta', store=True,
        help="True se tutte le chiavi obbligatorio=True della firma (erpv6.core.process."
             "input_spec per il process_key di questo nodo) sono presenti e valorizzate in "
             "input_data. Solo diagnostico -- non blocca nulla.")
    firma_mancanti = fields.Char(
        compute='_compute_firma_soddisfatta', store=True,
        help="Chiavi obbligatorie assenti/vuote da input_data, se presenti (elenco separato da virgola).")

    @api.depends('input_data', 'node_id.process_key')
    def _compute_firma_soddisfatta(self):
        InputSpec = self.env['erpv6.core.process.input_spec']
        for rec in self:
            process_key = rec.node_id.process_key
            if not process_key:
                rec.firma_soddisfatta = True
                rec.firma_mancanti = False
                continue
            required_keys = InputSpec.search([
                ('process_key', '=', process_key), ('obbligatorio', '=', True),
            ]).mapped('input_key')
            data = rec.input_data or {}
            mancanti = [k for k in required_keys if not data.get(k)]
            rec.firma_soddisfatta = not mancanti
            rec.firma_mancanti = ', '.join(mancanti) if mancanti else False
    status = fields.Selection([
        ('running', 'In esecuzione'), ('done', 'Completato'), ('failed', 'Fallito'),
        # Denis, 29/08/2026, decomposizione erpv6_sign: un Motore Esterno
        # (es. invio firma via Documenso) non finisce quando la chiamata
        # HTTP ritorna -- l'invio e' solo l'inizio, il completamento vero
        # arriva dopo (webhook o poll). 'done' qui mentirebbe.
        ('in_attesa_esterna', 'In attesa di completamento esterno'),
    ], default='running')
    error_message = fields.Text()
    # Solo per Motori Esterni asincroni (Denis, 29/08/2026): riferimento alla
    # richiesta di firma reale, cosi' il webhook Documenso (in erpv6_sign,
    # che NON dipende da questo modulo) puo' essere esteso qui via _inherit
    # per chiudere l'esecuzione quando arriva davvero il completamento --
    # vedi models/sign_request_ext.py.
    sign_request_id = fields.Many2one('erpv6.sign.request', string='Richiesta di firma collegata')
