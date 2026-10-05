# pylint: disable=import-error
"""Estende erpv6.credit.portfolio con attribuzione + split proposto."""
import json
import logging

from odoo import api, fields, models

_logger = logging.getLogger(__name__)


class Erpv6CreditPortfolio(models.Model):
    _inherit = 'erpv6.credit.portfolio'

    brought_by_partner_id = fields.Many2one(
        'res.partner', string='Portatore', index=True,
        help='Chi ha portato il cedente. Se vuoto, eredita da '
             'cedente_id.brought_by_default_partner_id.')

    referral_id = fields.Many2one(
        'erpv6.referral', string='Referral collegato',
        help='Accordo referral firmato, se esiste.')

    co_segnalatore_ids = fields.One2many(
        'erpv6.attribution.co_signer', 'portfolio_id',
        string='Co-segnalatori')

    co_segnalatore_count = fields.Integer(
        string='N. co-segnalatori',
        compute='_compute_co_segnalatore_count')

    attribution_confirmed = fields.Boolean(
        default=False, readonly=True,
        help='True dopo conferma del wizard (task 1b).')

    def _compute_co_segnalatore_count(self):
        for p in self:
            p.co_segnalatore_count = len(p.co_segnalatore_ids)

    def action_open_attribution_wizard(self):
        """Apre il wizard di conferma attribuzione."""
        self.ensure_one()
        return {
            'type': 'ir.actions.act_window',
            'res_model': 'erpv6.attribution.wizard',
            'view_mode': 'form',
            'target': 'new',
            'context': {'default_portfolio_id': self.id},
        }

    @api.model
    def _get_operativi(self, relation):
        """Estrai consulenti operativi dal progetto.

        Priorita' 1: split attivo esistente (payload_json.beneficiari).
        Priorita' 2: access_user_ids del progetto.
        """
        if not relation:
            return self.env['res.partner']
        Partner = self.env['res.partner'].sudo()

        if relation.active_split_version_id and \
                relation.active_split_version_id.payload_json:
            try:
                payload = json.loads(
                    relation.active_split_version_id.payload_json or '{}')
                bens = payload.get('beneficiari') or []
                partners = []
                for b in bens:
                    if b.get('tipo') == 'consulente' and b.get('res_partner_id'):
                        p = Partner.browse(b['res_partner_id'])
                        if p.exists():
                            partners.append(p.id)
                if partners:
                    return Partner.browse(partners)
            except Exception as e:
                _logger.warning(
                    'attribution._get_operativi: payload parse fail: %s', e)

        # Fallback: access_user_ids
        return relation.access_user_ids.mapped('partner_id').filtered(
            lambda p: p.exists())

    @api.model
    def _propose_split(self, portfolio):
        """Calcola split proposto leggendo config params.

        Ritorna dict con portatore, operativi, v6, co-segnalatori.
        Il consulente puo' modificare prima di confermare: e' una
        proposta, non un obbligo.
        """
        params = self.env['ir.config_parameter'].sudo()
        p_port = float(params.get_param('credit.split.default_portatore', '30'))
        p_v6 = float(params.get_param('credit.split.default_v6', '10'))
        p_op_tot = float(params.get_param('credit.split.default_operativo', '60'))
        p_co = float(params.get_param('credit.split.default_co_segnalatore', '3'))

        portatore = (portfolio.brought_by_partner_id
                     or (portfolio.cedente_id.brought_by_default_partner_id
                         if portfolio.cedente_id else False))
        operativi = self._get_operativi(portfolio.relation_id)
        co_signers = portfolio.co_segnalatore_ids

        n_op = max(len(operativi), 1)
        p_op_ciascuno = p_op_tot / n_op
        p_v6_netto = p_v6 - (len(co_signers) * p_co)

        return {
            'portatore': {
                'partner_id': portatore.id if portatore else False,
                'name': portatore.name if portatore else '(non assegnato)',
                'pct': p_port,
            },
            'v6_struttura': {
                'pct': p_v6_netto,
                'pct_lordo': p_v6,
                'co_signer_detratti': len(co_signers) * p_co,
            },
            'operativi': [
                {'partner_id': op.id, 'name': op.name, 'pct': p_op_ciascuno}
                for op in operativi
            ],
            'co_segnalatori': [
                {'partner_id': cs.partner_id.id,
                 'name': cs.partner_id.name, 'pct': cs.pct}
                for cs in co_signers
            ],
            'totale': (p_port + p_op_ciascuno * n_op
                       + p_v6_netto + len(co_signers) * p_co),
            'note': ('Proposta da config (30/10/60/3). Contrattuale: '
                     'modifica prima di confermare. V6 10%% e\' il pool '
                     'per co-segnalatori, crescera\' in futuro.'),
        }
