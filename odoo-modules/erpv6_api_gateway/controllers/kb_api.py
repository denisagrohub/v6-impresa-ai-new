# pylint: disable=import-error
import json
import logging
import time

from odoo import http
from odoo.http import request

from .main import APIBaseController

_logger = logging.getLogger(__name__)


class KBAPIController(APIBaseController):

    @http.route('/api/v1/kb/articles', type='http', auth='none', methods=['GET', 'OPTIONS'], csrf=False)
    def list_articles(self, **kwargs):
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        start_time = time.time()
        user, error = self._authenticate()
        if error:
            return error

        domain = [('is_active', '=', True)]
        if kwargs.get('type'):
            domain.append(('kb_type', '=', kwargs['type']))
        # 06/10/2026 (C-kb-2): filtro per nome categoria
        if kwargs.get('category'):
            domain.append(('category_id.name', '=', kwargs['category']))
        if kwargs.get('search'):
            domain.extend(['|', ('name', 'ilike', kwargs['search']), ('description', 'ilike', kwargs['search'])])

        limit = min(int(kwargs.get('limit', 50)), 200)
        articles = request.env['erpv6.kb'].sudo().search(domain, limit=limit, offset=int(kwargs.get('offset', 0)))
        total = request.env['erpv6.kb'].sudo().search_count(domain)

        data = [{'id': a.id, 'name': a.name, 'description': a.description, 'kb_type': a.kb_type,
                 'priority': a.priority, 'use_count': a.use_count, 'version': a.version} for a in articles]

        self._log_api_call('/api/v1/kb/articles', 'GET', user.id, 200, start_time)
        return self._json_response({'articles': data, 'total': total})

    @http.route('/api/v1/kb/articles/<int:article_id>', type='http', auth='none', methods=['GET'], csrf=False)
    def get_article(self, article_id, **kwargs):  # pylint: disable=unused-argument
        start_time = time.time()
        user, error = self._authenticate()
        if error:
            return error

        article = request.env['erpv6.kb'].sudo().browse(article_id)
        if not article.exists():
            return self._json_response({'error': 'Not found'}, 404)
        if not article._check_access():
            return self._json_response({'error': 'Access denied'}, 403)

        content = article.content
        if article.is_encrypted:
            content = article.get_content_for_ai(ai_name=f'api_user_{user.id}')

        self._log_api_call(f'/api/v1/kb/articles/{article_id}', 'GET', user.id, 200, start_time)
        return self._json_response({'id': article.id, 'name': article.name, 'content': content, 'kb_type': article.kb_type})

    @http.route('/api/v1/kb/bundle', type='http', auth='none', methods=['GET', 'OPTIONS'], csrf=False)
    def get_bundle(self, **kwargs):
        """06/10/2026 (C-kb-2): bundle KB per contesto AI."""
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        start_time = time.time()
        user, error = self._authenticate()
        if error:
            return error

        domain = [('is_active', '=', True)]
        if kwargs.get('type'):
            domain.append(('kb_type', '=', kwargs['type']))
        if kwargs.get('category'):
            domain.append(('category_id.name', '=', kwargs['category']))

        limit = min(int(kwargs.get('limit', 30)), 100)
        articles = request.env['erpv6.kb'].sudo().search(domain, limit=limit)

        data = []
        for a in articles:
            content = a.content or ''
            if a.is_encrypted:
                try:
                    content = a.get_content_for_ai(ai_name='api_user_%d' % user.id)
                except Exception:
                    content = ''
            data.append({
                'id': a.id,
                'name': a.name,
                'content': content,
                'category': a.category_id.name if a.category_id else '',
                'kb_type': a.kb_type or '',
            })

        self._log_api_call('/api/v1/kb/bundle', 'GET', user.id, 200, start_time)
        return self._json_response({'bundle': data, 'count': len(data)})
