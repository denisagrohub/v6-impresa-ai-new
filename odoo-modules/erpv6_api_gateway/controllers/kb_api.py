# pylint: disable=import-error
import json
import logging
import time

from odoo import http
from odoo.http import request

from .main import APIBaseController

_logger = logging.getLogger(__name__)


class KBAPIController(APIBaseController):

    # ═══════════════════════════════════════════════════════════════
    # 06/10/2026 (C-kb-3a Blocco B): enforcement access_level.
    # Regole:
    #   public      -> tutti
    #   consultant  -> consulente V6 (group_consulente, chief_projects,
    #                  base.group_system)
    #   ai_only     -> mai via API pubblica (solo get_content_for_ai)
    #   admin       -> solo base.group_system
    # allowed_user_ids: M2M presente sul modello ma vuoto per ora
    # (D3 master). Se popolato in futuro, va aggiunta la logica qui.
    # ═══════════════════════════════════════════════════════════════
    def _user_can_access(self, user, kb):
        """Ritorna True se l'utente può leggere la KB via API."""
        if not user or not user.id:
            return False
        if user.has_group('base.group_system'):
            return True
        level = kb.access_level or 'public'
        if level == 'public':
            return True
        if level == 'admin':
            return False  # solo group_system, gestito sopra
        if level == 'consultant':
            return (
                user.has_group('erpv6_core.group_consulente')
                or user.has_group('erpv6_core.group_chief_projects')
                or user.has_group('erpv6_core.group_chief_kb')
            )
        if level == 'ai_only':
            return False  # solo via get_content_for_ai (mai in API)
        return False

    # ═══════════════════════════════════════════════════════════════
    # 07/10/2026 (C-kb-3b): enforcement X-Kb-Session.
    # Dopo JWT + access_level, serve un OTP valido che ha generato
    # una sessione erpv6.kb.session. Header X-Kb-Session obbligatorio.
    # BYPASS: user_id=2 (Denis) hardcoded, con log rinforzato.
    # ═══════════════════════════════════════════════════════════════
    def _require_kb_session(self, user=None, purpose='read'):
        """Ritorna None se sessione valida, altrimenti errore JSON.

        07/10/2026 (C-kb-3c): parametrizzato su purpose.
          - purpose='read': bypass admin Denis (user_id=2) come prima
          - purpose='write':  serve sessione write (15 min TTL)
          - purpose='critical': serve sessione critical (5 min TTL)
        Le sessioni NON sono intercambiabili: una sessione read non
        autorizza write.
        """
        if user is None:
            user = request.env.user
        # Bypass admin Denis SOLO per la lettura. Write e critical
        # richiedono sempre OTP, anche per Denis.
        if user.id == 2 and purpose == 'read':
            return None

        token = request.httprequest.headers.get('X-Kb-Session')
        if not token:
            return self._json_response({
                'error': 'kb_session_required',
                'message': 'Serve OTP. Apri /admin/kb.',
                'purpose': purpose,
            }, 401)

        from odoo import fields as _fields
        Session = request.env['erpv6.kb.session'].sudo()
        s = Session.search([
            ('token', '=', token),
            ('user_id', '=', user.id),
            ('purpose', '=', purpose),
            ('revoked', '=', False),
            ('expires_at', '>', _fields.Datetime.now()),
        ], limit=1)
        if not s:
            return self._json_response({
                'error': 'kb_session_expired',
                'message': 'Sessione %s scaduta o mancante. Riapri /admin/kb.' % purpose,
                'purpose': purpose,
            }, 401)
        return None

    def _log_kb_access(self, action, user, kb=None, details=None):
        """06/10/2026 (C-kb-3a Blocco C): audit log accessi KB.
        Best-effort: un errore nel log non deve mai rompere
        l'accesso vero. Riceve 'user' esplicito (gia' disponibile
        in ogni endpoint dopo _authenticate), usa request.env
        (sempre valido dentro un route handler).
        """
        try:
            ip = ua = None
            if request and hasattr(request, 'httprequest'):
                ip = request.httprequest.remote_addr
                ua = request.httprequest.user_agent.string if request.httprequest.user_agent else None
            request.env['erpv6.kb.access.log'].sudo().create({
                'user_id': user.id,
                'kb_id': kb.id if kb else False,
                'action': action,
                'ip_address': ip,
                'user_agent': (ua or '')[:200],
                'details': details,
            })
        except Exception as e:
            _logger.warning('kb access log fail: %s', e)

    @http.route('/api/v1/kb/articles', type='http', auth='none', methods=['GET', 'OPTIONS'], csrf=False)
    def list_articles(self, **kwargs):
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        start_time = time.time()
        user, error = self._authenticate()
        if error:
            return error
        # 07/10/2026 (C-kb-3b): enforcement sessione OTP
        sess_err = self._require_kb_session(user=user)
        if sess_err:
            return sess_err

        domain = [('is_active', '=', True)]
        if kwargs.get('type'):
            domain.append(('kb_type', '=', kwargs['type']))
        # 06/10/2026 (C-kb-2): filtro per nome categoria
        if kwargs.get('category'):
            domain.append(('category_id.name', '=', kwargs['category']))
        if kwargs.get('search'):
            domain.extend(['|', ('name', 'ilike', kwargs['search']), ('description', 'ilike', kwargs['search'])])

        # 06/10/2026 (C-kb-3a Blocco B): filtro per access_level.
        # Cerco senza limit per filtrare correttamente, poi applico
        # offset/limit dopo il filtro.
        offset = int(kwargs.get('offset', 0))
        limit = min(int(kwargs.get('limit', 50)), 200)
        articles_all = request.env['erpv6.kb'].sudo().search(domain, order='id')
        articles_filtered = articles_all.filtered(
            lambda a: self._user_can_access(user, a))
        total = len(articles_filtered)
        articles = articles_filtered[offset:offset + limit]

        # 06/10/2026 (C-kb-4): aggiunti category_name + access_level
        # per UI lista (filtro + badge).
        data = [{
            'id': a.id,
            'name': a.name,
            'description': a.description or '',
            'kb_type': a.kb_type or '',
            'category_id': a.category_id.id if a.category_id else None,
            'category_name': a.category_id.name if a.category_id else '',
            'access_level': a.access_level or 'public',
            'is_active': a.is_active,
            'priority': a.priority,
            'use_count': a.use_count,
            'version': a.version or 1,
        } for a in articles]

        self._log_api_call('/api/v1/kb/articles', 'GET', user.id, 200, start_time)
        # 06/10/2026 (C-kb-3a Blocco C): audit
        self._log_kb_access('list', user=user, details='total=%d' % total)
        return self._json_response({'articles': data, 'total': total})

    @http.route('/api/v1/kb/articles/<int:article_id>', type='http', auth='none', methods=['GET'], csrf=False)
    def get_article(self, article_id, **kwargs):  # pylint: disable=unused-argument
        start_time = time.time()
        user, error = self._authenticate()
        if error:
            return error
        # 07/10/2026 (C-kb-3b): enforcement sessione OTP
        sess_err = self._require_kb_session(user=user)
        if sess_err:
            return sess_err

        article = request.env['erpv6.kb'].sudo().browse(article_id)
        if not article.exists():
            return self._json_response({'error': 'Not found'}, 404)
        # 06/10/2026 (C-kb-3a Blocco A+B): sostituito _check_access()
        # (era BaseModel._check_access senza argomento -> TypeError,
        # bug latente) con _user_can_access che rispetta access_level.
        if not self._user_can_access(user, article):
            return self._json_response({'error': 'Access denied'}, 403)

        content = article.content
        if article.is_encrypted:
            content = article.get_content_for_ai(ai_name=f'api_user_{user.id}')

        self._log_api_call(f'/api/v1/kb/articles/{article_id}', 'GET', user.id, 200, start_time)
        # 06/10/2026 (C-kb-3a Blocco C): audit
        self._log_kb_access('read', user=user, kb=article)
        # 07/10/2026 (C-kb-3c): esteso per editor UI (modifica KB).
        return self._json_response({
            'id': article.id,
            'name': article.name,
            'content': content,
            'kb_type': article.kb_type,
            'description': article.description or '',
            'category_id': article.category_id.id if article.category_id else None,
            'access_level': article.access_level or 'consultant',
            'version': article.version or 0,
        })

    @http.route('/api/v1/kb/bundle', type='http', auth='none', methods=['GET', 'OPTIONS'], csrf=False)
    def get_bundle(self, **kwargs):
        """06/10/2026 (C-kb-2): bundle KB per contesto AI."""
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        start_time = time.time()
        user, error = self._authenticate()
        if error:
            return error
        # 07/10/2026 (C-kb-3b): enforcement sessione OTP
        sess_err = self._require_kb_session(user=user)
        if sess_err:
            return sess_err

        domain = [('is_active', '=', True)]
        if kwargs.get('type'):
            domain.append(('kb_type', '=', kwargs['type']))
        if kwargs.get('category'):
            domain.append(('category_id.name', '=', kwargs['category']))

        limit = min(int(kwargs.get('limit', 30)), 100)
        # 06/10/2026 (C-kb-3a Blocco B): bundle usato per contesto AI.
        # Filtro: public + consultant accessibili all'utente. MAI
        # ai_only (design: sono voci riservate al motore) ne' admin
        # (solo group_system).
        articles_all = request.env['erpv6.kb'].sudo().search(domain, order='id')
        articles_filtered = articles_all.filtered(
            lambda a: self._user_can_access(user, a) and a.access_level != 'ai_only')
        articles = articles_filtered[:limit]

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
        # 06/10/2026 (C-kb-3a Blocco C): audit
        self._log_kb_access('bundle', user=user, details='count=%d' % len(data))
        return self._json_response({'bundle': data, 'count': len(data)})

    # ═══════════════════════════════════════════════════════════════
    # 07/10/2026 (C-kb-3b): endpoint OTP + sessione.
    # ═══════════════════════════════════════════════════════════════
    @http.route('/api/v1/kb/otp/request',
                type='http', auth='none', methods=['POST', 'OPTIONS'],
                csrf=False)
    def otp_request(self, **kwargs):
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        user, err = self._authenticate(require_auth=True)
        if err:
            return err
        request.update_env(user=user.id)

        # Verifica access_level minimo
        if not user.has_group('base.group_system') and \
                not user.has_group('erpv6_core.group_chief_projects') and \
                not user.has_group('erpv6_core.group_chief_kb') and \
                not user.has_group('erpv6_core.group_consulente'):
            return self._json_response(
                {'error': 'Non hai accesso alla Knowledge Base'}, 403)

        # Verifica chat certificata
        Link = request.env['erpv6.otp.bot.link'].sudo()
        link = Link.search([
            ('user_id', '=', user.id),
            ('revoked', '=', False),
        ], limit=1)
        if not link:
            return self._json_response({
                'error': 'kb_telegram_not_certified',
                'message': 'Installa il bot V6 Auth prima di procedere.',
            }, 428)  # Precondition Required

        # 07/10/2026 (C-kb-3c): purpose parametrico (read/write/critical).
        try:
            body = request.httprequest.get_json(force=True, silent=True) or {}
        except Exception:
            body = {}
        purpose = (body.get('purpose') or 'read').strip()
        if purpose not in ('read', 'write', 'critical'):
            purpose = 'read'

        try:
            otp = request.env['erpv6.kb.otp'].sudo()._generate_otp(user, purpose)
        except Exception as e:
            _logger.exception('OTP request fallito')
            return self._json_response({'error': str(e)}, 500)

        return self._json_response({
            'ok': True,
            'otp_id': otp.id,
            'purpose': purpose,
            'expires_at': otp.expires_at.isoformat() + 'Z',
        })

    @http.route('/api/v1/kb/otp/verify',
                type='http', auth='none', methods=['POST', 'OPTIONS'],
                csrf=False)
    def otp_verify(self, **kwargs):
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        user, err = self._authenticate(require_auth=True)
        if err:
            return err
        request.update_env(user=user.id)

        try:
            body = request.httprequest.get_json(force=True, silent=True) or {}
        except Exception:
            body = {}
        otp_id = body.get('otp_id')
        code = (body.get('code') or '').strip()
        if not otp_id or not code:
            return self._json_response(
                {'error': 'otp_id e code obbligatori'}, 400)

        ip = request.httprequest.remote_addr
        ua = request.httprequest.user_agent.string if request.httprequest.user_agent else None
        result = request.env['erpv6.kb.otp'].sudo()._verify_otp(
            otp_id, code, ip, ua)
        if not result.get('ok'):
            return self._json_response(result, 400)
        # Aggiungo purpose alla risposta (il frontend lo usa per la
        # chiave localStorage corretta)
        try:
            otp_rec = request.env['erpv6.kb.otp'].sudo().browse(int(otp_id))
            if otp_rec.exists():
                result['purpose'] = otp_rec.purpose
        except Exception:
            result['purpose'] = 'read'
        return self._json_response(result)

    @http.route('/api/v1/kb/otp/bypass',
                type='http', auth='none', methods=['POST', 'OPTIONS'],
                csrf=False)
    def otp_bypass(self, **kwargs):
        """Bypass OTP solo per Denis (user_id=2), doppia conferma."""
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        user, err = self._authenticate(require_auth=True)
        if err:
            return err
        request.update_env(user=user.id)

        # Hardcoded user_id=2. Da generalizzare con campo bypass_enabled
        # su res.users se in futuro serve per altri admin.
        if user.id != 2:
            return self._json_response(
                {'error': 'Bypass non autorizzato'}, 403)

        try:
            body = request.httprequest.get_json(force=True, silent=True) or {}
        except Exception:
            body = {}
        confirm = bool(body.get('confirm'))

        if not confirm:
            return self._json_response({
                'warning': 'Bypass OTP registrato nel log. Confermi?',
                'confirm_required': True,
            })

        # Crea sessione
        import secrets as _secrets
        from datetime import timedelta as _td
        from odoo import fields as _fields
        Session = request.env['erpv6.kb.session'].sudo()
        token = _secrets.token_urlsafe(32)
        expires = _fields.Datetime.now() + _td(hours=1)
        session = Session.create({
            'user_id': 2,
            'token': token,
            'purpose': 'read',
            'expires_at': expires.isoformat() + 'Z' if hasattr(expires, 'isoformat') else str(expires) + 'Z',
            'ip_address': request.httprequest.remote_addr,
            'user_agent': (request.httprequest.user_agent.string or '')[:200] if request.httprequest.user_agent else None,
        })

        # Log rinforzato
        request.env['erpv6.kb.access.log'].sudo().create({
            'user_id': 2,
            'action': 'otp_bypass_admin',
            'details': 'BYPASS concesso. session_id=%s' % session.id,
            'ip_address': request.httprequest.remote_addr,
        })
        _logger.warning(
            'KB OTP BYPASS concesso a user 2 (Denis) da IP %s',
            request.httprequest.remote_addr)

        return self._json_response({
            'ok': True,
            'session_token': token,
            'expires_at': expires.isoformat() + 'Z',
        })

    @http.route('/api/v1/kb/otp/session',
                type='http', auth='none', methods=['DELETE', 'POST', 'OPTIONS'],
                csrf=False)
    def session_revoke(self, **kwargs):
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        user, err = self._authenticate(require_auth=True)
        if err:
            return err
        request.update_env(user=user.id)

        token = request.httprequest.headers.get('X-Kb-Session')
        if token:
            request.env['erpv6.kb.session'].sudo().search([
                ('token', '=', token),
                ('user_id', '=', user.id),
            ]).write({'revoked': True})
        return self._json_response({'ok': True})

    # ═══════════════════════════════════════════════════════════════
    # 07/10/2026 (C-kb-3c): endpoint scrittura KB.
    # Sicurezza: OTP write (15 min) per modifica, critical (5 min)
    # per creazione + publish. Il modello erpv6.kb gestisce
    # internamente crypto + versioning + gate prompt AI: l'endpoint
    # passa content in chiaro, NON cifra (decisione Q3: no crypto
    # di default, cifra al publish).
    # ═══════════════════════════════════════════════════════════════
    @http.route('/api/v1/kb/articles/<int:kb_id>',
                type='http', auth='none',
                methods=['PATCH', 'OPTIONS'], csrf=False)
    def update_article(self, kb_id, **kwargs):
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        user, err = self._authenticate(require_auth=True)
        if err:
            return err
        request.update_env(user=user.id)
        sess_err = self._require_kb_session(user=user, purpose='write')
        if sess_err:
            return sess_err

        body = request.httprequest.get_json(force=True, silent=True) or {}
        Kb = request.env['erpv6.kb'].sudo()
        kb = Kb.browse(kb_id)
        if not kb.exists():
            return self._json_response({'error': 'KB non trovata'}, 404)

        # Whitelist campi editabili via API
        allowed = {
            'name', 'description', 'kb_type', 'category_id',
            'access_level', 'content', 'content_format',
            'change_notes',
        }
        vals = {k: v for k, v in body.items() if k in allowed}
        if not vals:
            return self._json_response(
                {'error': 'Nessun campo editabile nel payload'}, 400)

        # Diff per audit (best-effort, tronco a 200 char)
        def _s(v):
            if v in (False, None):
                return None
            return str(v)[:200]
        diff = {}
        for f, new in vals.items():
            old = getattr(kb, f, None)
            if _s(old) != _s(new):
                diff[f] = {'old': _s(old), 'new': _s(new)}

        # Il write() del modello gestisce crypto + versioning + gate prompt
        kb.write(vals)

        if diff:
            self._log_kb_access(
                action='write', user=user, kb=kb,
                details=json.dumps(diff, ensure_ascii=False)[:2000],
            )

        kb.invalidate_recordset()
        return self._json_response({
            'ok': True,
            'id': kb.id,
            'version': kb.version,
            'diff': diff,
        })

    @http.route('/api/v1/kb/articles',
                type='http', auth='none',
                methods=['POST', 'OPTIONS'], csrf=False)
    def create_article(self, **kwargs):
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        user, err = self._authenticate(require_auth=True)
        if err:
            return err
        request.update_env(user=user.id)
        sess_err = self._require_kb_session(user=user, purpose='critical')
        if sess_err:
            return sess_err

        body = request.httprequest.get_json(force=True, silent=True) or {}
        for f in ('name', 'kb_type', 'content', 'category_id'):
            if not body.get(f):
                return self._json_response(
                    {'error': '%s obbligatorio' % f}, 400)

        vals = {
            'name': body['name'],
            'kb_type': body['kb_type'],
            'content': body['content'],
            'description': body.get('description', ''),
            'access_level': body.get('access_level', 'consultant'),
            'content_format': body.get('content_format', 'markdown'),
            # Q3: cifra al publish, non ora
            'is_encrypted': False,
            'author_id': user.id,
        }
        if body.get('category_id'):
            try:
                vals['category_id'] = int(body['category_id'])
            except (ValueError, TypeError):
                pass
        if body.get('tag_ids'):
            try:
                vals['tag_ids'] = [(6, 0, [int(x) for x in body['tag_ids']])]
            except (ValueError, TypeError):
                pass

        Kb = request.env['erpv6.kb'].sudo()
        kb = Kb.create(vals)

        self._log_kb_access(
            action='create', user=user, kb=kb,
            details='name=%s kb_type=%s' % (kb.name[:80], kb.kb_type),
        )

        return self._json_response({
            'ok': True,
            'id': kb.id,
            'name': kb.name,
        }, 201)

    @http.route('/api/v1/kb/articles/<int:kb_id>/publish',
                type='http', auth='none',
                methods=['POST', 'OPTIONS'], csrf=False)
    def publish_article(self, kb_id, **kwargs):
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        user, err = self._authenticate(require_auth=True)
        if err:
            return err
        request.update_env(user=user.id)
        sess_err = self._require_kb_session(user=user, purpose='critical')
        if sess_err:
            return sess_err

        Kb = request.env['erpv6.kb'].sudo()
        kb = Kb.browse(kb_id)
        if not kb.exists():
            return self._json_response({'error': 'KB non trovata'}, 404)
        body = request.httprequest.get_json(force=True, silent=True) or {}
        vals = {}
        if body.get('change_notes'):
            vals['change_notes'] = body['change_notes']
        # Q3: cifra al publish se richiesto
        if body.get('encrypt') is True or body.get('is_encrypted') is True:
            vals['is_encrypted'] = True

        kb.write(vals)
        # v1: publish = bump version manuale (no is_final sul modello)
        kb.write({'version': (kb.version or 1) + 1})
        kb.invalidate_recordset()

        self._log_kb_access(
            action='publish', user=user, kb=kb,
            details='publish version=%s encrypted=%s' % (
                kb.version, kb.is_encrypted),
        )

        return self._json_response({
            'ok': True,
            'id': kb.id,
            'version': kb.version,
            'is_encrypted': kb.is_encrypted,
        })
