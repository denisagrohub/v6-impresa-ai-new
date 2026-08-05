# pylint: disable=import-error
import base64
import time
from odoo import http
from odoo.http import request
from .main import APIBaseController


class LibraryAPIController(APIBaseController):

    @http.route('/api/v1/library/project/<int:project_id>/documents', type='http', auth='none', methods=['GET', 'OPTIONS'], csrf=False)
    def get_project_documents(self, project_id, **kwargs):  # pylint: disable=unused-argument
        start_time = time.time()
        user, error_response = self._authenticate(require_auth=True)
        if error_response:
            return error_response
        
        try:
            if not hasattr(request.env, 'erpv6.library.document'):
                self._log_api_call(f'/api/v1/library/project/{project_id}/documents', 'GET', user.id, 501, start_time)
                return self._json_response({'error': 'Library module not installed'}, status=501)
            
            project = request.env['crm.lead'].sudo().browse(project_id)
            if not project.exists():
                self._log_api_call(f'/api/v1/library/project/{project_id}/documents', 'GET', user.id, 404, start_time)
                return self._json_response({'error': 'Project not found'}, status=404)
            
            partner = user.partner_id.commercial_partner_id or user.partner_id
            if project.partner_id.id != partner.id:
                self._log_api_call(f'/api/v1/library/project/{project_id}/documents', 'GET', user.id, 403, start_time)
                return self._json_response({'error': 'Access denied'}, status=403)
            
            documents = request.env['erpv6.library.document'].sudo().search([
                ('project_id', '=', project_id)
            ], order='create_date DESC')
            
            result = []
            for doc in documents:
                file_url = None
                if doc.file_id:
                    file_url = f'/api/v1/files/{doc.file_id.id}/download'
                
                blockchain_record = None
                if hasattr(doc, 'blockchain_record_id') and doc.blockchain_record_id:
                    blockchain_record = {
                        'id': doc.blockchain_record_id.id,
                        'tx_hash': doc.blockchain_record_id.tx_hash if hasattr(doc.blockchain_record_id, 'tx_hash') else '',
                    }
                
                result.append({
                    'id': doc.id,
                    'name': doc.name or '',
                    'category': doc.category or '',
                    'origin': doc.origin or '',
                    'is_final_client_facing': doc.is_final_client_facing or False,
                    'blockchain_record': blockchain_record,
                    'create_date': doc.create_date.isoformat() if doc.create_date else None,
                    'file_url': file_url,
                })
            
            self._log_api_call(f'/api/v1/library/project/{project_id}/documents', 'GET', user.id, 200, start_time)
            return self._json_response(result, status=200)
        except Exception as e:
            self._log_api_call(f'/api/v1/library/project/{project_id}/documents', 'GET', user.id if user else None, 500, start_time)
            return self._json_response({'error': str(e)}, status=500)

    @http.route('/api/v1/library/project/<int:project_id>/documents', type='http', auth='none', methods=['POST', 'OPTIONS'], csrf=False)
    def create_document(self, project_id, **kwargs):
        start_time = time.time()
        user, error_response = self._authenticate(require_auth=True)
        if error_response:
            return error_response
        
        try:
            if not hasattr(request.env, 'erpv6.library.document'):
                self._log_api_call(f'/api/v1/library/project/{project_id}/documents', 'POST', user.id, 501, start_time)
                return self._json_response({'error': 'Library module not installed'}, status=501)
            
            project = request.env['crm.lead'].sudo().browse(project_id)
            if not project.exists():
                self._log_api_call(f'/api/v1/library/project/{project_id}/documents', 'POST', user.id, 404, start_time)
                return self._json_response({'error': 'Project not found'}, status=404)
            
            partner = user.partner_id.commercial_partner_id or user.partner_id
            if project.partner_id.id != partner.id:
                self._log_api_call(f'/api/v1/library/project/{project_id}/documents', 'POST', user.id, 403, start_time)
                return self._json_response({'error': 'Access denied'}, status=403)
            
            data = request.get_json(force=True, silent=True) or {}
            
            vals = {
                'name': data.get('name', 'Untitled Document'),
                'category': data.get('category', 'general'),
                'origin': data.get('origin', 'manual'),
                'project_id': project_id,
            }
            
            file_id = None
            if 'file_content' in data:
                content_b64 = data.get('file_content', '')
                filename = data.get('filename', 'document.pdf')
                mimetype = data.get('mimetype', 'application/pdf')
                
                if content_b64:
                    attachment = request.env['ir.attachment'].sudo().create({
                        'name': filename,
                        'datas': content_b64,
                        'mimetype': mimetype,
                        'res_model': 'erpv6.library.document',
                    })
                    file_id = attachment.id
            
            if file_id:
                vals['file_id'] = file_id
            
            doc = request.env['erpv6.library.document'].sudo().create(vals)
            
            result = {
                'id': doc.id,
                'name': doc.name,
                'category': doc.category,
                'origin': doc.origin,
                'file_url': f'/api/v1/files/{file_id}/download' if file_id else None,
            }
            
            self._log_api_call(f'/api/v1/library/project/{project_id}/documents', 'POST', user.id, 200, start_time)
            return self._json_response(result, status=201)
        except Exception as e:
            self._log_api_call(f'/api/v1/library/project/{project_id}/documents', 'POST', user.id if user else None, 500, start_time)
            return self._json_response({'error': str(e)}, status=500)
