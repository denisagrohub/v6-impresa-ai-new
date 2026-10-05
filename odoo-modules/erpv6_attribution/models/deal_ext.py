# pylint: disable=import-error
"""Estende erpv6.deal con link al portfolio di origine.

05/10/2026 (C-attribution-1c): il deal NON copia i campi attribuzione
(brought_by, co_segnalatori, referral). Il portfolio resta la fonte
di verita'. Il deal linka al portfolio e legge da li'.
"""
from odoo import fields, models


class Erpv6Deal(models.Model):
    _inherit = 'erpv6.deal'

    source_portfolio_id = fields.Many2one(
        'erpv6.credit.portfolio',
        string='Portfolio di origine',
        ondelete='set null', index=True,
        help='Portfolio crediti da cui e\' nato questo deal. '
             'L\'attribuzione (portatore, co-segnalatori, referral) '
             'si legge dal portfolio, non e\' copiata qui.')
