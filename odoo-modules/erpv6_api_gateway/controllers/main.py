# TEST ARGUS: verifica posizionamento esatto
# pylint: disable=import-error
import json
import logging
import time
from datetime import datetime, timedelta

from odoo import fields, http
from odoo.http import request, Response

_logger = logging.getLogger(__name__)

try:
    import jwt
    HAS_JWT = True
except ImportError:
    HAS_JWT = False


class APIBaseController(http.Controller):

    @staticmethod
    def _iso_utc(dt):
        """29/09/2026: ritorna stringa ISO 8601 con Z per datetime naive.

        Uso esplicito nei controller quando si serializza un campo
        direttamente (es. d.create_date.isoformat()) senza passare dal
        default JSON. Gestisce None (ritorna None), date (no Z),
        datetime naive (aggiunge Z), datetime aware (isoformat nativo).
        """
        if dt is None:
            return None
        from datetime import datetime as _dt, date as _date
        if isinstance(dt, _dt):
            if dt.tzinfo is None:
                return dt.isoformat() + 'Z'
            return dt.isoformat()
        if isinstance(dt, _date):
            return dt.isoformat()
        # fallback: prova a chiamare isoformat nativo, altrimenti str
        try:
            return dt.isoformat()
        except AttributeError:
            return str(dt)

    @staticmethod
    def _json_default(obj):
        """29/09/2026: serializza datetime in ISO 8601 con suffisso Z.

        Motivo: le date Odoo escono naive (senza tzinfo) in UTC. Se le
        serializziamo con .isoformat() senza Z, il browser le interpreta
        come ora locale del client (bug classico -2h in Italia). Qui
        aggiungiamo Z esplicito per i naive; per gli aware usiamo
        isoformat() nativo (gia' include +HH:MM).

        Cade nel default di json.dumps come fallback per tipi non
        gestiti (Decimal, bytes, ecc): comportamento invariato.
        """
        from datetime import datetime as _dt, date as _date
        if isinstance(obj, _dt):
            if obj.tzinfo is None:
                # naive: assume UTC (convenzione Odoo) -> marca con Z
                return obj.isoformat() + 'Z'
            # aware: isoformat nativo contiene gia' +HH:MM
            return obj.isoformat()
        if isinstance(obj, _date):
            # date pura: nessuna info TZ, formato ISO YYYY-MM-DD
            return obj.isoformat()
        # fallback invariato: stesso comportamento di default=str
        return str(obj)

    def _json_response(self, data, status=200, error=None):
        # 29/09/2026: timestamp con Z (coerenza con le date dei record)
        ts = datetime.utcnow().isoformat() + 'Z'
        body = {'success': status < 400, 'data': data, 'timestamp': ts}
        if error:
            body['error'] = error
        return Response(
            json.dumps(body, default=self._json_default),
            status=status, content_type='application/json',
            headers={
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            },
        )

    def _authenticate(self, require_auth=True):
        start_time = time.time()
        auth = request.httprequest.headers.get('Authorization', '')
        if auth.startswith('Bearer '):
            api_key = request.env['erpv6.api.key'].sudo().search([('key', '=', auth[7:]), ('is_active', '=', True)], limit=1)
            if not api_key:
                self._log_api_call(request.httprequest.path, request.httprequest.method, None, 401, start_time)
                return None, self._json_response({'error': 'Invalid API Key'}, 401)
            if not api_key.check_endpoint_permission(request.httprequest.path):
                return None, self._json_response({'error': 'Endpoint not allowed'}, 403)
            api_key.write({'last_used': fields.Datetime.now(), 'usage_count': api_key.usage_count + 1})
            return api_key.user_id, None
        if auth.startswith('JWT ') and HAS_JWT:
            user = self._validate_jwt(auth[4:])
            if not user:
                return None, self._json_response({'error': 'Invalid JWT'}, 401)
            return user, None
        if require_auth:
            return None, self._json_response({'error': 'Authentication required'}, 401)
        return request.env.user, None

    def _validate_jwt(self, token):
        if not HAS_JWT:
            return None
        try:
            secret = request.env['ir.config_parameter'].sudo().get_param('api.jwt_secret')
            if not secret:
                return None
            payload = jwt.decode(token, secret, algorithms=['HS256'])
            user = request.env['res.users'].sudo().browse(payload.get('user_id'))
            return user if user.exists() and user.active else None
        except Exception:
            return None

    def _generate_jwt(self, user, role=None, roles=None):
        if not HAS_JWT:
            return None
        secret = request.env['ir.config_parameter'].sudo().get_param('api.jwt_secret')
        if not secret:
            import secrets
            secret = secrets.token_urlsafe(32)
            request.env['ir.config_parameter'].sudo().set_param('api.jwt_secret', secret)
        # role incluso nel payload firmato (10/09/2026) - firma JWT
        # verificata dal middleware Next.js, non piu' dal JSON del cookie.
        #
        # 29/09/2026 (multi-ruolo): `roles` = array completo. Il middleware
        # deve sapere TUTTI i ruoli (es. chief_projects + consultant), non
        # solo il primo. `role` resta per backward compat (= roles[0]).
        payload = {'user_id': user.id, 'exp': datetime.utcnow() + timedelta(hours=24)}
        if role:
            payload['role'] = role
        if roles:
            payload['roles'] = roles
        # 21/09/2026: email_slug
        if 'email_slug' in user._fields:
            payload['email_slug'] = user.email_slug or None
        return jwt.encode(payload, secret, algorithm='HS256')

    def _is_admin_or_chief(self, user):
        """29/09/2026 (multi-ruolo): True se admin O qualsiasi chief_*.

        Bypassa has_group() e confronta direttamente user.groups_id:
        in Odoo 18 has_group() su un recordset .sudo() dentro una
        request API può ritornare falsi negativi (bug riscontrato su
        Christian chief_projects: shell True, gateway False).
        """
        if not user:
            return False
        user_group_ids = user.groups_id.ids
        target_xmlids = [
            'base.group_system',
            'sales_team.group_sale_manager',
            'erpv6_core.group_chief_projects',
            'erpv6_core.group_chief_accounting',
            'erpv6_core.group_chief_bandi',
            'erpv6_core.group_chief_marketing',
            'erpv6_core.group_chief_kb',
        ]
        print(f"DEBUG_IOC user={user.id} groups={user_group_ids}", flush=True)
        for xmlid in target_xmlids:
            grp = request.env.ref(xmlid, raise_if_not_found=False)
            in_list = grp and grp.id in user_group_ids
            print(f"DEBUG_IOC check {xmlid}: grp={grp.id if grp else None} in={in_list}", flush=True)
            if in_list:
                print(f"DEBUG_IOC MATCH {xmlid}", flush=True)
                return True
        print(f"DEBUG_IOC NO MATCH", flush=True)
        return False

    def _is_responsabile_o_admin(self, user):
        """08/10/2026 (C-security-audit-3bis): spostato da
        ConsultantAPIController per uso comune (sign, tracking,
        methodology, validation...)."""
        return (
            user.has_group('base.group_system')
            or user.has_group('sales_team.group_sale_manager')
            or user.has_group('erpv6_core.group_chief_projects')
        )

    def _check_ownership_or_admin(self, user, record,
                                   relation_field=None,
                                   partner_field=None):
        """08/10/2026 (C-security-audit-3bis): helper generico.

        Ritorna True se user puo' accedere al record:
          1) admin/responsabile/chief -> True
          2) create_uid == user -> True
          3) record.<relation_field>.access_user_ids contiene user -> True
          4) record.<partner_field>.user_ids contiene user -> True
        """
        if not user or not user.id or not record or not record.id:
            return False
        if self._is_responsabile_o_admin(user):
            return True
        if hasattr(record, 'create_uid') and record.create_uid and record.create_uid.id == user.id:
            return True
        if relation_field and hasattr(record, relation_field):
            rel = getattr(record, relation_field, None)
            if rel and hasattr(rel, 'access_user_ids'):
                if user.id in (rel.access_user_ids.ids or []):
                    return True
        if partner_field and hasattr(record, partner_field):
            partner = getattr(record, partner_field, None)
            if partner and hasattr(partner, 'user_ids'):
                if user.id in partner.user_ids.ids:
                    return True
        return False

    def _require_record_access(self, user, record, model_name,
                                relation_field=None,
                                partner_field=None,
                                mode='read'):
        """Wrapper: _check_ownership_or_admin + log_access + 403."""
        from odoo.http import request as _r
        granted = self._check_ownership_or_admin(
            user, record,
            relation_field=relation_field,
            partner_field=partner_field,
        )
        try:
            _r.env['erpv6.api.access.log'].sudo().log_access(
                user=user, route=_r.httprequest.path,
                method=_r.httprequest.method,
                model=model_name, record_id=record.id,
                granted=granted,
                reason='ok' if granted else 'denied_no_ownership',
            )
        except Exception:
            pass
        if not granted:
            return self._json_response({'error': 'Accesso negato'}, 403)
        return None


    def _log_api_call(self, endpoint, method, user_id, status_code, start_time):
        try:
            request.env['erpv6.api.log'].sudo().create({
                'endpoint': endpoint, 'method': method, 'user_id': user_id,
                'status_code': status_code, 'response_time_ms': int((time.time() - start_time) * 1000),
                'ip_address': request.httprequest.remote_addr,
            })
        except Exception:
            pass


class HealthController(APIBaseController):

    @http.route('/api/v1/health', type='http', auth='none', methods=['GET', 'OPTIONS'], csrf=False)
    def health(self, **kwargs):  # pylint: disable=unused-argument
        return self._json_response({'status': 'healthy', 'version': '1.0.0'})

    @http.route('/api/v1/auth/login', type='http', auth='none', methods=['POST', 'OPTIONS'], csrf=False)
    def login(self, **kwargs):  # pylint: disable=unused-argument
        # Login reale contro Odoo (Denis, 25/08/2026 - collegamento del
        # frontend V6 Impresa a un consulente vero, es. Stefano Puglisi/
        # Martina Garbin). Prima di questa fix l'endpoint era type='json'
        # (si aspettava una busta JSON-RPC, mai come chiamano gli altri
        # controller di questo gateway) e chiamava
        # request.session.authenticate(db, login, password) con la firma
        # Odoo <17 - su Odoo 18 authenticate() prende (dbname, credential,
        # ...) con credential come dict {'type','login','password'}: la
        # vecchia chiamata avrebbe sempre sollevato TypeError, mai stato
        # eseguito con successo. Verificato leggendo la firma reale in
        # odoo.http.Session.authenticate dentro il container (18/08).
        start_time = time.time()
        try:
            data = json.loads(request.httprequest.data or b'{}')
        except json.JSONDecodeError:
            return self._json_response({'error': 'JSON non valido'}, 400)

        login = (data.get('login') or '').strip()
        password = data.get('password') or ''
        if not login or not password:
            return self._json_response({'error': 'login e password sono obbligatori'}, 400)

        try:
            auth_info = request.session.authenticate(
                request.db, {'type': 'password', 'login': login, 'password': password})
            uid = auth_info.get('uid') if auth_info else False
        except Exception:
            uid = False
        if not uid:
            self._log_api_call('/api/v1/auth/login', 'POST', None, 401, start_time)
            return self._json_response({'error': 'Credenziali non valide'}, 401)

        user = request.env['res.users'].sudo().browse(uid)
        # Ruolo per instradare il frontend (stesso schema gia' in uso su
        # pi_session: admin/consultant/client) - MAI dedotto da un default,
        # solo dai gruppi reali dell'utente. Nessun gruppo "cliente"
        # dedicato esiste ancora: chi non e' ne' Responsabile/Admin ne'
        # Consulente ricade su 'client' (portal/altro utente interno).
        # 29/09/2026: multi-ruolo. Calcolo array roles dai gruppi reali.
        # 30/09/2026: bypass has_group() (in Odoo 18 su .sudo() in API
        # context dà falsi negativi). Confronto diretto groups_id.ids.
        # Backward compat: role = roles[0] per JWT e session esistenti.
        user_group_ids = set(user.groups_id.ids)
        def _has(xmlid):
            g = request.env.ref(xmlid, raise_if_not_found=False)
            return g and g.id in user_group_ids

        roles = []
        if _has('base.group_system') or _has('sales_team.group_sale_manager'):
            roles.append('admin')
        if _has('erpv6_core.group_chief_projects'):
            roles.append('chief_projects')
        if _has('erpv6_core.group_chief_accounting'):
            roles.append('chief_accounting')
        if _has('erpv6_core.group_chief_bandi'):
            roles.append('chief_bandi')
        if _has('erpv6_core.group_chief_marketing'):
            roles.append('chief_marketing')
        if _has('erpv6_core.group_chief_kb'):
            roles.append('chief_kb')
        if _has('erpv6_core.group_consulente'):
            roles.append('consultant')
        if not roles:
            roles.append('client')

        # Backward compat: role = primo ruolo (per JWT + session esistenti)
        role = roles[0]

        token = self._generate_jwt(user, role, roles)
        # consultant_id (erpv6.consulting.consultant, non res.users) serve
        # subito al frontend per il link pubblico di prenotazione
        # (/booking/<consultant_id>) - evita un secondo giro su
        # /api/v1/users/me solo per questo (stesso dato esposto li').
        consultant = request.env['erpv6.consulting.consultant'].sudo().search(
            [('partner_id', '=', user.partner_id.id)], limit=1)
        self._log_api_call('/api/v1/auth/login', 'POST', user.id, 200, start_time)
        # 21/09/2026: email_slug = local-part alias @v6impresa.it
        email_slug = getattr(user, 'email_slug', None)
        return self._json_response({
            'token': token,
            'user': {
                'id': user.id,
                'name': user.name,
                'email': user.email or user.login,
                'email_slug': email_slug,
                'partner_id': user.partner_id.id,
                'consultant_id': consultant.id if consultant else None,
                'role': role,      # backward compat (singolo)
                'roles': roles,    # 29/09/2026: multi-ruolo
            },
        })

    @http.route('/api/v1/auth/me', type='http', auth='none', methods=['GET', 'OPTIONS'], csrf=False)
    def me(self, **kwargs):  # pylint: disable=unused-argument
        """
        01/10/2026 (C1a-1.5): dati dell'utente loggato dal JWT.
        Header: Authorization: JWT <token>
        Risposta: {success: True, data: {user: {id, login, name, roles, ...}}}
        """
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})

        auth = request.httprequest.headers.get('Authorization', '')
        if not auth.startswith('JWT '):
            return self._json_response({'error': 'Token mancante'}, 401)
        user = self._validate_jwt(auth[4:])
        if not user:
            return self._json_response({'error': 'Token invalido'}, 401)

        # Calcolo roles dai gruppi reali (stessa logica di /auth/login).
        user_group_ids = set(user.groups_id.ids)
        def _has(xmlid):
            g = request.env.ref(xmlid, raise_if_not_found=False)
            return g and g.id in user_group_ids

        roles = []
        if _has('base.group_system') or _has('sales_team.group_sale_manager'):
            roles.append('admin')
        if _has('erpv6_core.group_chief_projects'):
            roles.append('chief_projects')
        if _has('erpv6_core.group_chief_accounting'):
            roles.append('chief_accounting')
        if _has('erpv6_core.group_chief_bandi'):
            roles.append('chief_bandi')
        if _has('erpv6_core.group_chief_marketing'):
            roles.append('chief_marketing')
        if _has('erpv6_core.group_chief_kb'):
            roles.append('chief_kb')
        if _has('erpv6_core.group_consulente'):
            roles.append('consultant')
        if not roles:
            roles.append('client')

        consultant = request.env['erpv6.consulting.consultant'].sudo().search(
            [('partner_id', '=', user.partner_id.id)], limit=1)
        email_slug = getattr(user, 'email_slug', None)

        return self._json_response({
            'user': {
                'id': user.id,
                'login': user.login,
                'name': user.name,
                'email': user.email or user.login,
                'email_slug': email_slug,
                'partner_id': user.partner_id.id,
                'consultant_id': consultant.id if consultant else None,
                'role': roles[0],
                'roles': roles,
            },
        })
