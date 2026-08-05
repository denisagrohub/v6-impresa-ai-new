# pylint: disable=import-error
import time
from odoo import http
from odoo.http import request
from .main import APIBaseController


class SaasTenantAPIController(APIBaseController):
    """API per gestione Tenant e Subscription SaaS"""

    @http.route('/api/v1/saas/tenant/dashboard', type='http', auth='none', methods=['GET', 'OPTIONS'], csrf=False)
    def get_tenant_dashboard(self, **kwargs):
        """
        GET /api/v1/saas/tenant/dashboard
        Ritorna overview tenant (subscription_status, expires_at, vertical, modules_installed count)
        """
        start_time = time.time()
        user, error_response = self._authenticate(require_auth=True)
        if error_response:
            return error_response

        try:
            if not hasattr(request.env, 'erpv6.saas.tenant'):
                self._log_api_call('/api/v1/saas/tenant/dashboard', 'GET', user.id, 501, start_time)
                return self._json_response({'error': 'SaaS module not installed'}, status=501)

            partner = user.partner_id.commercial_partner_id or user.partner_id
            
            tenant = request.env['erpv6.saas.tenant'].sudo().search([
                ('partner_id', '=', partner.id),
                ('active', '=', True)
            ], limit=1)

            if not tenant:
                self._log_api_call('/api/v1/saas/tenant/dashboard', 'GET', user.id, 404, start_time)
                return self._json_response({'error': 'Tenant not found'}, status=404)

            # Conta moduli installati dal verticale
            modules_count = 0
            if tenant.verticale:
                vertical_record = request.env['erpv6.vertical.catalog'].sudo().search([
                    ('verticale', '=', tenant.verticale),
                    ('is_active', '=', True)
                ], limit=1)
                if vertical_record and vertical_record.module_names:
                    modules_count = len([m.strip() for m in vertical_record.module_names.split(',') if m.strip()])

            result = {
                'id': tenant.id,
                'name': tenant.name,
                'partner_id': tenant.partner_id.id,
                'partner_name': tenant.partner_id.name,
                'verticale': tenant.verticale or '',
                'subscription_status': tenant.subscription_status or 'trial',
                'subscription_expires_at': tenant.subscription_expires_at.isoformat() if tenant.subscription_expires_at else None,
                'trial_ends_at': tenant.trial_ends_at.isoformat() if tenant.trial_ends_at else None,
                'setup_fee_paid': tenant.setup_fee_paid or False,
                'modules_installed_count': modules_count,
            }

            self._log_api_call('/api/v1/saas/tenant/dashboard', 'GET', user.id, 200, start_time)
            return self._json_response(result, status=200)
        except Exception as e:
            self._log_api_call('/api/v1/saas/tenant/dashboard', 'GET', user.id if user else None, 500, start_time)
            return self._json_response({'error': str(e)}, status=500)

    @http.route('/api/v1/saas/subscription', type='http', auth='none', methods=['GET', 'OPTIONS'], csrf=False)
    def get_subscription_details(self, **kwargs):
        """
        GET /api/v1/saas/subscription
        Ritorna dettagli subscription (status, expires_at, trial_ends_at, setup_fee_paid)
        """
        start_time = time.time()
        user, error_response = self._authenticate(require_auth=True)
        if error_response:
            return error_response

        try:
            if not hasattr(request.env, 'erpv6.saas.tenant'):
                self._log_api_call('/api/v1/saas/subscription', 'GET', user.id, 501, start_time)
                return self._json_response({'error': 'SaaS module not installed'}, status=501)

            partner = user.partner_id.commercial_partner_id or user.partner_id
            
            tenant = request.env['erpv6.saas.tenant'].sudo().search([
                ('partner_id', '=', partner.id),
                ('active', '=', True)
            ], limit=1)

            if not tenant:
                self._log_api_call('/api/v1/saas/subscription', 'GET', user.id, 404, start_time)
                return self._json_response({'error': 'Tenant not found'}, status=404)

            result = {
                'id': tenant.id,
                'status': tenant.subscription_status or 'trial',
                'expires_at': tenant.subscription_expires_at.isoformat() if tenant.subscription_expires_at else None,
                'trial_ends_at': tenant.trial_ends_at.isoformat() if tenant.trial_ends_at else None,
                'setup_fee_paid': tenant.setup_fee_paid or False,
                'notes': tenant.notes or '',
            }

            self._log_api_call('/api/v1/saas/subscription', 'GET', user.id, 200, start_time)
            return self._json_response(result, status=200)
        except Exception as e:
            self._log_api_call('/api/v1/saas/subscription', 'GET', user.id if user else None, 500, start_time)
            return self._json_response({'error': str(e)}, status=500)
