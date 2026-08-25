# pylint: disable=import-error
"""Interview API Controller - intervista ad albero per il frontend.

erpv6_api_gateway resta agnostico da erpv6_production (stesso pattern
hasattr/duck-typing gia' usato in lead_api.py per _start_production): se il
modulo non e' installato, gli endpoint rispondono 501 invece di crashare."""
import json
import logging
import time

from odoo import http
from odoo.http import request

from .main import APIBaseController

_logger = logging.getLogger(__name__)


class InterviewAPIController(APIBaseController):

    def _env_public(self):
        return request.env(user=request.env.ref('base.public_user'))

    def _not_installed(self, path, start_time):
        self._log_api_call(path, 'GET', None, 501, start_time)
        return self._json_response({'error': 'Interview engine not installed'}, 501)

    @http.route('/api/v1/interview/products', type='http', auth='none', methods=['GET', 'OPTIONS'], csrf=False)
    def list_products(self, **kwargs):  # pylint: disable=unused-argument
        """Radice della selezione: 'che tipo di prodotto ti interessa?'.
        Ritorna solo i prodotti generici (parent_id vuoto), ognuno con le
        proprie varianti - la scelta di una variante specifica avviene sul
        frontend dopo aver scelto il prodotto generico."""
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        start_time = time.time()
        env = self._env_public()
        if 'erpv6.vertical.catalog' not in env:
            return self._not_installed('/api/v1/interview/products', start_time)

        roots = env['erpv6.vertical.catalog'].sudo().search([('parent_id', '=', False), ('is_active', '=', True)])
        result = [{
            'id': r.id,
            'name': r.name,
            'verticale': r.verticale,
            'variants': [{'id': c.id, 'name': c.name, 'verticale': c.verticale}
                         for c in r.child_ids.filtered('is_active')],
        } for r in roots]
        self._log_api_call('/api/v1/interview/products', 'GET', None, 200, start_time)
        return self._json_response(result, 200)

    @http.route('/api/v1/interview/start', type='http', auth='none', methods=['POST', 'OPTIONS'], csrf=False)
    def start_interview(self, **kwargs):  # pylint: disable=unused-argument
        """Crea (se serve) un lead grezzo non qualificato e avvia una
        sessione d'intervista. Stesso schema di qualified=False in
        lead_api.create_lead: non disturba nessuno finche' l'intervista non
        e' completata."""
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        start_time = time.time()

        try:
            data = json.loads(request.httprequest.data)
        except json.JSONDecodeError:
            return self._json_response({'error': 'Invalid JSON'}, 400)

        env = self._env_public()
        if 'erpv6.interview.session' not in env:
            return self._not_installed('/api/v1/interview/start', start_time)

        lead_id = data.get('lead_id')
        if lead_id:
            lead = env['crm.lead'].sudo().browse(lead_id)
            if not lead.exists():
                return self._json_response({'error': 'Lead not found'}, 404)
        else:
            name = (data.get('name') or '').strip()
            email = (data.get('email') or '').strip()
            if not name or not email:
                return self._json_response({'error': 'lead_id or name+email required'}, 400)
            existing = env['crm.lead'].sudo().search([('email_from', '=', email), ('active', '=', True)], limit=1)
            lead = existing or env['crm.lead'].sudo().create({
                'name': f"Lead Web: {name}",
                'contact_name': name,
                'email_from': email,
                'type': 'lead',
            })

        verticale_id = data.get('verticale_id')
        session = env['erpv6.interview.session'].sudo().create({'lead_id': lead.id})
        question = session.action_start(verticale_id=verticale_id)
        payload = session.get_next_question_payload() if question else False

        self._log_api_call('/api/v1/interview/start', 'POST', None, 201, start_time)
        return self._json_response({'lead_id': lead.id, 'question': payload}, 201)

    @http.route('/api/v1/interview/answer', type='http', auth='none', methods=['POST', 'OPTIONS'], csrf=False)
    def answer_interview(self, **kwargs):  # pylint: disable=unused-argument
        """Registra una risposta alla domanda corrente della sessione e
        ritorna la prossima (o completed=True se l'albero e' esaurito).
        is_altro=True e' il segnale del motore vocabolario (vedi
        erpv6.interview.answer._notify_altro_candidate)."""
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        start_time = time.time()

        try:
            data = json.loads(request.httprequest.data)
        except json.JSONDecodeError:
            return self._json_response({'error': 'Invalid JSON'}, 400)

        env = self._env_public()
        if 'erpv6.interview.session' not in env:
            return self._not_installed('/api/v1/interview/answer', start_time)

        session_id = data.get('session_id')
        session = env['erpv6.interview.session'].sudo().browse(session_id)
        if not session.exists():
            return self._json_response({'error': 'Session not found'}, 404)
        if session.state != 'in_progress':
            return self._json_response({'error': 'Session not in progress'}, 400)

        question = session.current_question_id
        option_id = data.get('option_id')
        try:
            _answer, _next = session.sudo().action_answer(
                question,
                value_text=data.get('value_text'),
                option_id=option_id,
                is_altro=bool(data.get('is_altro')),
            )
        except ValueError as e:
            return self._json_response({'error': str(e)}, 400)

        session.invalidate_recordset()
        payload = session.get_next_question_payload()
        completed = session.state == 'completed'
        # Punteggio a video al completamento (25/08/2026, richiesto
        # esplicitamente da Denis: lo scoring deve comparire SUBITO a fine
        # intervista, non solo restare calcolato lato Odoo). session ha gia'
        # kairos_matrix_id valorizzato da _complete() se budget+tempistiche
        # erano riconosciuti (vedi interview_engine.py) - qui si legge SOLO,
        # nessun nuovo calcolo, nessun dato inventato se la matrice non
        # esiste (score resta None).
        score = None
        if completed and session.kairos_matrix_id:
            matrix = session.kairos_matrix_id
            score = {
                'quadrante': matrix.quadrante,
                'quadrante_label': dict(matrix._fields['quadrante'].selection).get(matrix.quadrante),
                'impatto_score': matrix.impatto_score,
                'impatto_level': matrix.impatto_level,
                'prontezza_totale': matrix.prontezza_totale,
                'prontezza_level': matrix.prontezza_level,
            }
        self._log_api_call('/api/v1/interview/answer', 'POST', None, 200, start_time)
        return self._json_response({
            'completed': completed,
            'question': payload,
            'score': score,
        }, 200)
