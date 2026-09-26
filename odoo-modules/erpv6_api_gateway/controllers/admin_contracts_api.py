# pylint: disable=import-error
"""Admin Contracts API — composer documenti.

Endpoint per /admin/contratti: lista, CRUD, generate PDF, edit,
send-for-signature. Solo admin (base.group_system).
"""
import base64
import json
import logging
import time

from odoo import http
from odoo.http import request

from .consultant_api import ConsultantAPIController

_logger = logging.getLogger(__name__)


class AdminContractsAPIController(ConsultantAPIController):

    def _require_admin(self):
        user, error_response = self._authenticate(require_auth=True)
        if error_response:
            return None, error_response
        if not user.has_group('base.group_system'):
            return None, self._json_response({'error': 'Riservato agli amministratori'}, 403)
        return user, None

    def _draft_to_dict(self, d, include_pdf=False):
        data = {
            'id': d.id,
            'name': d.name,
            'state': d.state,
            'templateId': d.template_id.id if d.template_id else None,
            'templateCode': d.template_id.code if d.template_id else None,
            'templateName': d.template_id.name if d.template_id else None,
            'projectId': d.project_id.id if d.project_id else None,
            'projectName': d.project_id.name if d.project_id else None,
            'counterpartyId': d.counterparty_id.id if d.counterparty_id else None,
            'counterpartyName': d.counterparty_id.name if d.counterparty_id else None,
            'pdfMode': d.pdf_mode,
            'revision': d.revision,
            'revisionNotes': d.revision_notes or None,
            'documentId': d.document_id.id if d.document_id else None,
            'hasPdf': bool(d.document_id and d.document_id.pdf_file),
            'extraData': d.extra_data or {},
            'lastGeneratedAt': d.last_generated_at.isoformat() if d.last_generated_at else None,
            'createdAt': d.create_date.isoformat() if d.create_date else None,
            'signRequestIds': d.sign_request_ids.ids,
        }
        return data

    @http.route('/api/v1/admin/contracts',
                type='http', auth='none', methods=['GET', 'OPTIONS'], csrf=False)
    def list_contracts(self, **kwargs):
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        user, err = self._require_admin()
        if err:
            return err

        env = request.env
        if 'erpv6.contract.draft' not in env:
            return self._json_response({'error': 'erpv6_sign non installato'}, 501)

        args = request.httprequest.args
        domain = []
        state = args.get('state', '')
        if state:
            domain.append(('state', '=', state))
        project_id = args.get('projectId', '')
        if project_id and project_id.isdigit():
            domain.append(('project_id', '=', int(project_id)))
        q = args.get('q', '')
        if q:
            domain = ['|', ('name', 'ilike', q)] + domain

        Draft = env['erpv6.contract.draft'].sudo()
        drafts = Draft.search(domain, order='create_date desc', limit=200)
        return self._json_response({
            'success': True,
            'contracts': [self._draft_to_dict(d) for d in drafts],
            'total': len(drafts),
        })

    @http.route('/api/v1/admin/contracts/meta',
                type='http', auth='none', methods=['GET', 'OPTIONS'], csrf=False)
    def contracts_meta(self, **kwargs):
        """Metadati per popolare i dropdown del wizard."""
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        user, err = self._require_admin()
        if err:
            return err

        env = request.env
        templates = env['erpv6.typst.template'].sudo().search([
            ('active', '=', True),
        ])
        projects = env['erpv6.tracking.relation'].sudo().search([
            ('parent_id', '=', False),
        ], limit=200, order='name asc')
        partners = env['res.partner'].sudo().search([], limit=500, order='name asc')

        return self._json_response({
            'success': True,
            'templates': [
                {'id': t.id, 'code': t.code, 'name': t.name,
                 'category': t.category, 'requiredFields': t.required_fields or {}}
                for t in templates
            ],
            'projects': [
                {'id': p.id, 'name': p.name} for p in projects
            ],
            'partners': [
                {'id': p.id, 'name': p.name, 'isCompany': p.is_company,
                 'email': p.email or '', 'vat': p.vat or ''}
                for p in partners
            ],
        })

    @http.route('/api/v1/admin/contracts/<int:contract_id>',
                type='http', auth='none', methods=['GET', 'OPTIONS'], csrf=False)
    def get_contract(self, contract_id, **kwargs):
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        user, err = self._require_admin()
        if err:
            return err

        d = request.env['erpv6.contract.draft'].sudo().browse(contract_id)
        if not d.exists():
            return self._json_response({'error': 'Non trovato'}, 404)
        return self._json_response({'success': True, 'contract': self._draft_to_dict(d)})

    @http.route('/api/v1/admin/contracts',
                type='http', auth='none', methods=['POST', 'OPTIONS'], csrf=False)
    def create_contract(self, **kwargs):
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        user, err = self._require_admin()
        if err:
            return err

        try:
            body = json.loads(request.httprequest.get_data(as_text=True) or '{}')
        except json.JSONDecodeError:
            return self._json_response({'error': 'JSON non valido'}, 400)

        vals = {
            'name': body.get('name') or 'Nuovo contratto',
            'template_id': body.get('templateId'),
            'project_id': body.get('projectId') or False,
            'counterparty_id': body.get('counterpartyId') or False,
            'extra_data': body.get('extraData') or {},
            'pdf_mode': body.get('pdfMode') or 'official',
        }
        d = request.env['erpv6.contract.draft'].sudo().create(vals)
        return self._json_response({'success': True, 'contract': self._draft_to_dict(d)})

    @http.route('/api/v1/admin/contracts/<int:contract_id>',
                type='http', auth='none', methods=['PATCH', 'OPTIONS'], csrf=False)
    def update_contract(self, contract_id, **kwargs):
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        user, err = self._require_admin()
        if err:
            return err

        d = request.env['erpv6.contract.draft'].sudo().browse(contract_id)
        if not d.exists():
            return self._json_response({'error': 'Non trovato'}, 404)

        try:
            body = json.loads(request.httprequest.get_data(as_text=True) or '{}')
        except json.JSONDecodeError:
            return self._json_response({'error': 'JSON non valido'}, 400)

        vals = {}
        for k_src, k_dst in [
            ('name', 'name'), ('templateId', 'template_id'),
            ('projectId', 'project_id'), ('counterpartyId', 'counterparty_id'),
            ('extraData', 'extra_data'), ('pdfMode', 'pdf_mode'),
            ('revisionNotes', 'revision_notes'),
        ]:
            if k_src in body:
                vals[k_dst] = body[k_src] or False if k_dst != 'extra_data' else (body[k_src] or {})

        if vals:
            # Se sta cambiando contenuto e non è draft, porta a draft (richiede edit)
            if d.state == 'signed':
                return self._json_response({'error': 'Contratto firmato, non modificabile'}, 400)
            d.write(vals)

        return self._json_response({'success': True, 'contract': self._draft_to_dict(d)})

    @http.route('/api/v1/admin/contracts/<int:contract_id>/generate',
                type='http', auth='none', methods=['POST', 'OPTIONS'], csrf=False)
    def generate_contract_pdf(self, contract_id, **kwargs):
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        user, err = self._require_admin()
        if err:
            return err

        d = request.env['erpv6.contract.draft'].sudo().browse(contract_id)
        if not d.exists():
            return self._json_response({'error': 'Non trovato'}, 404)

        try:
            r = d.action_generate_pdf()
            return self._json_response({'success': True, **r})
        except Exception as e:
            return self._json_response({'error': str(e)}, 500)

    @http.route('/api/v1/admin/contracts/<int:contract_id>/edit',
                type='http', auth='none', methods=['POST', 'OPTIONS'], csrf=False)
    def edit_contract(self, contract_id, **kwargs):
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        user, err = self._require_admin()
        if err:
            return err

        d = request.env['erpv6.contract.draft'].sudo().browse(contract_id)
        if not d.exists():
            return self._json_response({'error': 'Non trovato'}, 404)
        try:
            d.action_edit()
            return self._json_response({'success': True, 'contract': self._draft_to_dict(d)})
        except Exception as e:
            return self._json_response({'error': str(e)}, 400)

    @http.route('/api/v1/admin/contracts/<int:contract_id>/send',
                type='http', auth='none', methods=['POST', 'OPTIONS'], csrf=False)
    def send_contract(self, contract_id, **kwargs):
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        user, err = self._require_admin()
        if err:
            return err

        d = request.env['erpv6.contract.draft'].sudo().browse(contract_id)
        if not d.exists():
            return self._json_response({'error': 'Non trovato'}, 404)
        try:
            r = d.action_send_for_signature()
            return self._json_response({'success': True, **r})
        except Exception as e:
            return self._json_response({'error': str(e)}, 400)

    @http.route('/api/v1/admin/contracts/<int:contract_id>/pdf',
                type='http', auth='none', methods=['GET', 'OPTIONS'], csrf=False)
    def download_contract_pdf(self, contract_id, **kwargs):
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        user, err = self._require_admin()
        if err:
            return err

        d = request.env['erpv6.contract.draft'].sudo().browse(contract_id)
        if not d.exists() or not d.document_id or not d.document_id.pdf_file:
            return self._json_response({'error': 'PDF non disponibile'}, 404)

        pdf_bytes = base64.b64decode(d.document_id.pdf_file)
        filename = f'{d.name}.pdf'.replace('/', '_').replace('—', '-')
        return request.make_response(
            pdf_bytes,
            headers=[
                ('Content-Type', 'application/pdf'),
                ('Content-Disposition', f'attachment; filename="{filename}"'),
            ],
        )
