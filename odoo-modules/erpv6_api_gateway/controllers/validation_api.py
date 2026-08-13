# pylint: disable=import-error
import time
from odoo import http
from odoo.http import request
from .main import APIBaseController


class ValidationAPIController(APIBaseController):
    """API per Validazione 6 Giudici"""

    @http.route('/api/v1/validation/sessions', type='http', auth='none', methods=['GET', 'OPTIONS'], csrf=False)
    def get_validation_sessions(self, **kwargs):
        """
        GET /api/v1/validation/sessions
        Lista sessioni validazione
        """
        start_time = time.time()
        user, error_response = self._authenticate(require_auth=True)
        if error_response:
            return error_response

        try:
            if 'erpv6.validation.session' not in request.env:
                self._log_api_call('/api/v1/validation/sessions', 'GET', user.id, 501, start_time)
                return self._json_response({'error': 'Validation module not installed'}, status=501)

            sessions = request.env['erpv6.validation.session'].sudo().search([], order='create_date DESC')

            result = []
            for session in sessions:
                result.append({
                    'id': session.id,
                    'res_model': session.res_model or '',
                    'res_id': session.res_id or 0,
                    'destinatario': session.destinatario or '',
                    'scopo': session.scopo or '',
                    'validation_mode': session.validation_mode or '',
                    'status': session.status or 'draft',
                    'max_rounds': session.max_rounds or 5,
                    'current_round_number': session.current_round_number or 0,
                    'human_reviewer_id': session.human_reviewer_id.id if session.human_reviewer_id else None,
                    'human_reviewed_at': session.human_reviewed_at.isoformat() if session.human_reviewed_at else None,
                })

            self._log_api_call('/api/v1/validation/sessions', 'GET', user.id, 200, start_time)
            return self._json_response(result, status=200)
        except Exception as e:
            self._log_api_call('/api/v1/validation/sessions', 'GET', user.id if user else None, 500, start_time)
            return self._json_response({'error': str(e)}, status=500)

    @http.route('/api/v1/validation/sessions/<int:session_id>', type='http', auth='none', methods=['GET', 'OPTIONS'], csrf=False)
    def get_validation_session_detail(self, session_id, **kwargs):
        """
        GET /api/v1/validation/sessions/<id>
        Dettaglio sessione con rounds e analysis
        """
        start_time = time.time()
        user, error_response = self._authenticate(require_auth=True)
        if error_response:
            return error_response

        try:
            if 'erpv6.validation.session' not in request.env:
                self._log_api_call(f'/api/v1/validation/sessions/{session_id}', 'GET', user.id, 501, start_time)
                return self._json_response({'error': 'Validation module not installed'}, status=501)

            session = request.env['erpv6.validation.session'].sudo().browse(session_id)
            if not session.exists():
                self._log_api_call(f'/api/v1/validation/sessions/{session_id}', 'GET', user.id, 404, start_time)
                return self._json_response({'error': 'Session not found'}, status=404)

            rounds_data = []
            for round_obj in session.round_ids:
                analyses_data = []
                for analysis in round_obj.analysis_ids:
                    analyses_data.append({
                        'id': analysis.id,
                        'analyst_index': analysis.analyst_index or '',
                        'findings': analysis.findings or '',
                        'claims_checked': analysis.claims_checked or [],
                        'flagged_missing_data': analysis.flagged_missing_data or '',
                    })

                rounds_data.append({
                    'id': round_obj.id,
                    'round_number': round_obj.round_number or 0,
                    'issues_found': round_obj.issues_found or 0,
                    'sesto_uomo_notes': round_obj.sesto_uomo_notes or '',
                    'corrected_material': round_obj.corrected_material or {},
                    'analyses': analyses_data,
                })

            result = {
                'id': session.id,
                'res_model': session.res_model or '',
                'res_id': session.res_id or 0,
                'destinatario': session.destinatario or '',
                'scopo': session.scopo or '',
                'context_data': session.context_data or {},
                'validation_mode': session.validation_mode or '',
                'status': session.status or 'draft',
                'max_rounds': session.max_rounds or 5,
                'current_round_number': session.current_round_number or 0,
                'human_reviewer_id': session.human_reviewer_id.id if session.human_reviewer_id else None,
                'human_reviewed_at': session.human_reviewed_at.isoformat() if session.human_reviewed_at else None,
                'human_notes': session.human_notes or '',
                'rounds': rounds_data,
            }

            self._log_api_call(f'/api/v1/validation/sessions/{session_id}', 'GET', user.id, 200, start_time)
            return self._json_response(result, status=200)
        except Exception as e:
            self._log_api_call(f'/api/v1/validation/sessions/{session_id}', 'GET', user.id if user else None, 500, start_time)
            return self._json_response({'error': str(e)}, status=500)

    @http.route('/api/v1/validation/sessions', type='http', auth='none', methods=['POST', 'OPTIONS'], csrf=False)
    def create_validation_session(self, **kwargs):
        """
        POST /api/v1/validation/sessions
        Crea nuova sessione (res_model, res_id, destinatario, scopo, context_data, validation_mode, max_rounds)
        """
        start_time = time.time()
        user, error_response = self._authenticate(require_auth=True)
        if error_response:
            return error_response

        try:
            if 'erpv6.validation.session' not in request.env:
                self._log_api_call('/api/v1/validation/sessions', 'POST', user.id, 501, start_time)
                return self._json_response({'error': 'Validation module not installed'}, status=501)

            data = request.get_json_data() or {}
            
            vals = {
                'res_model': data.get('res_model', ''),
                'res_id': data.get('res_id', 0),
                'destinatario': data.get('destinatario', ''),
                'scopo': data.get('scopo', ''),
                'context_data': data.get('context_data', {}),
                'validation_mode': data.get('validation_mode', 'full_six_judges'),
                'max_rounds': data.get('max_rounds', 5),
            }

            session = request.env['erpv6.validation.session'].sudo().create(vals)

            result = {
                'id': session.id,
                'status': session.status,
                'validation_mode': session.validation_mode,
            }

            self._log_api_call('/api/v1/validation/sessions', 'POST', user.id, 201, start_time)
            return self._json_response(result, status=201)
        except Exception as e:
            self._log_api_call('/api/v1/validation/sessions', 'POST', user.id if user else None, 500, start_time)
            return self._json_response({'error': str(e)}, status=500)

    @http.route('/api/v1/validation/sessions/<int:session_id>/start', type='http', auth='none', methods=['POST', 'OPTIONS'], csrf=False)
    def start_validation_session(self, session_id, **kwargs):
        """
        POST /api/v1/validation/sessions/<id>/start
        Avvia validazione
        """
        start_time = time.time()
        user, error_response = self._authenticate(require_auth=True)
        if error_response:
            return error_response

        try:
            if 'erpv6.validation.session' not in request.env:
                self._log_api_call(f'/api/v1/validation/sessions/{session_id}/start', 'POST', user.id, 501, start_time)
                return self._json_response({'error': 'Validation module not installed'}, status=501)

            session = request.env['erpv6.validation.session'].sudo().browse(session_id)
            if not session.exists():
                self._log_api_call(f'/api/v1/validation/sessions/{session_id}/start', 'POST', user.id, 404, start_time)
                return self._json_response({'error': 'Session not found'}, status=404)

            session.action_start_validation()

            result = {
                'id': session.id,
                'status': session.status,
                'current_round_number': session.current_round_number,
            }

            self._log_api_call(f'/api/v1/validation/sessions/{session_id}/start', 'POST', user.id, 200, start_time)
            return self._json_response(result, status=200)
        except Exception as e:
            self._log_api_call(f'/api/v1/validation/sessions/{session_id}/start', 'POST', user.id if user else None, 500, start_time)
            return self._json_response({'error': str(e)}, status=500)

    @http.route('/api/v1/validation/sessions/<int:session_id>/approve', type='http', auth='none', methods=['POST', 'OPTIONS'], csrf=False)
    def approve_validation_session(self, session_id, **kwargs):
        """
        POST /api/v1/validation/sessions/<id>/approve
        Approva sessione
        """
        start_time = time.time()
        user, error_response = self._authenticate(require_auth=True)
        if error_response:
            return error_response

        try:
            if 'erpv6.validation.session' not in request.env:
                self._log_api_call(f'/api/v1/validation/sessions/{session_id}/approve', 'POST', user.id, 501, start_time)
                return self._json_response({'error': 'Validation module not installed'}, status=501)

            session = request.env['erpv6.validation.session'].sudo().browse(session_id)
            if not session.exists():
                self._log_api_call(f'/api/v1/validation/sessions/{session_id}/approve', 'POST', user.id, 404, start_time)
                return self._json_response({'error': 'Session not found'}, status=404)

            session.action_human_approve()

            result = {
                'id': session.id,
                'status': session.status,
                'human_reviewed_at': session.human_reviewed_at.isoformat() if session.human_reviewed_at else None,
            }

            self._log_api_call(f'/api/v1/validation/sessions/{session_id}/approve', 'POST', user.id, 200, start_time)
            return self._json_response(result, status=200)
        except Exception as e:
            self._log_api_call(f'/api/v1/validation/sessions/{session_id}/approve', 'POST', user.id if user else None, 500, start_time)
            return self._json_response({'error': str(e)}, status=500)

    @http.route('/api/v1/validation/sessions/<int:session_id>/reject', type='http', auth='none', methods=['POST', 'OPTIONS'], csrf=False)
    def reject_validation_session(self, session_id, **kwargs):
        """
        POST /api/v1/validation/sessions/<id>/reject
        Rifiuta sessione (reason opzionale)
        """
        start_time = time.time()
        user, error_response = self._authenticate(require_auth=True)
        if error_response:
            return error_response

        try:
            if 'erpv6.validation.session' not in request.env:
                self._log_api_call(f'/api/v1/validation/sessions/{session_id}/reject', 'POST', user.id, 501, start_time)
                return self._json_response({'error': 'Validation module not installed'}, status=501)

            data = request.get_json_data() or {}
            reason = data.get('reason', '')

            session = request.env['erpv6.validation.session'].sudo().browse(session_id)
            if not session.exists():
                self._log_api_call(f'/api/v1/validation/sessions/{session_id}/reject', 'POST', user.id, 404, start_time)
                return self._json_response({'error': 'Session not found'}, status=404)

            session.action_human_reject(reason=reason)

            result = {
                'id': session.id,
                'status': session.status,
                'human_notes': session.human_notes or '',
            }

            self._log_api_call(f'/api/v1/validation/sessions/{session_id}/reject', 'POST', user.id, 200, start_time)
            return self._json_response(result, status=200)
        except Exception as e:
            self._log_api_call(f'/api/v1/validation/sessions/{session_id}/reject', 'POST', user.id if user else None, 500, start_time)
            return self._json_response({'error': str(e)}, status=500)
