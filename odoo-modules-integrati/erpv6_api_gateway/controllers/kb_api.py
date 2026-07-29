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
