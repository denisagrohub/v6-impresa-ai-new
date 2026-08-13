# pylint: disable=import-error
import time
from odoo import http
from odoo.http import request
from .main import APIBaseController


class BandiAPIController(APIBaseController):
    """API per Bandi di Finanziamento"""

    @http.route('/api/v1/bandi/active', type='http', auth='none', methods=['GET', 'OPTIONS'], csrf=False)
    def get_active_bandi(self, **kwargs):
        """
        GET /api/v1/bandi/active
        Lista bandi attivi (già esistente in erpv6_bandi/controllers/bandi_api.py)
        """
        start_time = time.time()
        user, error_response = self._authenticate(require_auth=True)
        if error_response:
            return error_response

        try:
            if 'erpv6.bando' not in request.env:
                self._log_api_call('/api/v1/bandi/active', 'GET', user.id, 501, start_time)
                return self._json_response({'error': 'Bandi module not installed'}, status=501)

            bandi = request.env['erpv6.bando'].sudo().search([
                ('status', '=', 'active')
            ], order='scadenza_domanda ASC')

            result = []
            for bando in bandi:
                best_score = 0
                if bando.match_ids:
                    best_score = max(bando.match_ids.mapped('eligibility_score'))
                
                result.append({
                    'id': bando.id,
                    'name': bando.name or '',
                    'code': bando.code or '',
                    'ente': bando.ente or '',
                    'importo_max': bando.importo_max or 0.0,
                    'scadenza_domanda': bando.scadenza_domanda.isoformat() if bando.scadenza_domanda else None,
                    'tipo_agevolazione': bando.tipo_agevolazione or '',
                    'match_count': bando.match_count or 0,
                    'best_score': best_score,
                })

            self._log_api_call('/api/v1/bandi/active', 'GET', user.id, 200, start_time)
            return self._json_response(result, status=200)
        except Exception as e:
            self._log_api_call('/api/v1/bandi/active', 'GET', user.id if user else None, 500, start_time)
            return self._json_response({'error': str(e)}, status=500)

    @http.route('/api/v1/bandi/match', type='http', auth='none', methods=['GET', 'OPTIONS'], csrf=False)
    def get_bandi_match(self, **kwargs):
        """
        GET /api/v1/bandi/match
        Lista match bandi-cliente (partner_id opzionale)
        """
        start_time = time.time()
        user, error_response = self._authenticate(require_auth=True)
        if error_response:
            return error_response

        try:
            if 'erpv6.bando.match' not in request.env:
                self._log_api_call('/api/v1/bandi/match', 'GET', user.id, 501, start_time)
                return self._json_response({'error': 'Bandi module not installed'}, status=501)

            partner_id = kwargs.get('partner_id')
            
            domain = []
            if partner_id:
                domain.append(('partner_id', '=', int(partner_id)))

            matches = request.env['erpv6.bando.match'].sudo().search(domain, order='eligibility_score DESC')

            result = []
            for match in matches:
                result.append({
                    'id': match.id,
                    'bando_id': match.bando_id.id if match.bando_id else None,
                    'bando_name': match.bando_id.name if match.bando_id else '',
                    'partner_id': match.partner_id.id if match.partner_id else None,
                    'partner_name': match.partner_id.name if match.partner_id else '',
                    'project_id': match.project_id.id if match.project_id else None,
                    'eligibility_score': match.eligibility_score or 0.0,
                    'eligibility_level': match.eligibility_level or '',
                    'motivi_compatibilita': match.motivi_compatibilita or '',
                    'motivi_esclusione': match.motivi_esclusione or '',
                    'importo_stimato': match.importo_stimato or 0.0,
                    'status': match.status or 'new',
                    'consultant_id': match.consultant_id.id if match.consultant_id else None,
                    'deadline_interna': match.deadline_interna.isoformat() if match.deadline_interna else None,
                })

            self._log_api_call('/api/v1/bandi/match', 'GET', user.id, 200, start_time)
            return self._json_response(result, status=200)
        except Exception as e:
            self._log_api_call('/api/v1/bandi/match', 'GET', user.id if user else None, 500, start_time)
            return self._json_response({'error': str(e)}, status=500)

    @http.route('/api/v1/bandi/applications', type='http', auth='none', methods=['GET', 'OPTIONS'], csrf=False)
    def get_applications_list(self, **kwargs):
        """
        GET /api/v1/bandi/applications
        Lista candidature
        """
        start_time = time.time()
        user, error_response = self._authenticate(require_auth=True)
        if error_response:
            return error_response

        try:
            if 'erpv6.bando.application' not in request.env:
                self._log_api_call('/api/v1/bandi/applications', 'GET', user.id, 501, start_time)
                return self._json_response({'error': 'Bandi module not installed'}, status=501)

            applications = request.env['erpv6.bando.application'].sudo().search([], order='application_date DESC')

            result = []
            for app in applications:
                result.append({
                    'id': app.id,
                    'match_id': app.match_id.id if app.match_id else None,
                    'bando_id': app.bando_id.id if app.bando_id else None,
                    'bando_name': app.bando_id.name if app.bando_id else '',
                    'partner_id': app.partner_id.id if app.partner_id else None,
                    'application_date': app.application_date.isoformat() if app.application_date else None,
                    'reference_number': app.reference_number or '',
                    'amount_requested': app.amount_requested or 0.0,
                    'status': app.status or 'draft',
                    'funded_amount': app.funded_amount or 0.0,
                })

            self._log_api_call('/api/v1/bandi/applications', 'GET', user.id, 200, start_time)
            return self._json_response(result, status=200)
        except Exception as e:
            self._log_api_call('/api/v1/bandi/applications', 'GET', user.id if user else None, 500, start_time)
            return self._json_response({'error': str(e)}, status=500)

    @http.route('/api/v1/bandi/applications', type='http', auth='none', methods=['POST', 'OPTIONS'], csrf=False)
    def create_application(self, **kwargs):
        """
        POST /api/v1/bandi/applications
        Crea nuova candidatura (match_id)
        """
        start_time = time.time()
        user, error_response = self._authenticate(require_auth=True)
        if error_response:
            return error_response

        try:
            if 'erpv6.bando.application' not in request.env:
                self._log_api_call('/api/v1/bandi/applications', 'POST', user.id, 501, start_time)
                return self._json_response({'error': 'Bandi module not installed'}, status=501)

            data = request.get_json(force=True, silent=True) or {}
            
            match_id = data.get('match_id')
            if not match_id:
                self._log_api_call('/api/v1/bandi/applications', 'POST', user.id, 400, start_time)
                return self._json_response({'error': 'match_id required'}, status=400)

            match = request.env['erpv6.bando.match'].sudo().browse(match_id)
            if not match.exists():
                self._log_api_call('/api/v1/bandi/applications', 'POST', user.id, 404, start_time)
                return self._json_response({'error': 'Match not found'}, status=404)

            application = request.env['erpv6.bando.application'].sudo().create({
                'match_id': match.id,
                'status': 'draft',
            })

            result = {
                'id': application.id,
                'status': application.status,
                'message': 'Candidatura creata con successo',
            }

            self._log_api_call('/api/v1/bandi/applications', 'POST', user.id, 201, start_time)
            return self._json_response(result, status=201)
        except Exception as e:
            self._log_api_call('/api/v1/bandi/applications', 'POST', user.id if user else None, 500, start_time)
            return self._json_response({'error': str(e)}, status=500)

    @http.route('/api/v1/bandi/dashboard', type='http', auth='none', methods=['GET', 'OPTIONS'], csrf=False)
    def get_bandi_dashboard(self, **kwargs):
        """
        GET /api/v1/bandi/dashboard
        Statistiche bandi (già esistente, verifica)
        """
        start_time = time.time()
        user, error_response = self._authenticate(require_auth=True)
        if error_response:
            return error_response

        try:
            if 'erpv6.bando' not in request.env:
                self._log_api_call('/api/v1/bandi/dashboard', 'GET', user.id, 501, start_time)
                return self._json_response({'error': 'Bandi module not installed'}, status=501)

            bando_obj = request.env['erpv6.bando'].sudo()
            match_obj = request.env['erpv6.bando.match'].sudo()
            application_obj = request.env['erpv6.bando.application'].sudo()
            
            active_bandi = bando_obj.search_count([('status', '=', 'active')])
            high_score_matches = match_obj.search_count([('eligibility_score', '>', 70)])
            submitted_applications = application_obj.search_count([('status', '=', 'submitted')])
            funded_applications = application_obj.search([('status', '=', 'funded')])
            total_funded = sum(funded_applications.mapped('funded_amount'))

            result = {
                'active_bandi': active_bandi,
                'high_score_matches': high_score_matches,
                'submitted_applications': submitted_applications,
                'total_funded': total_funded,
            }

            self._log_api_call('/api/v1/bandi/dashboard', 'GET', user.id, 200, start_time)
            return self._json_response(result, status=200)
        except Exception as e:
            self._log_api_call('/api/v1/bandi/dashboard', 'GET', user.id if user else None, 500, start_time)
            return self._json_response({'error': str(e)}, status=500)
