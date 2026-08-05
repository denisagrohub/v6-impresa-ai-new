# pylint: disable=import-error
import time
from odoo import http
from odoo.http import request
from .main import APIBaseController


class AccountingAPIController(APIBaseController):
    """API per Contabilità Predittiva"""

    @http.route('/api/v1/accounting/prediction', type='http', auth='none', methods=['GET', 'OPTIONS'], csrf=False)
    def get_fiscal_prediction(self, **kwargs):
        """
        GET /api/v1/accounting/prediction
        Previsione fiscale (partner_id opzionale)
        """
        start_time = time.time()
        user, error_response = self._authenticate(require_auth=True)
        if error_response:
            return error_response

        try:
            if not hasattr(request.env, 'erpv6.fiscal.prediction'):
                self._log_api_call('/api/v1/accounting/prediction', 'GET', user.id, 501, start_time)
                return self._json_response({'error': 'Accounting module not installed'}, status=501)

            partner_id = kwargs.get('partner_id')
            company_id = request.env.company.id
            
            domain = [('company_id', '=', company_id)]
            if partner_id:
                domain.append(('partner_id', '=', int(partner_id)))

            prediction = request.env['erpv6.fiscal.prediction'].sudo().search(
                domain, order='date desc', limit=1
            )

            if not prediction:
                # Crea nuova previsione se non esiste
                vals = {'company_id': company_id}
                if partner_id:
                    vals['partner_id'] = int(partner_id)
                prediction = request.env['erpv6.fiscal.prediction'].sudo().create(vals)
                prediction.action_calculate()

            result = {
                'id': prediction.id,
                'date': prediction.date.isoformat() if prediction.date else None,
                'fiscal_year': prediction.fiscal_year or '',
                'revenue_ytd': prediction.revenue_ytd or 0.0,
                'revenue_forecast': prediction.revenue_forecast or 0.0,
                'predicted_iva': prediction.predicted_iva or 0.0,
                'predicted_ires': prediction.predicted_ires or 0.0,
                'predicted_irap': prediction.predicted_irap or 0.0,
                'predicted_total': prediction.predicted_total or 0.0,
                'potential_savings': prediction.potential_savings or 0.0,
                'optimized_total': prediction.optimized_total or 0.0,
                'savings_percentage': prediction.savings_percentage or 0.0,
                'kairos_score': prediction.kairos_score or 0,
                'kairos_level': prediction.kairos_level or '',
            }

            self._log_api_call('/api/v1/accounting/prediction', 'GET', user.id, 200, start_time)
            return self._json_response(result, status=200)
        except Exception as e:
            self._log_api_call('/api/v1/accounting/prediction', 'GET', user.id if user else None, 500, start_time)
            return self._json_response({'error': str(e)}, status=500)

    @http.route('/api/v1/accounting/suggestions', type='http', auth='none', methods=['GET', 'OPTIONS'], csrf=False)
    def get_deduction_suggestions(self, **kwargs):
        """
        GET /api/v1/accounting/suggestions
        Suggerimenti deduzioni
        """
        start_time = time.time()
        user, error_response = self._authenticate(require_auth=True)
        if error_response:
            return error_response

        try:
            if not hasattr(request.env, 'erpv6.deduction.suggestion'):
                self._log_api_call('/api/v1/accounting/suggestions', 'GET', user.id, 501, start_time)
                return self._json_response({'error': 'Accounting module not installed'}, status=501)

            company_id = request.env.company.id
            
            suggestions = request.env['erpv6.deduction.suggestion'].sudo().search([
                ('company_id', '=', company_id),
                ('status', '=', 'available'),
            ])

            result = []
            for s in suggestions:
                result.append({
                    'id': s.id,
                    'category': s.category or '',
                    'max_deductible': s.max_deductible or 0.0,
                    'current_in_stock': s.current_in_stock or 0.0,
                    'suggested_purchase': s.suggested_purchase or 0.0,
                    'tax_savings': s.tax_savings or 0.0,
                    'priority': s.priority or 'medium',
                    'stock_quantity': s.stock_quantity or 0.0,
                    'deduction_rate': s.deduction_rate or 100.0,
                    'deadline': s.deadline.isoformat() if s.deadline else None,
                })

            self._log_api_call('/api/v1/accounting/suggestions', 'GET', user.id, 200, start_time)
            return self._json_response(result, status=200)
        except Exception as e:
            self._log_api_call('/api/v1/accounting/suggestions', 'GET', user.id if user else None, 500, start_time)
            return self._json_response({'error': str(e)}, status=500)

    @http.route('/api/v1/accounting/assets', type='http', auth='none', methods=['GET', 'OPTIONS'], csrf=False)
    def get_assets_list(self, **kwargs):
        """
        GET /api/v1/accounting/assets
        Lista cespiti con bandi attivabili
        """
        start_time = time.time()
        user, error_response = self._authenticate(require_auth=True)
        if error_response:
            return error_response

        try:
            if not hasattr(request.env, 'erpv6.asset.advisor'):
                self._log_api_call('/api/v1/accounting/assets', 'GET', user.id, 501, start_time)
                return self._json_response({'error': 'Accounting module not installed'}, status=501)

            company_id = request.env.company.id
            
            assets = request.env['erpv6.asset.advisor'].sudo().search([
                ('company_id', '=', company_id),
            ])

            result = []
            for a in assets:
                result.append({
                    'id': a.id,
                    'name': a.name or '',
                    'category': a.category or '',
                    'purchase_value': a.purchase_value or 0.0,
                    'current_value': a.current_value or 0.0,
                    'net_value': a.net_value or 0.0,
                    'accumulated_depreciation': a.accumulated_depreciation or 0.0,
                    'annual_depreciation': a.annual_depreciation or 0.0,
                    'eligible_bandis': a.eligible_bandis or '',
                    'bandi_potential_credit': a.bandi_potential_credit or 0.0,
                    'bandi_details': a.bandi_details or '',
                    'priority': a.priority or 'medium',
                    'status': a.status or 'planned',
                    'suggested_purchase_date': a.suggested_purchase_date.isoformat() if a.suggested_purchase_date else None,
                })

            self._log_api_call('/api/v1/accounting/assets', 'GET', user.id, 200, start_time)
            return self._json_response(result, status=200)
        except Exception as e:
            self._log_api_call('/api/v1/accounting/assets', 'GET', user.id if user else None, 500, start_time)
            return self._json_response({'error': str(e)}, status=500)

    @http.route('/api/v1/accounting/dashboard', type='http', auth='none', methods=['GET', 'OPTIONS'], csrf=False)
    def get_accounting_dashboard(self, **kwargs):
        """
        GET /api/v1/accounting/dashboard
        Dashboard contabilità completa
        """
        start_time = time.time()
        user, error_response = self._authenticate(require_auth=True)
        if error_response:
            return error_response

        try:
            if not hasattr(request.env, 'erpv6.fiscal.prediction'):
                self._log_api_call('/api/v1/accounting/dashboard', 'GET', user.id, 501, start_time)
                return self._json_response({'error': 'Accounting module not installed'}, status=501)

            company_id = request.env.company.id
            
            prediction = request.env['erpv6.fiscal.prediction'].sudo().search([
                ('company_id', '=', company_id),
            ], order='date desc', limit=1)
            
            suggestions = request.env['erpv6.deduction.suggestion'].sudo().search([
                ('company_id', '=', company_id),
                ('status', '=', 'available'),
            ])
            
            assets = request.env['erpv6.asset.advisor'].sudo().search([
                ('company_id', '=', company_id),
            ])

            result = {
                'prediction': {
                    'predicted_total': prediction.predicted_total if prediction else 0.0,
                    'potential_savings': prediction.potential_savings if prediction else 0.0,
                    'kairos_score': prediction.kairos_score if prediction else 0,
                },
                'suggestions_count': len(suggestions),
                'suggestions_total_savings': sum(s.tax_savings for s in suggestions),
                'assets_count': len(assets),
                'assets_total_bandis': sum(a.bandi_potential_credit for a in assets),
            }

            self._log_api_call('/api/v1/accounting/dashboard', 'GET', user.id, 200, start_time)
            return self._json_response(result, status=200)
        except Exception as e:
            self._log_api_call('/api/v1/accounting/dashboard', 'GET', user.id if user else None, 500, start_time)
            return self._json_response({'error': str(e)}, status=500)
