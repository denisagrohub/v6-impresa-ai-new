# pylint: disable=import-error
import time
from odoo import http
from odoo.http import request
from .main import APIBaseController


class MethodologyAPIController(APIBaseController):
    """API per Metodologie (Pareto, Kairós, 5S, Heinrich)"""

    # ==================== PARETO ANALYSIS ====================

    @http.route('/api/v1/methodology/pareto', type='http', auth='none', methods=['GET', 'OPTIONS'], csrf=False)
    def get_pareto_list(self, **kwargs):
        """
        GET /api/v1/methodology/pareto
        Lista analisi Pareto del tenant
        """
        start_time = time.time()
        user, error_response = self._authenticate(require_auth=True)
        if error_response:
            return error_response

        try:
            if 'erpv6.pareto.analysis' not in request.env:
                self._log_api_call('/api/v1/methodology/pareto', 'GET', user.id, 501, start_time)
                return self._json_response({'error': 'Methodology module not installed'}, status=501)

            partner = user.partner_id.commercial_partner_id or user.partner_id
            
            # Cerca analisi Pareto collegate a record del partner
            analyses = request.env['erpv6.pareto.analysis'].sudo().search([
                ('res_model', 'in', ['crm.lead', 'res.partner', 'sale.order']),
            ], order='create_date DESC')

            # Filtra per appartenenza al partner del tenant
            filtered_analyses = []
            for analysis in analyses:
                try:
                    if analysis.res_model == 'crm.lead':
                        record = request.env[analysis.res_model].sudo().browse(analysis.res_id)
                        if record.exists() and record.partner_id.commercial_partner_id.id == partner.id:
                            filtered_analyses.append(analysis)
                    elif analysis.res_model == 'res.partner':
                        record = request.env[analysis.res_model].sudo().browse(analysis.res_id)
                        if record.exists() and record.commercial_partner_id.id == partner.id:
                            filtered_analyses.append(analysis)
                    elif analysis.res_model == 'sale.order':
                        record = request.env[analysis.res_model].sudo().browse(analysis.res_id)
                        if record.exists() and record.partner_id.commercial_partner_id.id == partner.id:
                            filtered_analyses.append(analysis)
                except Exception:
                    pass

            result = []
            for analysis in filtered_analyses:
                items_data = []
                for item in analysis.item_ids:
                    items_data.append({
                        'id': item.id,
                        'name': item.name or '',
                        'frequenza': item.frequenza or 0,
                        'impatto': item.impatto or 0,
                        'punteggio': item.punteggio or 0,
                        'cumulata_pct': item.cumulata_pct or 0.0,
                        'is_priority': item.is_priority or False,
                    })

                result.append({
                    'id': analysis.id,
                    'name': analysis.name or '',
                    'res_model': analysis.res_model or '',
                    'res_id': analysis.res_id or 0,
                    'total_score': analysis.total_score or 0,
                    'priority_count': analysis.priority_count or 0,
                    'notes': analysis.notes or '',
                    'items': items_data,
                    'items_count': len(items_data),
                    'create_date': analysis.create_date.isoformat() if analysis.create_date else None,
                })

            self._log_api_call('/api/v1/methodology/pareto', 'GET', user.id, 200, start_time)
            return self._json_response(result, status=200)
        except Exception as e:
            self._log_api_call('/api/v1/methodology/pareto', 'GET', user.id if user else None, 500, start_time)
            return self._json_response({'error': str(e)}, status=500)

    @http.route('/api/v1/methodology/pareto/<int:pareto_id>', type='http', auth='none', methods=['GET', 'OPTIONS'], csrf=False)
    def get_pareto_detail(self, pareto_id, **kwargs):
        """
        GET /api/v1/methodology/pareto/<id>
        Dettaglio analisi con items
        """
        start_time = time.time()
        user, error_response = self._authenticate(require_auth=True)
        if error_response:
            return error_response

        try:
            if 'erpv6.pareto.analysis' not in request.env:
                self._log_api_call(f'/api/v1/methodology/pareto/{pareto_id}', 'GET', user.id, 501, start_time)
                return self._json_response({'error': 'Methodology module not installed'}, status=501)

            analysis = request.env['erpv6.pareto.analysis'].sudo().browse(pareto_id)
            if not analysis.exists():
                self._log_api_call(f'/api/v1/methodology/pareto/{pareto_id}', 'GET', user.id, 404, start_time)
                return self._json_response({'error': 'Pareto analysis not found'}, status=404)

            items_data = []
            for item in analysis.item_ids:
                items_data.append({
                    'id': item.id,
                    'name': item.name or '',
                    'frequenza': item.frequenza or 0,
                    'impatto': item.impatto or 0,
                    'punteggio': item.punteggio or 0,
                    'cumulata_pct': item.cumulata_pct or 0.0,
                    'is_priority': item.is_priority or False,
                })

            result = {
                'id': analysis.id,
                'name': analysis.name or '',
                'res_model': analysis.res_model or '',
                'res_id': analysis.res_id or 0,
                'total_score': analysis.total_score or 0,
                'priority_count': analysis.priority_count or 0,
                'notes': analysis.notes or '',
                'items': items_data,
                'create_date': analysis.create_date.isoformat() if analysis.create_date else None,
            }

            self._log_api_call(f'/api/v1/methodology/pareto/{pareto_id}', 'GET', user.id, 200, start_time)
            return self._json_response(result, status=200)
        except Exception as e:
            self._log_api_call(f'/api/v1/methodology/pareto/{pareto_id}', 'GET', user.id if user else None, 500, start_time)
            return self._json_response({'error': str(e)}, status=500)

    @http.route('/api/v1/methodology/pareto', type='http', auth='none', methods=['POST', 'OPTIONS'], csrf=False)
    def create_pareto_analysis(self, **kwargs):
        """
        POST /api/v1/methodology/pareto
        Crea nuova analisi (name, res_model, res_id)
        """
        start_time = time.time()
        user, error_response = self._authenticate(require_auth=True)
        if error_response:
            return error_response

        try:
            if 'erpv6.pareto.analysis' not in request.env:
                self._log_api_call('/api/v1/methodology/pareto', 'POST', user.id, 501, start_time)
                return self._json_response({'error': 'Methodology module not installed'}, status=501)

            data = request.get_json(force=True, silent=True) or {}
            
            vals = {
                'name': data.get('name', 'Nuova Analisi Pareto'),
                'res_model': data.get('res_model', ''),
                'res_id': data.get('res_id', 0),
                'notes': data.get('notes', ''),
            }

            analysis = request.env['erpv6.pareto.analysis'].sudo().create(vals)

            result = {
                'id': analysis.id,
                'name': analysis.name,
                'res_model': analysis.res_model,
                'res_id': analysis.res_id,
            }

            self._log_api_call('/api/v1/methodology/pareto', 'POST', user.id, 201, start_time)
            return self._json_response(result, status=201)
        except Exception as e:
            self._log_api_call('/api/v1/methodology/pareto', 'POST', user.id if user else None, 500, start_time)
            return self._json_response({'error': str(e)}, status=500)

    @http.route('/api/v1/methodology/pareto/<int:pareto_id>/compute', type='http', auth='none', methods=['POST', 'OPTIONS'], csrf=False)
    def compute_pareto(self, pareto_id, **kwargs):
        """
        POST /api/v1/methodology/pareto/<id>/compute
        Esegui calcolo Pareto
        """
        start_time = time.time()
        user, error_response = self._authenticate(require_auth=True)
        if error_response:
            return error_response

        try:
            if 'erpv6.pareto.analysis' not in request.env:
                self._log_api_call(f'/api/v1/methodology/pareto/{pareto_id}/compute', 'POST', user.id, 501, start_time)
                return self._json_response({'error': 'Methodology module not installed'}, status=501)

            analysis = request.env['erpv6.pareto.analysis'].sudo().browse(pareto_id)
            if not analysis.exists():
                self._log_api_call(f'/api/v1/methodology/pareto/{pareto_id}/compute', 'POST', user.id, 404, start_time)
                return self._json_response({'error': 'Pareto analysis not found'}, status=404)

            analysis.compute_pareto()

            result = {
                'id': analysis.id,
                'computed': True,
                'total_score': analysis.total_score,
                'priority_count': analysis.priority_count,
            }

            self._log_api_call(f'/api/v1/methodology/pareto/{pareto_id}/compute', 'POST', user.id, 200, start_time)
            return self._json_response(result, status=200)
        except Exception as e:
            self._log_api_call(f'/api/v1/methodology/pareto/{pareto_id}/compute', 'POST', user.id if user else None, 500, start_time)
            return self._json_response({'error': str(e)}, status=500)

    # ==================== KAIROS MATRIX ====================

    @http.route('/api/v1/methodology/kairos', type='http', auth='none', methods=['GET', 'OPTIONS'], csrf=False)
    def get_kairos_list(self, **kwargs):
        """
        GET /api/v1/methodology/kairos
        Lista matrici Kairós
        """
        start_time = time.time()
        user, error_response = self._authenticate(require_auth=True)
        if error_response:
            return error_response

        try:
            if 'erpv6.kairos.matrix' not in request.env:
                self._log_api_call('/api/v1/methodology/kairos', 'GET', user.id, 501, start_time)
                return self._json_response({'error': 'Methodology module not installed'}, status=501)

            matrices = request.env['erpv6.kairos.matrix'].sudo().search([], order='assessment_date DESC')

            result = []
            for matrix in matrices:
                result.append({
                    'id': matrix.id,
                    'name': matrix.name or '',
                    'matrix_type': matrix.matrix_type or '',
                    'res_model': matrix.res_model or '',
                    'res_id': matrix.res_id or 0,
                    'impatto_score': matrix.impatto_score or 0,
                    'impatto_level': matrix.impatto_level or '',
                    'prontezza_totale': matrix.prontezza_totale or 0,
                    'prontezza_level': matrix.prontezza_level or '',
                    'quadrante': matrix.quadrante or '',
                    'assessment_date': matrix.assessment_date.isoformat() if matrix.assessment_date else None,
                })

            self._log_api_call('/api/v1/methodology/kairos', 'GET', user.id, 200, start_time)
            return self._json_response(result, status=200)
        except Exception as e:
            self._log_api_call('/api/v1/methodology/kairos', 'GET', user.id if user else None, 500, start_time)
            return self._json_response({'error': str(e)}, status=500)

    @http.route('/api/v1/methodology/kairos/<int:kairos_id>', type='http', auth='none', methods=['GET', 'OPTIONS'], csrf=False)
    def get_kairos_detail(self, kairos_id, **kwargs):
        """
        GET /api/v1/methodology/kairos/<id>
        Dettaglio matrice
        """
        start_time = time.time()
        user, error_response = self._authenticate(require_auth=True)
        if error_response:
            return error_response

        try:
            if 'erpv6.kairos.matrix' not in request.env:
                self._log_api_call(f'/api/v1/methodology/kairos/{kairos_id}', 'GET', user.id, 501, start_time)
                return self._json_response({'error': 'Methodology module not installed'}, status=501)

            matrix = request.env['erpv6.kairos.matrix'].sudo().browse(kairos_id)
            if not matrix.exists():
                self._log_api_call(f'/api/v1/methodology/kairos/{kairos_id}', 'GET', user.id, 404, start_time)
                return self._json_response({'error': 'Kairos matrix not found'}, status=404)

            result = {
                'id': matrix.id,
                'name': matrix.name or '',
                'matrix_type': matrix.matrix_type or '',
                'res_model': matrix.res_model or '',
                'res_id': matrix.res_id or 0,
                'impatto_score': matrix.impatto_score or 0,
                'impatto_level': matrix.impatto_level or '',
                'indicatore_1': matrix.indicatore_1 or 0,
                'indicatore_2': matrix.indicatore_2 or 0,
                'indicatore_3': matrix.indicatore_3 or 0,
                'indicatore_4': matrix.indicatore_4 or 0,
                'indicatore_5': matrix.indicatore_5 or 0,
                'prontezza_totale': matrix.prontezza_totale or 0,
                'prontezza_level': matrix.prontezza_level or '',
                'quadrante': matrix.quadrante or '',
                'assessment_date': matrix.assessment_date.isoformat() if matrix.assessment_date else None,
                'notes': matrix.notes or '',
            }

            self._log_api_call(f'/api/v1/methodology/kairos/{kairos_id}', 'GET', user.id, 200, start_time)
            return self._json_response(result, status=200)
        except Exception as e:
            self._log_api_call(f'/api/v1/methodology/kairos/{kairos_id}', 'GET', user.id if user else None, 500, start_time)
            return self._json_response({'error': str(e)}, status=500)

    @http.route('/api/v1/methodology/kairos', type='http', auth='none', methods=['POST', 'OPTIONS'], csrf=False)
    def create_kairos_matrix(self, **kwargs):
        """
        POST /api/v1/methodology/kairos
        Crea nuova matrice (matrix_type, res_model, res_id, impatto_score, indicatori 1-5)
        """
        start_time = time.time()
        user, error_response = self._authenticate(require_auth=True)
        if error_response:
            return error_response

        try:
            if 'erpv6.kairos.matrix' not in request.env:
                self._log_api_call('/api/v1/methodology/kairos', 'POST', user.id, 501, start_time)
                return self._json_response({'error': 'Methodology module not installed'}, status=501)

            data = request.get_json(force=True, silent=True) or {}
            
            vals = {
                'matrix_type': data.get('matrix_type', 'organizzativo'),
                'res_model': data.get('res_model', ''),
                'res_id': data.get('res_id', 0),
                'impatto_score': data.get('impatto_score', 3),
                'indicatore_1': data.get('indicatore_1', 2),
                'indicatore_2': data.get('indicatore_2', 2),
                'indicatore_3': data.get('indicatore_3', 2),
                'indicatore_4': data.get('indicatore_4', 2),
                'indicatore_5': data.get('indicatore_5', 2),
                'notes': data.get('notes', ''),
            }

            matrix = request.env['erpv6.kairos.matrix'].sudo().create(vals)

            result = {
                'id': matrix.id,
                'name': matrix.name,
                'matrix_type': matrix.matrix_type,
                'quadrante': matrix.quadrante,
            }

            self._log_api_call('/api/v1/methodology/kairos', 'POST', user.id, 201, start_time)
            return self._json_response(result, status=201)
        except Exception as e:
            self._log_api_call('/api/v1/methodology/kairos', 'POST', user.id if user else None, 500, start_time)
            return self._json_response({'error': str(e)}, status=500)

    # ==================== MATRIX 5S ====================

    @http.route('/api/v1/methodology/5s', type='http', auth='none', methods=['GET', 'OPTIONS'], csrf=False)
    def get_5s_list(self, **kwargs):
        """
        GET /api/v1/methodology/5s
        Lista assessment 5S
        """
        start_time = time.time()
        user, error_response = self._authenticate(require_auth=True)
        if error_response:
            return error_response

        try:
            if 'erpv6.matrix5s.assessment' not in request.env:
                self._log_api_call('/api/v1/methodology/5s', 'GET', user.id, 501, start_time)
                return self._json_response({'error': 'Methodology module not installed'}, status=501)

            assessments = request.env['erpv6.matrix5s.assessment'].sudo().search([], order='create_date DESC')

            result = []
            for assessment in assessments:
                lines_data = []
                for line in assessment.line_ids:
                    lines_data.append({
                        'id': line.id,
                        'fase': line.fase or '',
                        'azione_tipica': line.azione_tipica or '',
                        'spreco_identificato': line.spreco_identificato or '',
                        'guadagno_potenziale': line.guadagno_potenziale or '',
                    })

                result.append({
                    'id': assessment.id,
                    'name': assessment.name or '',
                    'area': assessment.area or '',
                    'res_model': assessment.res_model or '',
                    'res_id': assessment.res_id or 0,
                    'lines': lines_data,
                    'lines_count': len(lines_data),
                })

            self._log_api_call('/api/v1/methodology/5s', 'GET', user.id, 200, start_time)
            return self._json_response(result, status=200)
        except Exception as e:
            self._log_api_call('/api/v1/methodology/5s', 'GET', user.id if user else None, 500, start_time)
            return self._json_response({'error': str(e)}, status=500)

    @http.route('/api/v1/methodology/5s/<int:assessment_id>', type='http', auth='none', methods=['GET', 'OPTIONS'], csrf=False)
    def get_5s_detail(self, assessment_id, **kwargs):
        """
        GET /api/v1/methodology/5s/<id>
        Dettaglio assessment con lines
        """
        start_time = time.time()
        user, error_response = self._authenticate(require_auth=True)
        if error_response:
            return error_response

        try:
            if 'erpv6.matrix5s.assessment' not in request.env:
                self._log_api_call(f'/api/v1/methodology/5s/{assessment_id}', 'GET', user.id, 501, start_time)
                return self._json_response({'error': 'Methodology module not installed'}, status=501)

            assessment = request.env['erpv6.matrix5s.assessment'].sudo().browse(assessment_id)
            if not assessment.exists():
                self._log_api_call(f'/api/v1/methodology/5s/{assessment_id}', 'GET', user.id, 404, start_time)
                return self._json_response({'error': '5S assessment not found'}, status=404)

            lines_data = []
            for line in assessment.line_ids:
                lines_data.append({
                    'id': line.id,
                    'fase': line.fase or '',
                    'azione_tipica': line.azione_tipica or '',
                    'spreco_identificato': line.spreco_identificato or '',
                    'guadagno_potenziale': line.guadagno_potenziale or '',
                })

            result = {
                'id': assessment.id,
                'name': assessment.name or '',
                'area': assessment.area or '',
                'res_model': assessment.res_model or '',
                'res_id': assessment.res_id or 0,
                'lines': lines_data,
            }

            self._log_api_call(f'/api/v1/methodology/5s/{assessment_id}', 'GET', user.id, 200, start_time)
            return self._json_response(result, status=200)
        except Exception as e:
            self._log_api_call(f'/api/v1/methodology/5s/{assessment_id}', 'GET', user.id if user else None, 500, start_time)
            return self._json_response({'error': str(e)}, status=500)

    @http.route('/api/v1/methodology/5s', type='http', auth='none', methods=['POST', 'OPTIONS'], csrf=False)
    def create_5s_assessment(self, **kwargs):
        """
        POST /api/v1/methodology/5s
        Crea nuovo assessment (res_model, res_id, area)
        """
        start_time = time.time()
        user, error_response = self._authenticate(require_auth=True)
        if error_response:
            return error_response

        try:
            if 'erpv6.matrix5s.assessment' not in request.env:
                self._log_api_call('/api/v1/methodology/5s', 'POST', user.id, 501, start_time)
                return self._json_response({'error': 'Methodology module not installed'}, status=501)

            data = request.get_json(force=True, silent=True) or {}
            
            vals = {
                'res_model': data.get('res_model', ''),
                'res_id': data.get('res_id', 0),
                'area': data.get('area', 'Area Generica'),
            }

            assessment = request.env['erpv6.matrix5s.assessment'].sudo().create(vals)

            result = {
                'id': assessment.id,
                'name': assessment.name,
                'area': assessment.area,
            }

            self._log_api_call('/api/v1/methodology/5s', 'POST', user.id, 201, start_time)
            return self._json_response(result, status=201)
        except Exception as e:
            self._log_api_call('/api/v1/methodology/5s', 'POST', user.id if user else None, 500, start_time)
            return self._json_response({'error': str(e)}, status=500)

    # ==================== HEINRICH INDICATOR ====================

    @http.route('/api/v1/methodology/heinrich', type='http', auth='none', methods=['GET', 'OPTIONS'], csrf=False)
    def get_heinrich_list(self, **kwargs):
        """
        GET /api/v1/methodology/heinrich
        Lista indicatori Heinrich
        """
        start_time = time.time()
        user, error_response = self._authenticate(require_auth=True)
        if error_response:
            return error_response

        try:
            if 'erpv6.heinrich.indicator' not in request.env:
                self._log_api_call('/api/v1/methodology/heinrich', 'GET', user.id, 501, start_time)
                return self._json_response({'error': 'Methodology module not installed'}, status=501)

            indicators = request.env['erpv6.heinrich.indicator'].sudo().search([], order='create_date DESC')

            result = []
            for indicator in indicators:
                result.append({
                    'id': indicator.id,
                    'res_model': indicator.res_model or '',
                    'res_id': indicator.res_id or 0,
                    'near_miss_segnalati': indicator.near_miss_segnalati or 0,
                    'problemi_lievi': indicator.problemi_lievi or 0,
                    'eventi_gravi': indicator.eventi_gravi or 0,
                    'cultura_organizzativa': indicator.cultura_organizzativa or '',
                    'note': indicator.note or '',
                })

            self._log_api_call('/api/v1/methodology/heinrich', 'GET', user.id, 200, start_time)
            return self._json_response(result, status=200)
        except Exception as e:
            self._log_api_call('/api/v1/methodology/heinrich', 'GET', user.id if user else None, 500, start_time)
            return self._json_response({'error': str(e)}, status=500)

    @http.route('/api/v1/methodology/heinrich', type='http', auth='none', methods=['POST', 'OPTIONS'], csrf=False)
    def create_heinrich_indicator(self, **kwargs):
        """
        POST /api/v1/methodology/heinrich
        Crea nuovo indicatore (res_model, res_id, near_miss_segnalati, problemi_lievi, eventi_gravi)
        """
        start_time = time.time()
        user, error_response = self._authenticate(require_auth=True)
        if error_response:
            return error_response

        try:
            if 'erpv6.heinrich.indicator' not in request.env:
                self._log_api_call('/api/v1/methodology/heinrich', 'POST', user.id, 501, start_time)
                return self._json_response({'error': 'Methodology module not installed'}, status=501)

            data = request.get_json(force=True, silent=True) or {}
            
            vals = {
                'res_model': data.get('res_model', ''),
                'res_id': data.get('res_id', 0),
                'near_miss_segnalati': data.get('near_miss_segnalati', 0),
                'problemi_lievi': data.get('problemi_lievi', 0),
                'eventi_gravi': data.get('eventi_gravi', 0),
                'note': data.get('note', ''),
            }

            indicator = request.env['erpv6.heinrich.indicator'].sudo().create(vals)

            result = {
                'id': indicator.id,
                'cultura_organizzativa': indicator.cultura_organizzativa,
            }

            self._log_api_call('/api/v1/methodology/heinrich', 'POST', user.id, 201, start_time)
            return self._json_response(result, status=201)
        except Exception as e:
            self._log_api_call('/api/v1/methodology/heinrich', 'POST', user.id if user else None, 500, start_time)
            return self._json_response({'error': str(e)}, status=500)
