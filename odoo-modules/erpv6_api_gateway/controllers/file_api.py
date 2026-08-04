# pylint: disable=import-error
import base64
import time
from odoo import http
from odoo.http import request
from .main import APIBaseController


class FileAPIController(APIBaseController):

    @http.route('/api/v1/upload', type='http', auth='none', methods=['POST', 'OPTIONS'], csrf=False)
    def upload_file(self, **kwargs):  # pylint: disable=unused-argument
        start_time = time.time()
        user, error_response = self._authenticate(require_auth=True)
        if error_response:
            return error_response
        
        try:
            file_data = request.get_json(force=True, silent=True) or {}
            
            filename = file_data.get('filename', 'unknown')
            mimetype = file_data.get('mimetype', 'application/octet-stream')
            content_b64 = file_data.get('content', '')
            
            if not content_b64:
                raw_data = request.get_data()
                if raw_data:
                    content_b64 = base64.b64encode(raw_data).decode('utf-8')
                    filename = request.httprequest.headers.get('X-Filename', filename)
                    mimetype = request.httprequest.headers.get('Content-Type', mimetype)
            
            if not content_b64:
                self._log_api_call('/api/v1/upload', 'POST', user.id, 400, start_time)
                return self._json_response({'error': 'No file content provided'}, status=400)
            
            attachment = request.env['ir.attachment'].sudo().create({
                'name': filename,
                'datas': content_b64,
                'mimetype': mimetype,
                'res_model': 'erpv6.library.document',
                'res_id': False,
            })
            
            result = {
                'file_id': attachment.id,
                'filename': attachment.name,
                'size': attachment.file_size,
                'mimetype': attachment.mimetype,
            }
            
            self._log_api_call('/api/v1/upload', 'POST', user.id, 200, start_time)
            return self._json_response(result, status=200)
        except Exception as e:
            self._log_api_call('/api/v1/upload', 'POST', user.id if user else None, 500, start_time)
            return self._json_response({'error': str(e)}, status=500)

    @http.route('/api/v1/files/<int:file_id>/download', type='http', auth='none', methods=['GET', 'OPTIONS'], csrf=False)
    def download_file(self, file_id, **kwargs):  # pylint: disable=unused-argument
        start_time = time.time()
        user, error_response = self._authenticate(require_auth=True)
        if error_response:
            return error_response
        
        try:
            attachment = request.env['ir.attachment'].sudo().browse(file_id)
            if not attachment.exists():
                self._log_api_call(f'/api/v1/files/{file_id}/download', 'GET', user.id, 404, start_time)
                return self._json_response({'error': 'File not found'}, status=404)
            
            file_content = base64.b64decode(attachment.datas) if attachment.datas else b''
            
            headers = {
                'Content-Type': attachment.mimetype or 'application/octet-stream',
                'Content-Disposition': f'attachment; filename="{attachment.name}"',
                'Content-Length': len(file_content),
            }
            
            self._log_api_call(f'/api/v1/files/{file_id}/download', 'GET', user.id, 200, start_time)
            return request.make_response(file_content, headers=headers)
        except Exception as e:
            self._log_api_call(f'/api/v1/files/{file_id}/download', 'GET', user.id if user else None, 500, start_time)
            return self._json_response({'error': str(e)}, status=500)
