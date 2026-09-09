# -*- coding: utf-8 -*-
from odoo import api, fields, models


class SaleOrder(models.Model):
    """Estende sale.order (09/09/2026, pagamento reale report Win-Win,
    seguito audit "Punto Zero") con il link al report Win-Win collegato -
    serve SOLO al template portale (views/sale_order_portal_redirect.xml)
    per il redirect automatico dopo pagamento riuscito, richiesto da
    Denis. Nessuna logica di business qui, solo un lookup."""
    _inherit = 'sale.order'

    winwin_report_url = fields.Char(compute='_compute_winwin_report_url')

    @api.depends()  # nessun campo di sale.order da cui dipende davvero - il dato vive su
    # erpv6.winwin.report.token (nessuna relazione inversa dichiarata), va ricalcolato
    # ad ogni lettura (non stored) invece di una dipendenza finta su un campo a caso.
    def _compute_winwin_report_url(self):
        Token = self.env['erpv6.winwin.report.token'].sudo()
        for order in self:
            token = Token.search([('sale_order_id', '=', order.id)], limit=1)
            order.winwin_report_url = token._report_url() if token else False
