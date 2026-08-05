# pylint: disable=import-error
import time
from odoo import http
from odoo.http import request
from .main import APIBaseController


class ProjectAPIController(APIBaseController):

    @http.route('/api/v1/projects', type='http', auth='none', methods=['GET', 'OPTIONS'], csrf=False)
    def get_projects(self, **kwargs):  # pylint: disable=unused-argument
        start_time = time.time()
        user, error_response = self._authenticate(require_auth=True)
        if error_response:
            return error_response
        
        try:
            partner = user.partner_id.commercial_partner_id or user.partner_id
            
            domain = [('partner_id', '=', partner.id)]
            
            projects = request.env['crm.lead'].sudo().search(domain, order='create_date DESC')
            
            result = []
            for project in projects:
                result.append({
                    'id': project.id,
                    'name': project.name or '',
                    'stage': project.stage_id.name if project.stage_id else '',
                    'expected_revenue': project.expected_revenue or 0.0,
                    'probability': project.probability or 0,
                    'create_date': project.create_date.isoformat() if project.create_date else None,
                })
            
            self._log_api_call('/api/v1/projects', 'GET', user.id, 200, start_time)
            return self._json_response(result, status=200)
        except Exception as e:
            self._log_api_call('/api/v1/projects', 'GET', user.id if user else None, 500, start_time)
            return self._json_response({'error': str(e)}, status=500)

    @http.route('/api/v1/projects/<int:project_id>', type='http', auth='none', methods=['GET', 'OPTIONS'], csrf=False)
    def get_project_detail(self, project_id, **kwargs):  # pylint: disable=unused-argument
        start_time = time.time()
        user, error_response = self._authenticate(require_auth=True)
        if error_response:
            return error_response
        
        try:
            project = request.env['crm.lead'].sudo().browse(project_id)
            if not project.exists():
                self._log_api_call(f'/api/v1/projects/{project_id}', 'GET', user.id, 404, start_time)
                return self._json_response({'error': 'Project not found'}, status=404)
            
            partner = user.partner_id.commercial_partner_id or user.partner_id
            if project.partner_id.id != partner.id:
                self._log_api_call(f'/api/v1/projects/{project_id}', 'GET', user.id, 403, start_time)
                return self._json_response({'error': 'Access denied'}, status=403)
            
            document_count = 0
            if hasattr(request.env, 'erpv6.library.document'):
                document_count = request.env['erpv6.library.document'].sudo().search_count([
                    ('project_id', '=', project.id)
                ])
            
            data = {
                'id': project.id,
                'name': project.name or '',
                'stage': project.stage_id.name if project.stage_id else '',
                'expected_revenue': project.expected_revenue or 0.0,
                'probability': project.probability or 0,
                'create_date': project.create_date.isoformat() if project.create_date else None,
                'description': project.description or '',
                'customer_email': project.contact_email or '',
                'customer_phone': project.contact_name or '',
                'user_id': project.user_id.name if project.user_id else '',
                'date_deadline': project.date_deadline.isoformat() if project.date_deadline else None,
                'document_count': document_count,
            }
            
            self._log_api_call(f'/api/v1/projects/{project_id}', 'GET', user.id, 200, start_time)
            return self._json_response(data, status=200)
        except Exception as e:
            self._log_api_call(f'/api/v1/projects/{project_id}', 'GET', user.id if user else None, 500, start_time)
            return self._json_response({'error': str(e)}, status=500)
