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
            file_data = request.get_json_data() or {}
            
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

    def _can_access_attachment(self, user, attachment):
        """08/10/2026 (C-security-audit-3bis, Q-FILE): dispatcher
        ownership su ir.attachment.

        Regole:
          1) admin/responsabile/chief -> True
          2) create_uid == user -> True
          3) res_model conosciuto -> risali al record collegato,
             applica check_record_access / _can_access_email
          4) res_model sconosciuto o res_id assente -> fallback
             create_uid (gia' coperto al punto 2); NIENTE accesso
             su attachment orfani senza create_uid match.

        Mai dare accesso completo su attachment orfani.
        """
        if not user or not user.id or not attachment or not attachment.id:
            return False
        if self._is_responsabile_o_admin(user):
            return True
        if attachment.create_uid and attachment.create_uid.id == user.id:
            return True
        # Dispatch per res_model
        rm = attachment.res_model or ''
        rid = attachment.res_id
        if not rm or not rid:
            return False
        try:
            if rm not in request.env:
                return False
            Rec = request.env[rm].sudo().browse(int(rid))
            if not Rec.exists():
                return False
            # Email log: usa _can_access_email (ha recipient_user_id)
            if rm in ('erpv6.winwin.email.log', 'erpv6.project.email.log'):
                if hasattr(self, '_can_access_email'):
                    return self._can_access_email(user, Rec)
                return False
            # Modelli con ownership diretta/relazione: prova check generico
            from odoo.addons.erpv6_api_gateway.controllers.lib.security import check_record_access
            if rm in ('calendar.event', 'erpv6.deal', 'erpv6.credit.portfolio',
                      'erpv6.credit.line', 'erpv6.tracking.relation'):
                return check_record_access(user, Rec, 'read')
            # Fallback generico: create_uid del record collegato
            if hasattr(Rec, 'create_uid') and Rec.create_uid and Rec.create_uid.id == user.id:
                return True
            # Se ha relation_id + access_user_ids, prova via relation
            if hasattr(Rec, 'relation_id') and Rec.relation_id:
                if user.id in (Rec.relation_id.access_user_ids.ids or []):
                    return True
            # Config/system: admin-only (gia' coperto da step 1)
            if rm in ('ir.ui.view', 'ir.module.module', 'ir.model', 'ir.model.fields'):
                return False
            return False
        except Exception:
            return False

    @http.route('/api/v1/files/<int:file_id>/download', type='http', auth='none', methods=['GET', 'OPTIONS'], csrf=False)
    def download_file(self, file_id, **kwargs):  # pylint: disable=unused-argument
        start_time = time.time()
        user, error_response = self._authenticate(require_auth=True)
        if error_response:
            return error_response
        request.update_env(user=user.id)
        
        try:
            attachment = request.env['ir.attachment'].sudo().browse(file_id)
            if not attachment.exists():
                self._log_api_call(f'/api/v1/files/{file_id}/download', 'GET', user.id, 404, start_time)
                return self._json_response({'error': 'File not found'}, status=404)
            # 08/10/2026 (C-security-audit-3bis): check ownership
            if not self._can_access_attachment(user, attachment):
                request.env['erpv6.api.access.log'].sudo().log_access(
                    user=user, route=request.httprequest.path,
                    method=request.httprequest.method,
                    model='ir.attachment', record_id=attachment.id,
                    granted=False, reason='denied_attachment_no_ownership',
                )
                self._log_api_call(f'/api/v1/files/{file_id}/download', 'GET', user.id, 403, start_time)
                return self._json_response({'error': 'Accesso negato'}, status=403)
            
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
