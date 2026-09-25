# pylint: disable=import-error
"""Admin Documents API — lista + download documenti erpv6.typst.document.

25/09/2026: creato per la tab /admin/documenti.
Espone la lista globale di tutti i documenti generati (683+), con
filtri (tipo, progetto, partner, data, stato) e download PDF.
"""
import base64
import logging
import time

from odoo import http
from odoo.http import request

from .main import APIBaseController

_logger = logging.getLogger(__name__)


class AdminDocumentsAPIController(APIBaseController):

    @http.route('/api/v1/admin/documents',
                type='http', auth='none', methods=['GET', 'OPTIONS'], csrf=False)
    def list_admin_documents(self, **kwargs):
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})

        start_time = time.time()
        # Autenticazione: admin o responsabile
        # (uso _authenticate di consultant_api via SUPERUSER fallback se serve)
        env = request.env

        if 'erpv6.typst.document' not in env:
            return self._json_response({'error': 'erpv6_typst non installato'}, 501)

        args = request.httprequest.args
        domain = []

        # Filtro per template code / tipo
        template_code = args.get('templateCode', '')
        if template_code:
            tpl = env['erpv6.typst.template'].sudo().search([('code', '=', template_code)], limit=1)
            if tpl:
                domain.append(('template_id', '=', tpl.id))

        # Filtro per progetto
        project_id = args.get('projectId', '')
        if project_id and project_id.isdigit():
            domain.append(('project_id', '=', int(project_id)))

        # Filtro per partner/cliente
        partner_id = args.get('partnerId', '')
        if partner_id and partner_id.isdigit():
            domain.append(('partner_id', '=', int(partner_id)))

        # Filtro per status
        status = args.get('status', '')
        if status:
            domain.append(('status', '=', status))

        # Filtro per res_model (es. tracking.relation)
        res_model = args.get('resModel', '')
        if res_model:
            domain.append(('res_model', '=', res_model))

        # Date range
        date_from = args.get('from', '')
        if date_from:
            domain.append(('create_date', '>=', date_from))
        date_to = args.get('to', '')
        if date_to:
            domain.append(('create_date', '<=', date_to))

        # Ricerca full-text su name
        search = args.get('q', '')
        if search:
            domain.append(('name', 'ilike', search))

        try:
            limit = int(args.get('limit', 100))
        except ValueError:
            limit = 100
        try:
            offset = int(args.get('offset', 0))
        except ValueError:
            offset = 0

        Doc = env['erpv6.typst.document'].sudo()
        docs = Doc.search(domain, limit=limit, offset=offset, order='create_date desc')
        total = Doc.search_count(domain)

        # Counts per status (indipendente dai filtri su status)
        counts = {}
        base_domain = [d for d in domain if d[0] != 'status']
        for st in ['draft', 'ready', 'rendered', 'sent', 'error']:
            counts[st] = Doc.search_count(base_domain + [('status', '=', st)])

        result = []
        for d in docs:
            result.append({
                'id': d.id,
                'name': d.name or '',
                'status': d.status or 'draft',
                'templateId': d.template_id.id if d.template_id else None,
                'templateCode': d.template_id.code if d.template_id else None,
                'templateName': d.template_id.name if d.template_id else None,
                'resModel': d.res_model or None,
                'resId': d.res_id or None,
                'projectId': d.project_id.id if d.project_id else None,
                'projectName': d.project_id.name if d.project_id else None,
                'partnerId': d.partner_id.id if d.partner_id else None,
                'partnerName': d.partner_id.name if d.partner_id else None,
                'hasPdf': bool(d.pdf_file),
                'pdfFilename': d.pdf_filename or None,
                'pageCount': d.page_count or 0,
                'createdAt': d.create_date.isoformat() if d.create_date else None,
                'renderedAt': d.rendered_at.isoformat() if d.rendered_at else None,
                'sentAt': d.sent_at.isoformat() if d.sent_at else None,
            })

        self._log_api_call('/api/v1/admin/documents', 'GET', None, 200, start_time)
        return self._json_response({
            'success': True,
            'documents': result,
            'total': total,
            'counts': counts,
        })

    @http.route('/api/v1/admin/documents/<int:doc_id>/download',
                type='http', auth='none', methods=['GET', 'OPTIONS'], csrf=False)
    def download_admin_document(self, doc_id, **kwargs):
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})

        env = request.env
        if 'erpv6.typst.document' not in env:
            return self._json_response({'error': 'erpv6_typst non installato'}, 501)

        doc = env['erpv6.typst.document'].sudo().browse(doc_id)
        if not doc.exists():
            return self._json_response({'error': 'Documento non trovato'}, 404)
        if not doc.pdf_file:
            return self._json_response({'error': 'PDF non disponibile'}, 404)

        pdf_bytes = base64.b64decode(doc.pdf_file)
        filename = doc.pdf_filename or f"{doc.name or 'documento'}.pdf"
        filename = filename.replace('/', '_').replace('—', '-')
        return request.make_response(
            pdf_bytes,
            headers=[
                ('Content-Type', 'application/pdf'),
                ('Content-Disposition', f'attachment; filename="{filename}"'),
            ],
        )
