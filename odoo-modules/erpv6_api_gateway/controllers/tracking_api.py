# pylint: disable=import-error
import time
from odoo import http
from odoo.http import request
from .main import APIBaseController


class TrackingAPIController(APIBaseController):
    """API per Tracciamento Lotti"""

    @http.route('/api/v1/tracking/lots', type='http', auth='none', methods=['GET', 'OPTIONS'], csrf=False)
    def get_lots_list(self, **kwargs):
        """
        GET /api/v1/tracking/lots
        Lista lotti (batch e definitive)
        """
        start_time = time.time()
        user, error_response = self._authenticate(require_auth=True)
        if error_response:
            return error_response

        try:
            if 'erpv6.tracking.lot' not in request.env:
                self._log_api_call('/api/v1/tracking/lots', 'GET', user.id, 501, start_time)
                return self._json_response({'error': 'Tracking module not installed'}, status=501)

            lots = request.env['erpv6.tracking.lot'].sudo().search([], order='create_date DESC')

            result = []
            for lot in lots:
                result.append({
                    'id': lot.id,
                    'name': lot.name or '',
                    'code': lot.code or '',
                    'tracking_type': lot.tracking_type or '',
                    'parent_lot_id': lot.parent_lot_id.id if lot.parent_lot_id else None,
                    'config_id': lot.config_id.id if lot.config_id else None,
                    'company_code': lot.company_code or '',
                    'brand_code': lot.brand_code or '',
                    'production_date': lot.production_date.isoformat() if lot.production_date else None,
                    'year': lot.year or '',
                    'julian_day': lot.julian_day or 0,
                    'hour': lot.hour or 0,
                    'minute': lot.minute or 0,
                    'quantity': lot.quantity or 0.0,
                    'notes': lot.notes or '',
                    'state': lot.state or 'draft',
                })

            self._log_api_call('/api/v1/tracking/lots', 'GET', user.id, 200, start_time)
            return self._json_response(result, status=200)
        except Exception as e:
            self._log_api_call('/api/v1/tracking/lots', 'GET', user.id if user else None, 500, start_time)
            return self._json_response({'error': str(e)}, status=500)

    @http.route('/api/v1/tracking/lots/<int:lot_id>', type='http', auth='none', methods=['GET', 'OPTIONS'], csrf=False)
    def get_lot_detail(self, lot_id, **kwargs):
        """
        GET /api/v1/tracking/lots/<id>
        Dettaglio lotto
        """
        start_time = time.time()
        user, error_response = self._authenticate(require_auth=True)
        if error_response:
            return error_response

        try:
            if 'erpv6.tracking.lot' not in request.env:
                self._log_api_call(f'/api/v1/tracking/lots/{lot_id}', 'GET', user.id, 501, start_time)
                return self._json_response({'error': 'Tracking module not installed'}, status=501)

            lot = request.env['erpv6.tracking.lot'].sudo().browse(lot_id)
            if not lot.exists():
                self._log_api_call(f'/api/v1/tracking/lots/{lot_id}', 'GET', user.id, 404, start_time)
                return self._json_response({'error': 'Lot not found'}, status=404)

            child_lots = []
            for child in lot.child_lot_ids:
                child_lots.append({
                    'id': child.id,
                    'code': child.code,
                    'tracking_type': child.tracking_type,
                })

            result = {
                'id': lot.id,
                'name': lot.name or '',
                'code': lot.code or '',
                'tracking_type': lot.tracking_type or '',
                'parent_lot_id': lot.parent_lot_id.id if lot.parent_lot_id else None,
                'child_lots': child_lots,
                'config_id': lot.config_id.id if lot.config_id else None,
                'company_code': lot.company_code or '',
                'brand_code': lot.brand_code or '',
                'production_date': lot.production_date.isoformat() if lot.production_date else None,
                'year': lot.year or '',
                'julian_day': lot.julian_day or 0,
                'hour': lot.hour or 0,
                'minute': lot.minute or 0,
                'quantity': lot.quantity or 0.0,
                'notes': lot.notes or '',
                'state': lot.state or 'draft',
            }

            self._log_api_call(f'/api/v1/tracking/lots/{lot_id}', 'GET', user.id, 200, start_time)
            return self._json_response(result, status=200)
        except Exception as e:
            self._log_api_call(f'/api/v1/tracking/lots/{lot_id}', 'GET', user.id if user else None, 500, start_time)
            return self._json_response({'error': str(e)}, status=500)

    @http.route('/api/v1/tracking/lots/batch', type='http', auth='none', methods=['POST', 'OPTIONS'], csrf=False)
    def create_batch_lot(self, **kwargs):
        """
        POST /api/v1/tracking/lots/batch
        Crea lotto batch (config_id, quantity, notes)
        """
        start_time = time.time()
        user, error_response = self._authenticate(require_auth=True)
        if error_response:
            return error_response

        try:
            if 'erpv6.tracking.lot' not in request.env:
                self._log_api_call('/api/v1/tracking/lots/batch', 'POST', user.id, 501, start_time)
                return self._json_response({'error': 'Tracking module not installed'}, status=501)

            data = request.get_json_data() or {}
            
            config_id = data.get('config_id')
            quantity = data.get('quantity', 1.0)
            notes = data.get('notes', '')

            if not config_id:
                self._log_api_call('/api/v1/tracking/lots/batch', 'POST', user.id, 400, start_time)
                return self._json_response({'error': 'config_id required'}, status=400)

            lot = request.env['erpv6.tracking.lot'].sudo().create_batch_lot(
                config_id=config_id,
                quantity=quantity,
                notes=notes
            )

            result = {
                'id': lot.id,
                'name': lot.name,
                'code': lot.code,
                'tracking_type': lot.tracking_type,
            }

            self._log_api_call('/api/v1/tracking/lots/batch', 'POST', user.id, 201, start_time)
            return self._json_response(result, status=201)
        except Exception as e:
            self._log_api_call('/api/v1/tracking/lots/batch', 'POST', user.id if user else None, 500, start_time)
            return self._json_response({'error': str(e)}, status=500)

    @http.route('/api/v1/tracking/lots/definitive', type='http', auth='none', methods=['POST', 'OPTIONS'], csrf=False)
    def create_definitive_lot(self, **kwargs):
        """
        POST /api/v1/tracking/lots/definitive
        Crea lotto definitivo (config_id, batch_lot_id, quantity, notes)
        """
        start_time = time.time()
        user, error_response = self._authenticate(require_auth=True)
        if error_response:
            return error_response

        try:
            if 'erpv6.tracking.lot' not in request.env:
                self._log_api_call('/api/v1/tracking/lots/definitive', 'POST', user.id, 501, start_time)
                return self._json_response({'error': 'Tracking module not installed'}, status=501)

            data = request.get_json_data() or {}
            
            config_id = data.get('config_id')
            batch_lot_id = data.get('batch_lot_id')
            quantity = data.get('quantity', 1.0)
            notes = data.get('notes', '')

            if not config_id:
                self._log_api_call('/api/v1/tracking/lots/definitive', 'POST', user.id, 400, start_time)
                return self._json_response({'error': 'config_id required'}, status=400)

            lot = request.env['erpv6.tracking.lot'].sudo().create_definitive_lot(
                config_id=config_id,
                batch_lot_id=batch_lot_id,
                quantity=quantity,
                notes=notes
            )

            result = {
                'id': lot.id,
                'name': lot.name,
                'code': lot.code,
                'tracking_type': lot.tracking_type,
                'parent_lot_id': lot.parent_lot_id.id if lot.parent_lot_id else None,
            }

            self._log_api_call('/api/v1/tracking/lots/definitive', 'POST', user.id, 201, start_time)
            return self._json_response(result, status=201)
        except Exception as e:
            self._log_api_call('/api/v1/tracking/lots/definitive', 'POST', user.id if user else None, 500, start_time)
            return self._json_response({'error': str(e)}, status=500)

    @http.route('/api/v1/tracking/configs', type='http', auth='none', methods=['GET', 'OPTIONS'], csrf=False)
    def get_configs_list(self, **kwargs):
        """
        GET /api/v1/tracking/configs
        Lista configurazioni tracciamento
        """
        start_time = time.time()
        user, error_response = self._authenticate(require_auth=True)
        if error_response:
            return error_response

        try:
            if 'erpv6.tracking.config' not in request.env:
                self._log_api_call('/api/v1/tracking/configs', 'GET', user.id, 501, start_time)
                return self._json_response({'error': 'Tracking module not installed'}, status=501)

            configs = request.env['erpv6.tracking.config'].sudo().search([
                ('active', '=', True)
            ], order='name')

            result = []
            for config in configs:
                ateco_list = []
                for ateco in config.ateco_suggested_ids:
                    ateco_list.append({
                        'id': ateco.id,
                        'code': ateco.code or '',
                        'name': ateco.name or '',
                    })

                result.append({
                    'id': config.id,
                    'name': config.name or '',
                    'code': config.code or '',
                    'use_definitive_lot': config.use_definitive_lot or False,
                    'use_batch_lot': config.use_batch_lot or False,
                    'company_code': config.company_code or '',
                    'default_brand': config.default_brand or '',
                    'use_julian_day': config.use_julian_day or False,
                    'include_time': config.include_time or False,
                    'tracking_types': config.tracking_types or '',
                    'ateco_suggested': ateco_list,
                    'description': config.description or '',
                })

            self._log_api_call('/api/v1/tracking/configs', 'GET', user.id, 200, start_time)
            return self._json_response(result, status=200)
        except Exception as e:
            self._log_api_call('/api/v1/tracking/configs', 'GET', user.id if user else None, 500, start_time)
            return self._json_response({'error': str(e)}, status=500)
