# pylint: disable=import-error
"""Consultant API Controller - dati reali per la dashboard consulente
(apps/impresa/src/app/consultant/dashboard/page.tsx), Denis 25/08/2026.

erpv6_api_gateway resta agnostico da erpv6_production (stesso pattern
hasattr/"in env" gia' usato in interview_api.py/lead_api.py): se il modulo
non e' installato, gli endpoint rispondono 501 invece di crashare.

Ruoli (stesso schema di /api/v1/auth/login in main.py): Responsabile
(sales_team.group_sale_manager) e Admin (base.group_system) vedono/possono
tutto; un Consulente (erpv6_core.group_consulente) vede/puo' agire solo sul
proprio - il filtro sui DATI resta comunque garantito anche qui esplicitamente
(mai fidarsi solo del frontend che nasconde un bottone)."""
import json
import logging
import time

from odoo import http, SUPERUSER_ID
from markupsafe import Markup
from odoo.exceptions import UserError
from odoo.http import request

from .main import APIBaseController

_logger = logging.getLogger(__name__)



from .consultant_api import ConsultantAPIController


class ConsultantRichiesteAPIController(ConsultantAPIController):

    @http.route('/api/v1/consultant/richieste', type='http', auth='none', methods=['GET', 'POST', 'OPTIONS'], csrf=False)
    def consultant_richieste(self, **kwargs):  # pylint: disable=unused-argument
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        start_time = time.time()
        user, error_response = self._authenticate(require_auth=True)
        if error_response:
            return error_response

        env = request.env
        if 'erpv6.consulente.richiesta' not in env:
            return self._not_installed('/api/v1/consultant/richieste', start_time)

        is_admin = self._is_responsabile_o_admin(user)

        if request.httprequest.method == 'GET':
            # Un Responsabile/Admin vede TUTTE le richieste per default
            # (deve poterle approvare, non solo le proprie che di norma non
            # esistono nemmeno) - ?mine=1 per restringere anche lui alle
            # proprie, se mai servisse. Un Consulente vede SEMPRE e SOLO le
            # proprie (stessa regola gia' garantita dall'ir.rule lato ORM,
            # qui e' solo esplicita/coerente col resto dell'endpoint).
            mine_only = kwargs.get('mine') in ('1', 'true', 'True')
            domain = [('consulente_id', '=', user.id)] if (not is_admin or mine_only) else []
            richieste = env['erpv6.consulente.richiesta'].sudo().search(domain, order='create_date desc')
            result = [{
                'id': r.id,
                'consulente': r.consulente_id.name,
                'consulente_id': r.consulente_id.id,
                'lead_id': r.lead_id.id,
                'lead_name': r.lead_id.name,
                'tipo': r.tipo,
                'motivo': r.motivo or '',
                'state': r.state,
                'responsabile': r.responsabile_id.name if r.responsabile_id else '',
                'decisione_note': r.decisione_note or '',
                'create_date': r.create_date.isoformat() if r.create_date else None,
            } for r in richieste]
            self._log_api_call('/api/v1/consultant/richieste', 'GET', user.id, 200, start_time)
            return self._json_response({'can_decide': is_admin, 'richieste': result})

        # POST: un Consulente (o l'Admin, se vuole crearne una per se
        # stesso) chiede di essere assegnato/escluso da UN lead specifico -
        # con_user(user) cosi' erpv6.consulente.richiesta.consulente_id
        # (default lambda self.env.user) risolve DAVVERO l'utente
        # autenticato via JWT, non l'utente pubblico della route auth='none'.
        try:
            data = json.loads(request.httprequest.data or b'{}')
        except json.JSONDecodeError:
            return self._json_response({'error': 'JSON non valido'}, 400)

        lead_id = data.get('lead_id')
        tipo = data.get('tipo')
        if not lead_id or tipo not in ('assegnami', 'non_assegnarmi'):
            return self._json_response({'error': "lead_id e tipo ('assegnami'/'non_assegnarmi') richiesti"}, 400)

        try:
            richiesta = env['erpv6.consulente.richiesta'].with_user(user).create({
                'lead_id': int(lead_id),
                'consulente_id': user.id,
                'tipo': tipo,
                'motivo': data.get('motivo') or False,
            })
        except UserError as e:
            self._log_api_call('/api/v1/consultant/richieste', 'POST', user.id, 400, start_time)
            return self._json_response({'error': str(e)}, 400)
        except Exception as e:
            _logger.exception("Creazione richiesta fallita per lead #%s.", lead_id)
            self._log_api_call('/api/v1/consultant/richieste', 'POST', user.id, 500, start_time)
            return self._json_response({'error': str(e)}, 500)

        self._log_api_call('/api/v1/consultant/richieste', 'POST', user.id, 201, start_time)
        return self._json_response({'id': richiesta.id, 'state': richiesta.state}, 201)

    # ------------------------------------------------------------------
    # Approvazione/rifiuto - SOLO Responsabile/Admin (azione in piu' del
    # compito 3): il controllo reale resta comunque dentro action_approve/
    # action_reject (with_user(user), mai .sudo() nudo - altrimenti
    # env.user dentro quei metodi risolverebbe l'utente pubblico della
    # route auth='none', non il vero chiamante autenticato via JWT, e
    # _check_responsabile_o_admin fallirebbe sempre anche per un Admin
    # vero).
    # ------------------------------------------------------------------
    @http.route('/api/v1/consultant/richieste/<int:richiesta_id>/decide', type='http', auth='none',
                methods=['POST', 'OPTIONS'], csrf=False)
    def decide_richiesta(self, richiesta_id, **kwargs):  # pylint: disable=unused-argument
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        start_time = time.time()
        user, error_response = self._authenticate(require_auth=True)
        if error_response:
            return error_response

        env = request.env
        if 'erpv6.consulente.richiesta' not in env:
            return self._not_installed('/api/v1/consultant/richieste/decide', start_time)

        try:
            data = json.loads(request.httprequest.data or b'{}')
        except json.JSONDecodeError:
            return self._json_response({'error': 'JSON non valido'}, 400)

        decision = data.get('decision')
        if decision not in ('approve', 'reject'):
            return self._json_response({'error': "decision deve essere 'approve' o 'reject'"}, 400)

        richiesta = env['erpv6.consulente.richiesta'].with_user(user).browse(richiesta_id)
        if not richiesta.exists():
            self._log_api_call('/api/v1/consultant/richieste/decide', 'POST', user.id, 404, start_time)
            return self._json_response({'error': 'Richiesta non trovata'}, 404)

        try:
            if decision == 'approve':
                richiesta.action_approve()
            else:
                richiesta.action_reject()
        except UserError as e:
            self._log_api_call('/api/v1/consultant/richieste/decide', 'POST', user.id, 403, start_time)
            return self._json_response({'error': str(e)}, 403)
        except Exception as e:
            _logger.exception("Decisione richiesta #%s fallita.", richiesta_id)
            self._log_api_call('/api/v1/consultant/richieste/decide', 'POST', user.id, 500, start_time)
            return self._json_response({'error': str(e)}, 500)

        self._log_api_call('/api/v1/consultant/richieste/decide', 'POST', user.id, 200, start_time)
        return self._json_response({'id': richiesta.id, 'state': richiesta.state})

    # ------------------------------------------------------------------
    # Tab "Email" (21/09/2026): email assegnate al consulente via routing
    # slug su @v6impresa.it (vedi erpv6_winwin_renderdata.message_new).
    # Un consulente vede solo le sue; Admin/Responsabile vede tutte.
    # ------------------------------------------------------------------

