from odoo import http
from odoo.http import request
import json
import logging

_logger = logging.getLogger(__name__)


class AccountingAPIController(http.Controller):

    @http.route('/api/v6/accounting/prediction', type='json', auth='user', methods=['POST'], csrf=False)
    def get_fiscal_prediction(self, **kwargs):
        """Ritorna previsione fiscale per azienda/partner"""
        partner_id = kwargs.get('partner_id')
        company_id = kwargs.get('company_id') or request.env.company.id
        
        domain = [('company_id', '=', company_id)]
        if partner_id:
            domain.append(('partner_id', '=', partner_id))
        
        prediction = request.env['erpv6.fiscal.prediction'].search(
            domain, order='date desc', limit=1
        )
        
        if not prediction:
            prediction = request.env['erpv6.fiscal.prediction'].create({
                'company_id': company_id,
                'partner_id': partner_id,
            })
            prediction.action_calculate()
        
        return {
            'success': True,
            'prediction': {
                'id': prediction.id,
                'date': prediction.date.isoformat(),
                'fiscal_year': prediction.fiscal_year,
                'revenue_ytd': prediction.revenue_ytd,
                'revenue_forecast': prediction.revenue_forecast,
                'predicted_iva': prediction.predicted_iva,
                'predicted_ires': prediction.predicted_ires,
                'predicted_irap': prediction.predicted_irap,
                'predicted_total': prediction.predicted_total,
                'potential_savings': prediction.potential_savings,
                'optimized_total': prediction.optimized_total,
                'savings_percentage': prediction.savings_percentage,
                'kairos_score': prediction.kairos_score,
                'kairos_level': prediction.kairos_level,
            }
        }

    @http.route('/api/v6/accounting/suggestions', type='json', auth='user', methods=['POST'], csrf=False)
    def get_deduction_suggestions(self, **kwargs):
        """Ritorna suggerimenti deduzioni"""
        company_id = kwargs.get('company_id') or request.env.company.id
        
        suggestions = request.env['erpv6.deduction.suggestion'].search([
            ('company_id', '=', company_id),
            ('status', '=', 'available'),
        ])
        
        return {
            'success': True,
            'suggestions': [{
                'id': s.id,
                'category': s.category,
                'max_deductible': s.max_deductible,
                'current_in_stock': s.current_in_stock,
                'suggested_purchase': s.suggested_purchase,
                'tax_savings': s.tax_savings,
                'priority': s.priority,
                'stock_quantity': s.stock_quantity,
            } for s in suggestions]
        }

    @http.route('/api/v6/accounting/assets', type='json', auth='user', methods=['POST'], csrf=False)
    def get_assets(self, **kwargs):
        """Ritorna lista cespiti con bandi attivabili"""
        company_id = kwargs.get('company_id') or request.env.company.id
        
        assets = request.env['erpv6.asset.advisor'].search([
            ('company_id', '=', company_id),
        ])
        
        return {
            'success': True,
            'assets': [{
                'id': a.id,
                'name': a.name,
                'category': a.category,
                'purchase_value': a.purchase_value,
                'net_value': a.net_value,
                'annual_depreciation': a.annual_depreciation,
                'eligible_bandis': a.eligible_bandis,
                'bandi_potential_credit': a.bandi_potential_credit,
                'priority': a.priority,
                'status': a.status,
            } for a in assets]
        }

    @http.route('/api/v6/accounting/dashboard', type='json', auth='user', methods=['POST'], csrf=False)
    def get_accounting_dashboard(self, **kwargs):
        """Dashboard contabilità completa"""
        company_id = kwargs.get('company_id') or request.env.company.id
        
        prediction = request.env['erpv6.fiscal.prediction'].search([
            ('company_id', '=', company_id),
        ], order='date desc', limit=1)
        
        suggestions = request.env['erpv6.deduction.suggestion'].search([
            ('company_id', '=', company_id),
            ('status', '=', 'available'),
        ])
        
        assets = request.env['erpv6.asset.advisor'].search([
            ('company_id', '=', company_id),
        ])
        
        return {
            'success': True,
            'dashboard': {
                'prediction': {
                    'predicted_total': prediction.predicted_total if prediction else 0,
                    'potential_savings': prediction.potential_savings if prediction else 0,
                    'kairos_score': prediction.kairos_score if prediction else 0,
                },
                'suggestions_count': len(suggestions),
                'suggestions_total_savings': sum(s.tax_savings for s in suggestions),
                'assets_count': len(assets),
                'assets_total_bandis': sum(a.bandi_potential_credit for a in assets),
            }
        }