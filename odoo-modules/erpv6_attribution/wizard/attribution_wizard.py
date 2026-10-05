# pylint: disable=import-error
"""Wizard di conferma attribuzione portfolio crediti.

4 step (in un'unica pagina):
  1. Verifica estrazione righe
  2. Attribuzione portatore (+ referral)
  3. Co-segnalatori (righe editabili)
  4. Anteprima split proposto (JSON)

A conferma: scrive i campi sul portfolio e setta
attribution_confirmed = True. Non scrive su revenue.split.version
(quello e' compito di C-attribution-1c / futura estensione).
"""
import json
import logging

from odoo import api, fields, models
from odoo.exceptions import UserError

_logger = logging.getLogger(__name__)


class Erpv6AttributionWizardCoSigner(models.TransientModel):
    _name = 'erpv6.attribution.wizard.co_signer'
    _description = 'Co-segnalatore (riga wizard)'

    wizard_id = fields.Many2one(
        'erpv6.attribution.wizard', required=True, ondelete='cascade')
    partner_id = fields.Many2one(
        'res.partner', string='Partner', required=True)
    pct = fields.Float(
        string='% della fee V6', default=3.0, digits=(5, 2))
    notes = fields.Char(string='Motivo')


class Erpv6AttributionWizard(models.TransientModel):
    _name = 'erpv6.attribution.wizard'
    _description = 'Conferma attribuzione portfolio crediti'

    portfolio_id = fields.Many2one(
        'erpv6.credit.portfolio', string='Portfolio',
        required=True, ondelete='cascade')

    # Step 1
    verificato_righe = fields.Boolean(
        string='Ho verificato le righe',
        help='Conferma di aver controllato i dati estratti dal PDF.')
    note_verifica = fields.Text(string='Note verifica')

    # Step 2
    # 05/10/2026 (C-attribution-1b): NON required a livello ORM
    # (altrimenti il create() fallisce quando default_get restituisce
    # vuoto, es. cedente senza portatore di default). L'obbligatorieta'
    # e' verificata in action_confirm.
    brought_by_partner_id = fields.Many2one(
        'res.partner', string='Portatore')
    referral_id = fields.Many2one(
        'erpv6.referral', string='Referral collegato')

    # Step 3
    co_signer_ids = fields.One2many(
        'erpv6.attribution.wizard.co_signer', 'wizard_id',
        string='Co-segnalatori')

    # Step 4
    split_preview_json = fields.Text(
        string='Split proposto (JSON)', readonly=True)

    @api.model
    def default_get(self, fields_list):
        res = super().default_get(fields_list)
        pid = self.env.context.get('default_portfolio_id')
        if not pid:
            return res
        p = self.env['erpv6.credit.portfolio'].sudo().browse(pid)
        if not p.exists():
            return res

        # Portatore: portfolio -> cedente default -> vuoto
        portatore = (p.brought_by_partner_id
                     or (p.cedente_id.brought_by_default_partner_id
                         if p.cedente_id else False))

        # Co-signer copiati dal portfolio
        lines = [(0, 0, {
            'partner_id': cs.partner_id.id,
            'pct': cs.pct,
            'notes': cs.notes,
        }) for cs in p.co_segnalatore_ids]

        # Preview split
        try:
            split = self.env['erpv6.credit.portfolio']._propose_split(p)
            preview = json.dumps(split, indent=2, default=str)
        except Exception as e:
            _logger.warning('attribution wizard: _propose_split fail: %s', e)
            preview = '{"error": "%s"}' % str(e)

        res.update({
            'portfolio_id': p.id,
            'brought_by_partner_id': portatore.id if portatore else False,
            'referral_id': p.referral_id.id if p.referral_id else False,
            'co_signer_ids': lines,
            'split_preview_json': preview,
        })
        return res

    def action_confirm(self):
        self.ensure_one()
        if not self.verificato_righe:
            raise UserError(
                'Devi confermare di aver verificato le righe prima '
                'di procedere.')
        if not self.brought_by_partner_id:
            raise UserError('Il portatore e\' obbligatorio.')

        p = self.portfolio_id

        # 1. Scrivi portatore + referral
        p.brought_by_partner_id = self.brought_by_partner_id.id
        p.referral_id = self.referral_id.id if self.referral_id else False

        # 2. Sostituisci co-segnalatori (unlink + recreate)
        p.co_segnalatore_ids.unlink()
        for cs in self.co_signer_ids:
            self.env['erpv6.attribution.co_signer'].create({
                'portfolio_id': p.id,
                'partner_id': cs.partner_id.id,
                'pct': cs.pct,
                'notes': cs.notes,
            })

        # 3. Settaggi finali
        p.attribution_confirmed = True
        if p.state == 'draft':
            p.state = 'parsed'
        if p.state == 'parsed':
            p.state = 'reviewed'

        # 4. Nota verifica (se presente)
        if self.note_verifica:
            p.notes = (p.notes or '') + '\n[Verifica] ' + self.note_verifica

        return {'type': 'ir.actions.act_window_close'}
