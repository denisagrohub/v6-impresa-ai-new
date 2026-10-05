# pylint: disable=import-error
"""Admin Credits API — CRUD erpv6.credit.portfolio (C-crediti-1c).

Riusa _authenticate di APIBaseController (pattern admin_appointments_api).
Sicurezza R2: portfolio visibili a admin + chief_projects + consulenti.
"""
import base64
import logging

from odoo import http
from odoo.http import request

from .consultant_api import ConsultantAPIController

_logger = logging.getLogger(__name__)


class AdminCreditsAPIController(ConsultantAPIController):

    def _portfolio_to_dict(self, p, with_lines=False):
        d = {
            'id': p.id,
            'name': p.name or '',
            'cedente_id': p.cedente_id.id if p.cedente_id else None,
            'cedente_name': p.cedente_id.name if p.cedente_id else None,
            'mandatario_id': p.mandatario_id.id if p.mandatario_id else None,
            'mandatario_name': p.mandatario_id.name if p.mandatario_id else None,
            'certificate_type': p.certificate_type or 'credit_tax',
            'relation_id': p.relation_id.id if p.relation_id else None,
            'relation_name': p.relation_id.name if p.relation_id else None,
            'deal_id': p.deal_id.id if p.deal_id else None,
            'deal_name': p.deal_id.name if p.deal_id else None,
            'state': p.state,
            'data_estratto': p.data_estratto.strftime('%Y-%m-%d')
                if p.data_estratto else None,
            'utenza_lavoro': p.utenza_lavoro or '',
            'cf_commercialista': p.cf_commercialista or '',
            'total_amount': p.total_amount or 0.0,
            'total_lines': p.total_lines or 0,
            'file_pdf_name': p.file_pdf_name or '',
            'source_attachment_id': p.source_attachment_id.id
                if p.source_attachment_id else None,
            'source_email_subject': p.source_email_id.subject
                if p.source_email_id else None,
            'notes': p.notes or '',
            'create_date': p.create_date.isoformat() if p.create_date else None,
        }
        if with_lines:
            d['lines'] = [self._line_to_dict(l) for l in p.line_ids]
        # 05/10/2026 (C-attribution-1c): attribuzione portatore + co-segn
        # (presente solo se modulo erpv6_attribution installato)
        if 'brought_by_partner_id' in p._fields:
            d['attribution'] = {
                'brought_by': {
                    'id': p.brought_by_partner_id.id,
                    'name': p.brought_by_partner_id.name,
                } if p.brought_by_partner_id else None,
                'referral': {
                    'id': p.referral_id.id,
                    'name': p.referral_id.display_name,
                } if p.referral_id else None,
                'co_segnalatori': [
                    {'id': cs.partner_id.id,
                     'name': cs.partner_id.name,
                     'pct': cs.pct,
                     'notes': cs.notes or ''}
                    for cs in p.co_segnalatore_ids
                ],
                'co_segnalatori_count': len(p.co_segnalatore_ids),
                'confirmed': bool(p.attribution_confirmed),
            }
        return d

    def _line_to_dict(self, l):
        return {
            'id': l.id,
            'codice': l.codice or '',
            'descrizione': l.descrizione or '',
            'tipologia': l.tipologia or '',
            'anno': l.anno,
            'importo': l.importo or 0.0,
            'quantita': l.quantita or 0.0,
            'prezzo_unitario': l.prezzo_unitario or 0.0,
            'codice_progetto': l.codice_progetto or '',
            'categoria_cedibilita': l.categoria_cedibilita or '',
            'selezionato': bool(l.selezionato),
        }

    # ═══════════════════════════════════════════════════════════════
    # GET /api/v1/admin/credit-portfolios
    # ═══════════════════════════════════════════════════════════════
    @http.route('/api/v1/admin/credit-portfolios', type='http',
                auth='none', methods=['GET', 'OPTIONS'], csrf=False)
    def list_credit_portfolios(self, **kwargs):
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        user, err = self._authenticate(require_auth=True)
        if err:
            return err
        request.update_env(user=user.id)

        args = request.httprequest.args
        state = (args.get('state') or '').strip()
        cedente_id = (args.get('cedente_id') or '').strip()
        relation_id = (args.get('relation_id') or '').strip()
        limit = min(int(args.get('limit') or 100), 500)

        domain = []
        if state:
            domain.append(('state', '=', state))
        if cedente_id:
            domain.append(('cedente_id', '=', int(cedente_id)))
        if relation_id:
            domain.append(('relation_id', '=', int(relation_id)))

        P = request.env['erpv6.credit.portfolio'].sudo()
        portfolios = P.search(domain, order='create_date desc', limit=limit)
        return self._json_response({
            'portfolios': [self._portfolio_to_dict(p) for p in portfolios],
            'total': len(portfolios),
        })

    # ═══════════════════════════════════════════════════════════════
    # GET /api/v1/admin/credit-portfolios/<id>
    # ═══════════════════════════════════════════════════════════════
    @http.route('/api/v1/admin/credit-portfolios/<int:pid>', type='http',
                auth='none', methods=['GET', 'OPTIONS'], csrf=False)
    def get_credit_portfolio(self, pid, **kwargs):
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        user, err = self._authenticate(require_auth=True)
        if err:
            return err
        request.update_env(user=user.id)

        P = request.env['erpv6.credit.portfolio'].sudo().browse(pid)
        if not P.exists():
            return self._json_response({'error': 'Portfolio non trovato'}, 404)
        return self._json_response(self._portfolio_to_dict(P, with_lines=True))

    # ═══════════════════════════════════════════════════════════════
    # POST /api/v1/admin/credit-portfolios/<id>/reprocess
    # ═══════════════════════════════════════════════════════════════
    @http.route('/api/v1/admin/credit-portfolios/<int:pid>/reprocess',
                type='http', auth='none',
                methods=['POST', 'OPTIONS'], csrf=False)
    def reprocess_credit_portfolio(self, pid, **kwargs):
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        user, err = self._authenticate(require_auth=True)
        if err:
            return err
        request.update_env(user=user.id)

        P = request.env['erpv6.credit.portfolio'].sudo().browse(pid)
        if not P.exists():
            return self._json_response({'error': 'Portfolio non trovato'}, 404)
        try:
            ok = P.action_reprocess()
        except Exception as e:
            _logger.exception('Reprocess portfolio %d fallito', pid)
            return self._json_response({'error': str(e)}, 500)
        return self._json_response({
            'ok': bool(ok),
            'portfolio': self._portfolio_to_dict(P, with_lines=True),
        })

    # ═══════════════════════════════════════════════════════════════
    # POST /api/v1/admin/credit-portfolios/<id>/confirm
    # ═══════════════════════════════════════════════════════════════
    @http.route('/api/v1/admin/credit-portfolios/<int:pid>/confirm',
                type='http', auth='none',
                methods=['POST', 'OPTIONS'], csrf=False)
    def confirm_credit_portfolio(self, pid, **kwargs):
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        user, err = self._authenticate(require_auth=True)
        if err:
            return err
        request.update_env(user=user.id)

        P = request.env['erpv6.credit.portfolio'].sudo().browse(pid)
        if not P.exists():
            return self._json_response({'error': 'Portfolio non trovato'}, 404)
        P.action_confirm()
        return self._json_response({
            'ok': True,
            'portfolio': self._portfolio_to_dict(P, with_lines=True),
        })

    # ═══════════════════════════════════════════════════════════════
    # PATCH /api/v1/admin/credit-portfolios/<id>/line/<line_id>
    # ═══════════════════════════════════════════════════════════════
    @http.route('/api/v1/admin/credit-portfolios/<int:pid>/line/<int:line_id>',
                type='http', auth='none',
                methods=['PATCH', 'POST', 'OPTIONS'], csrf=False)
    def update_credit_line(self, pid, line_id, **kwargs):
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        user, err = self._authenticate(require_auth=True)
        if err:
            return err
        request.update_env(user=user.id)

        # POST via JSON body (Next proxy manda PATCH via fetch ma Odoo
        # type='http' gestisce meglio POST con body JSON per update)
        try:
            body = request.httprequest.get_json(force=True, silent=True) or {}
        except Exception:
            body = {}

        L = request.env['erpv6.credit.line'].sudo().browse(line_id)
        if not L.exists() or L.portfolio_id.id != pid:
            return self._json_response({'error': 'Riga non trovata'}, 404)

        allowed = {'codice', 'descrizione', 'tipologia', 'anno',
                   'importo', 'quantita', 'prezzo_unitario',
                   'codice_progetto', 'categoria_cedibilita', 'selezionato'}
        vals = {k: v for k, v in body.items() if k in allowed}
        if not vals:
            return self._json_response({'error': 'Nessun campo valido'}, 400)
        try:
            L.write(vals)
        except Exception as e:
            return self._json_response({'error': str(e)}, 400)
        return self._json_response({
            'ok': True,
            'line': self._line_to_dict(L),
            'portfolio_total': L.portfolio_id.total_amount,
        })

    # ═══════════════════════════════════════════════════════════════
    # PATCH /api/v1/admin/credit-portfolios/<id>  (note + cedente)
    # ═══════════════════════════════════════════════════════════════
    @http.route('/api/v1/admin/credit-portfolios/<int:pid>', type='http',
                auth='none', methods=['PATCH', 'POST', 'OPTIONS'],
                csrf=False)
    def patch_credit_portfolio(self, pid, **kwargs):
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        user, err = self._authenticate(require_auth=True)
        if err:
            return err
        request.update_env(user=user.id)

        P = request.env['erpv6.credit.portfolio'].sudo().browse(pid)
        if not P.exists():
            return self._json_response({'error': 'Portfolio non trovato'}, 404)

        try:
            body = request.httprequest.get_json(force=True, silent=True) or {}
        except Exception:
            body = {}
        allowed = {'notes', 'cedente_id'}
        vals = {k: v for k, v in body.items() if k in allowed}
        if not vals:
            return self._json_response({'error': 'Nessun campo valido'}, 400)
        try:
            P.write(vals)
            if 'cedente_id' in vals and vals['cedente_id'] and P.state == 'draft':
                P.state = 'parsed'
        except Exception as e:
            return self._json_response({'error': str(e)}, 400)
        return self._json_response({
            'ok': True,
            'portfolio': self._portfolio_to_dict(P, with_lines=False),
        })

    # ═══════════════════════════════════════════════════════════════
    # GET /api/v1/admin/credit-portfolios/<id>/pdf
    # ═══════════════════════════════════════════════════════════════
    @http.route('/api/v1/admin/credit-portfolios/<int:pid>/pdf',
                type='http', auth='none', methods=['GET', 'OPTIONS'],
                csrf=False)
    def download_credit_portfolio_pdf(self, pid, **kwargs):
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        user, err = self._authenticate(require_auth=True)
        if err:
            return err
        request.update_env(user=user.id)

        P = request.env['erpv6.credit.portfolio'].sudo().browse(pid)
        if not P.exists() or not P.file_pdf:
            return self._json_response({'error': 'PDF non disponibile'}, 404)

        pdf_bytes = base64.b64decode(P.file_pdf)
        filename = (P.file_pdf_name or 'cassetto.pdf').replace('"', '')
        return request.make_response(
            pdf_bytes,
            headers=[
                ('Content-Type', 'application/pdf'),
                ('Content-Disposition',
                 'inline; filename="%s"' % filename),
                ('Content-Length', str(len(pdf_bytes))),
            ],
        )

    # ═══════════════════════════════════════════════════════════════
    # GET /api/v1/admin/credit-portfolios/<id>/attribution-wizard
    # Ritorna i default per la modale Next (portatore proposto,
    # co-signer copiati, preview split).
    # ═══════════════════════════════════════════════════════════════
    @http.route('/api/v1/admin/credit-portfolios/<int:pid>/attribution-wizard',
                type='http', auth='none', methods=['GET', 'OPTIONS'],
                csrf=False)
    def get_attribution_wizard(self, pid, **kwargs):
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        user, err = self._authenticate(require_auth=True)
        if err:
            return err
        request.update_env(user=user.id)

        P = request.env['erpv6.credit.portfolio'].sudo().browse(pid)
        if not P.exists():
            return self._json_response({'error': 'Portfolio non trovato'}, 404)

        portatore = None
        if P.brought_by_partner_id:
            portatore = P.brought_by_partner_id
        elif P.cedente_id and P.cedente_id.brought_by_default_partner_id:
            portatore = P.cedente_id.brought_by_default_partner_id

        try:
            split = P._propose_split(P)
        except Exception as e:
            _logger.warning('attribution-wizard GET: _propose_split fail: %s', e)
            split = {'error': str(e)}

        return self._json_response({
            'portfolio': {
                'id': P.id,
                'name': P.name,
                'cedente_name': P.cedente_id.name if P.cedente_id else None,
                'attribution_confirmed': bool(P.attribution_confirmed),
            },
            'defaults': {
                'verificato_righe': False,
                'note_verifica': '',
                'brought_by_partner_id': portatore.id if portatore else None,
                'brought_by_partner_name': portatore.name if portatore else None,
                'referral_id': P.referral_id.id if P.referral_id else None,
                'referral_name': P.referral_id.display_name if P.referral_id else None,
                'co_signer_lines': [
                    {'partner_id': cs.partner_id.id,
                     'partner_name': cs.partner_id.name,
                     'pct': cs.pct,
                     'notes': cs.notes or ''}
                    for cs in P.co_segnalatore_ids
                ],
            },
            'split_preview': split,
        })

    # ═══════════════════════════════════════════════════════════════
    # POST /api/v1/admin/credit-portfolios/<id>/attribution-wizard
    # Applica i dati della modale Next: scrive su portfolio,
    # setta attribution_confirmed + state reviewed.
    # ═══════════════════════════════════════════════════════════════
    @http.route('/api/v1/admin/credit-portfolios/<int:pid>/attribution-wizard',
                type='http', auth='none', methods=['POST', 'OPTIONS'],
                csrf=False)
    def post_attribution_wizard(self, pid, **kwargs):
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        user, err = self._authenticate(require_auth=True)
        if err:
            return err
        request.update_env(user=user.id)

        P = request.env['erpv6.credit.portfolio'].sudo().browse(pid)
        if not P.exists():
            return self._json_response({'error': 'Portfolio non trovato'}, 404)

        try:
            body = request.httprequest.get_json(force=True, silent=True) or {}
        except Exception:
            body = {}

        if not body.get('verificato_righe'):
            return self._json_response(
                {'error': 'Devi confermare di aver verificato le righe.'}, 400)
        if not body.get('brought_by_partner_id'):
            return self._json_response(
                {'error': 'Il portatore e\' obbligatorio.'}, 400)

        vals = {
            'brought_by_partner_id': int(body['brought_by_partner_id']),
            'referral_id': int(body['referral_id']) if body.get('referral_id') else False,
        }
        try:
            P.write(vals)
        except Exception as e:
            return self._json_response({'error': str(e)}, 400)

        P.co_segnalatore_ids.unlink()
        for cs in (body.get('co_signer_lines') or []):
            pid_cs = cs.get('partner_id')
            if not pid_cs:
                continue
            try:
                request.env['erpv6.attribution.co_signer'].sudo().create({
                    'portfolio_id': P.id,
                    'partner_id': int(pid_cs),
                    'pct': float(cs.get('pct') or 3.0),
                    'notes': (cs.get('notes') or '')[:200],
                })
            except Exception as e:
                _logger.warning('co_signer create fail: %s', e)

        note_verifica = (body.get('note_verifica') or '').strip()
        if note_verifica:
            P.notes = (P.notes or '') + '\n[Verifica] ' + note_verifica

        P.attribution_confirmed = True
        if P.state == 'draft':
            P.state = 'parsed'
        if P.state == 'parsed':
            P.state = 'reviewed'

        return self._json_response({
            'ok': True,
            'portfolio': self._portfolio_to_dict(P, with_lines=False),
        })

    # ═══════════════════════════════════════════════════════════════
    # GET /api/v1/admin/partners/search?q=xxx
    # Typeahead partner per la modale attribuzione (evita prompt ID).
    # ═══════════════════════════════════════════════════════════════
    @http.route('/api/v1/admin/partners/search', type='http',
                auth='none', methods=['GET', 'OPTIONS'], csrf=False)
    def search_partners(self, **kwargs):
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        user, err = self._authenticate(require_auth=True)
        if err:
            return err
        request.update_env(user=user.id)

        args = request.httprequest.args
        q = (args.get('q') or '').strip()
        limit = min(int(args.get('limit') or 15), 50)
        if len(q) < 2:
            return self._json_response({'partners': []})

        P = request.env['res.partner'].sudo()
        partners = P.search([
            '|', '|',
            ('name', 'ilike', q),
            ('email', 'ilike', q),
            ('vat', 'ilike', q),
        ], limit=limit, order='name asc')

        return self._json_response({
            'partners': [
                {'id': p.id, 'name': p.name,
                 'email': p.email or '', 'vat': p.vat or ''}
                for p in partners
            ],
        })
