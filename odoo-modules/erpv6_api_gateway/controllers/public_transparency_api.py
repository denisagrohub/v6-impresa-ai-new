# pylint: disable=import-error
"""Endpoint pubblico conferma consenso condivisione quote V6."""
import logging

from odoo import http
from odoo.http import request

_logger = logging.getLogger(__name__)


def _html(html, status=200):
    return request.make_response(
        html,
        headers=[('Content-Type', 'text/html; charset=utf-8')],
        status=status)


class PublicTransparencyController(http.Controller):

    @http.route('/api/v1/public/transparency-confirm', type='http',
                auth='public', methods=['GET'], csrf=False)
    def transparency_confirm(self, token=None, r=None, **kw):
        r = (r or kw.get('r') or '').lower()
        if r not in ('yes', 'no'):
            return _html('<html><body><h2>Richiesta non valida</h2></body></html>', 400)
        if not token:
            return _html('<html><body><h2>Token mancante</h2></body></html>', 400)

        P = request.env['erpv6.deal.participant'].sudo()
        p = P.search([('share_transparency_token', '=', token)], limit=1)
        if not p:
            return _html('<html><body><h2>Link non valido o scaduto</h2></body></html>', 404)

        from odoo import fields as odoo_fields
        now = odoo_fields.Datetime.now()
        p.write({
            'share_transparency': (r == 'yes'),
            'share_transparency_responded_at': now,
        })
        partner = p.partner_id
        if partner and partner.x_v6_share_transparency_default == 'unset':
            partner.write({
                'x_v6_share_transparency_default': ('yes' if r == 'yes' else 'no'),
                'x_v6_share_transparency_set_at': now,
            })
        request.env.cr.commit()

        nome = partner.name if partner else ''
        if r == 'yes':
            msg = ('<h2 style="color:#059669">✓ Consenso registrato</h2>'
                   '<p>Hai accettato di condividere la tua quota.</p>')
        else:
            msg = ('<h2 style="color:#6b7280">✓ Preferenza registrata</h2>'
                   '<p>Hai scelto di non condividere. Gli altri non sapranno chi ha rifiutato.</p>')
        html = f'''<!DOCTYPE html><html><head><title>Consenso</title>
<style>body{{font-family:sans-serif;max-width:600px;margin:60px auto;padding:20px}}</style>
</head><body>{msg}<p style="color:#666">Grazie {nome}.</p>
<p style="color:#888;font-size:.8em">V6 Impresa</p></body></html>'''
        return _html(html)
