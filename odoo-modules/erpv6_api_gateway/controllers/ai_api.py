# pylint: disable=import-error
"""AI API Controller for ERP V6."""
import json
import logging
import time

from odoo import fields, http
from odoo.http import request

from .main import APIBaseController

_logger = logging.getLogger(__name__)


class AIAPIController(APIBaseController):
    """API endpoints specifici per AI agents."""

    @http.route('/api/v1/ai/context', type='http', auth='none', methods=['POST'], csrf=False)
    def get_ai_context(self, **kwargs):  # pylint: disable=unused-argument
        start_time = time.time()
        user, error = self._authenticate()
        if error:
            return error

        try:
            data = json.loads(request.httprequest.data)
        except json.JSONDecodeError:
            self._log_api_call('/api/v1/ai/context', 'POST', user.id, 400, start_time)
            return self._json_response({'error': 'Invalid JSON'}, 400)

        query = data.get('query', '')
        context_type = data.get('context_type', 'general')
        max_articles = min(int(data.get('max_articles', 5)), 20)

        domain = [('is_active', '=', True), ('access_level', 'in', ['public', 'consultant', 'ai_only'])]
        if query:
            domain.extend(['|', ('name', 'ilike', query), ('description', 'ilike', query)])

        try:
            articles = request.env['erpv6.kb'].sudo().search(domain, limit=max_articles, order='priority desc, use_count desc')
        except Exception as e:
            _logger.error("KB search error: %s", e)
            return self._json_response({'error': 'Internal error'}, 500)

        ctx_articles = []
        for a in articles:
            try:
                content = a.get_content_for_ai('ai_agent') if a.is_encrypted else a.content
                ctx_articles.append({'id': a.id, 'name': a.name, 'kb_type': a.kb_type, 'content': content, 'priority': a.priority})
            except Exception:
                continue

        prompt_domain = [('kb_type', '=', 'prompt'), ('is_active', '=', True)]
        if context_type:
            prompt_domain.append(('category_id.name', 'ilike', context_type))

        ctx_prompts = []
        try:
            for p in request.env['erpv6.kb'].sudo().search(prompt_domain, limit=3):
                content = p.get_content_for_ai('ai_agent') if p.is_encrypted else p.content
                ctx_prompts.append({'id': p.id, 'name': p.name, 'content': content})
        except Exception:
            pass

        self._log_api_call('/api/v1/ai/context', 'POST', user.id, 200, start_time)
        return self._json_response({
            'query': query, 'context_type': context_type,
            'articles': ctx_articles, 'prompts': ctx_prompts,
            'timestamp': fields.Datetime.now().isoformat(),
        })
