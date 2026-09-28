# pylint: disable=import-error
"""Endpoint pubblico conferma consenso condivisione quote V6 + logo company."""
import base64
import logging

from odoo import http
from odoo.http import request

_logger = logging.getLogger(__name__)


class PublicAssetsController(http.Controller):

    @http.route('/api/v1/public/company-logo', type='http',
                auth='public', methods=['GET'], csrf=False)
    def company_logo(self, **kw):
        """Serve il logo di company V6 (PNG/JPEG/SVG) con cache lungo.
        Auto-aggiornato quando il logo cambia in Odoo (Settings → Company)."""
        company = request.env.company.sudo()
        if not company or not company.logo:
            return request.not_found()
        try:
            raw = base64.b64decode(company.logo)
            # Detect mime
            if raw[:8] == b'\x89PNG\r\n\x1a\n':
                mime = 'image/png'
            elif raw[:3] == b'\xff\xd8\xff':
                mime = 'image/jpeg'
            elif raw[:5].lower() == b'<?xml' or raw[:4].lower() == b'<svg':
                mime = 'image/svg+xml'
            elif raw[:4] == b'GIF8':
                mime = 'image/gif'
            else:
                mime = 'image/png'
            return request.make_response(
                raw,
                headers=[
                    ('Content-Type', mime),
                    ('Cache-Control', 'public, max-age=86400'),
                    ('Content-Length', str(len(raw))),
                ])
        except Exception:
            _logger.exception('Errore serving logo company')
            return request.not_found()


def _html_page(title, body_html, status=200, accent='#0f172a'):
    """Pagina HTML brandizzata V6 con logo dinamico da Odoo."""
    logo_html = '''<img src="https://www.v6impresa.it/api/public/company-logo" alt="V6 Impresa"
                     style="height:44px;width:auto;object-fit:contain;"
                     onerror="this.style.display='none';this.nextElementSibling.style.display='block';" />
                 <div style="display:none;font-size:22px;font-weight:800;color:#0f172a;">V6</div>'''

    return f'''<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title} · V6 Impresa</title>
<style>
  * {{ box-sizing: border-box; }}
  body {{
    margin: 0; padding: 0; min-height: 100vh;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    background: linear-gradient(135deg, #f8fafc 0%, #eef2f7 100%);
    color: #0f172a;
    display: flex; align-items: center; justify-content: center;
    padding: 24px;
  }}
  .card {{
    background: white; border-radius: 20px;
    box-shadow: 0 20px 60px -20px rgba(15,23,42,.15), 0 4px 12px -4px rgba(15,23,42,.08);
    max-width: 540px; width: 100%; padding: 48px 44px;
    border: 1px solid rgba(226,232,240,.6);
  }}
  .brand {{ margin-bottom: 36px; display: flex; align-items: center; justify-content: center; }}
  h1 {{
    font-size: 26px; font-weight: 700; letter-spacing: -0.02em;
    margin: 0 0 12px 0; color: {accent};
    display: flex; align-items: center; gap: 14px;
  }}
  .icon {{
    width: 44px; height: 44px; border-radius: 50%;
    display: inline-flex; align-items: center; justify-content: center;
    font-size: 24px; flex-shrink: 0;
  }}
  .icon-ok {{ background: #d1fae5; color: #059669; }}
  .icon-no {{ background: #f1f5f9; color: #64748b; }}
  .icon-err {{ background: #fee2e2; color: #dc2626; }}
  p {{ font-size: 15px; line-height: 1.65; color: #475569; margin: 0 0 16px 0; }}
  .highlight {{ color: #0f172a; font-weight: 600; }}
  .footer {{
    margin-top: 36px; padding-top: 22px;
    border-top: 1px solid #e2e8f0;
    font-size: 12px; color: #94a3b8;
    display: flex; align-items: center; justify-content: space-between;
  }}
  .note {{
    background: #f8fafc; border-left: 3px solid #1a7fa8;
    padding: 14px 16px; border-radius: 8px;
    font-size: 13px; color: #475569; margin-top: 20px;
  }}
</style>
</head>
<body>
<div class="card">
  <div class="brand">{logo_html}</div>
  {body_html}
  <div class="footer">
    <span>v6impresa.it</span>
    <span>Sistema deal</span>
  </div>
</div>
</body>
</html>'''


class PublicTransparencyController(http.Controller):

    @http.route('/api/v1/public/transparency-confirm', type='http',
                auth='public', methods=['GET'], csrf=False)
    def transparency_confirm(self, token=None, r=None, **kw):
        r = (r or kw.get('r') or '').lower()
        if r not in ('yes', 'no'):
            body = '<h1><span class="icon icon-err">!</span>Richiesta non valida</h1><p>Il link è incompleto o danneggiato.</p>'
            return request.make_response(
                _html_page('Errore', body, 400, accent='#dc2626'),
                headers=[('Content-Type', 'text/html; charset=utf-8')], status=400)
        if not token:
            body = '<h1><span class="icon icon-err">!</span>Token mancante</h1><p>Il link non contiene un token valido.</p>'
            return request.make_response(
                _html_page('Errore', body, 400, accent='#dc2626'),
                headers=[('Content-Type', 'text/html; charset=utf-8')], status=400)

        P = request.env['erpv6.deal.participant'].sudo()
        p = P.search([('share_transparency_token', '=', token)], limit=1)
        if not p:
            body = ('<h1><span class="icon icon-err">✕</span>Link non valido o scaduto</h1>'
                    '<p>Questo link è già stato utilizzato o non è più attivo. '
                    'Se hai bisogno di modificare la tua scelta, contatta il team V6.</p>')
            return request.make_response(
                _html_page('Link scaduto', body, 404, accent='#dc2626'),
                headers=[('Content-Type', 'text/html; charset=utf-8')], status=404)

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
        deal_name = p.deal_id.name if p.deal_id else ''

        if r == 'yes':
            body = f'''<h1><span class="icon icon-ok">✓</span>Consenso registrato</h1>
<p>Hai scelto di <span class="highlight">condividere la tua quota</span> nel deal:</p>
<p style="font-size:13px;color:#64748b;margin-top:-8px"><strong>{deal_name}</strong></p>
<div class="note">
  Se <strong>tutti i partecipanti</strong> accettano, il consuntivo mensile mostrerà a ciascuno la ripartizione completa.<br>
  Se anche uno solo rifiuta, ognuno vedrà solo la propria riga — e nessuno saprà chi ha rifiutato.
</div>'''
        else:
            body = f'''<h1><span class="icon icon-no">✓</span>Preferenza registrata</h1>
<p>Hai scelto di <span class="highlight">non condividere</span> la tua quota nel deal:</p>
<p style="font-size:13px;color:#64748b;margin-top:-8px"><strong>{deal_name}</strong></p>
<div class="note">
  Nel consuntivo mensile vedrai solo la tua riga.<br>
  <strong>Nessun altro partecipante saprà chi ha rifiutato.</strong>
</div>'''

        body += f'''
<p style="margin-top:24px;font-size:13px;color:#64748b">
  Grazie, <strong style="color:#0f172a">{nome}</strong>.
</p>
<p style="font-size:12px;color:#94a3b8">
  Puoi modificare questa preferenza in qualsiasi momento dalla tua area riservata.
</p>'''

        return request.make_response(
            _html_page('Consenso registrato', body),
            headers=[('Content-Type', 'text/html; charset=utf-8')])
