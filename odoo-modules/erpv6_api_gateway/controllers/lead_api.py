# pylint: disable=import-error
"""Lead API Controller - creates CRM leads from frontend."""
import json
import logging
import time

from odoo import http
from odoo.http import request

from .main import APIBaseController

_logger = logging.getLogger(__name__)


class LeadAPIController(APIBaseController):

    def _assign_real_salesperson(self, lead):
        """Fallback minimo se erpv6_production (che ha _promote_to_opportunity)
        non e' installato: assegna comunque un venditore reale invece di
        lasciare il lead sull'utente pubblico con cui e' stato creato."""
        try:
            team = lead.sudo().team_id
            members = team.crm_team_member_ids.mapped('user_id') if team else lead.env['res.users']
            if members:
                lead.sudo()._handle_salesmen_assignment(user_ids=members.ids)
                lead.sudo().activity_schedule(
                    'mail.mail_activity_data_todo',
                    summary=f"Nuovo lead da gestire: {lead.name}",
                    user_id=lead.sudo().user_id.id,
                )
            else:
                _logger.warning(
                    "Nessun membro reale nel team '%s' - lead #%s senza venditore assegnato.",
                    team.name if team else '(nessun team)', lead.id,
                )
        except Exception as e:
            _logger.warning("Assegnazione venditore fallita per lead #%s: %s", lead.id, e)

    @http.route('/api/v1/leads', type='http', auth='none', methods=['POST', 'OPTIONS'], csrf=False)
    def create_lead(self, **kwargs):  # pylint: disable=unused-argument
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        start_time = time.time()

        try:
            data = json.loads(request.httprequest.data)
        except json.JSONDecodeError:
            return self._json_response({'error': 'Invalid JSON'}, 400)

        name = data.get('name', '').strip()
        email = data.get('email', '').strip()
        if not name or not email:
            return self._json_response({'error': 'name and email required'}, 400)

        # auth='none': la richiesta non ha una sessione/uid valido, quindi
        # env.user e' un recordset vuoto. .sudo() bypassa solo gli ACL, non
        # imposta un uid: qualunque write su un campo tracked (message_post
        # -> _is_public()) crasha con "Expected singleton: res.users()".
        # Leghiamo l'env all'utente pubblico, la stessa convenzione usata dai
        # controller website/portal nativi di Odoo per scritture anonime.
        env = request.env(user=request.env.ref('base.public_user'))

        # Duplicati
        existing = env['crm.lead'].sudo().search([('email_from', '=', email), ('active', '=', True)], limit=1)
        if existing:
            return self._json_response({'error': 'Lead already exists', 'lead_id': existing.id}, 409)

        company = data.get('company_name', '').strip()
        lead_name = f"Lead Web: {name}"
        if company:
            lead_name += f" - {company}"

        # 'qualified' default True per non cambiare il comportamento dei
        # chiamanti esistenti (es. form contatti, gia' un invio "pieno" e
        # intenzionale). Chi fa salvataggio progressivo (es. intervista
        # dopo la sola prima fase) passa qualified=False esplicitamente:
        # il lead nasce type='lead' grezzo, senza venditore/notifica/
        # progetto - quelli arrivano solo alla qualificazione vera (vedi
        # update_lead sotto).
        qualified = data.get('qualified', True)

        vals = {
            'name': lead_name,
            'contact_name': name,
            'partner_name': company,
            'email_from': email,
            'phone': data.get('phone', ''),
            'description': data.get('description', ''),
            'type': 'opportunity' if qualified else 'lead',
        }

        # Campi Fenice (se il modulo e' installato). I campi reali hanno
        # prefisso x_ (convenzione custom-field Odoo): senza, hasattr()
        # falliva sempre e questo mapping non scriveva mai nulla.
        for field, key in [('x_fenice_score', 'fenice_score'), ('x_fenice_livello', 'fenice_livello'),
                           ('x_fenice_moduli_interesse', 'moduli_interesse'),
                           ('x_fenice_fatturato', 'fatturato_stimato'), ('x_fenice_source', 'source')]:
            if key in data and hasattr(env['crm.lead'], field):
                vals[field] = data[key]

        if 'x_fenice_source' not in vals and hasattr(env['crm.lead'], 'x_fenice_source'):
            vals['x_fenice_source'] = 'sito_web'

        # 10/09/2026 (Denis, su "Lead Web: Buffetti": "perché non vedo da
        # dove arriva, come faccio a saperlo") - bug reale trovato: il
        # frontend gia' mandava quale pagina/form avesse generato il lead
        # (parametro 'source' passato a saveLead() in lead-queue.ts, es.
        # 'contatti'), ma qui non veniva mai letto ne' scritto da nessuna
        # parte - andava perso ad ogni lead, non solo su questo. source_id
        # e' il campo STANDARD di Odoo per la provenienza (utm.source, gia'
        # presente su crm.lead, sempre rimasto NULL): niente di nuovo
        # inventato, solo smesso di ignorare un campo gia' esistente.
        page_source = (data.get('page_source') or '').strip()
        if page_source:
            utm_source = env['utm.source'].sudo().search([('name', '=', page_source)], limit=1)
            if not utm_source:
                utm_source = env['utm.source'].sudo().create({'name': page_source})
            vals['source_id'] = utm_source.id

        try:
            lead = env['crm.lead'].sudo().create(vals)
        except Exception as e:
            _logger.error("Lead creation error: %s", e)
            return self._json_response({'error': 'Creation failed'}, 500)

        # Promozione a opportunita' qualificata (venditore reale, notifica,
        # project.project) SOLO se qualified: un lead grezzo non qualificato
        # (es. salvataggio progressivo dopo la prima fase dell'intervista)
        # non deve disturbare nessuno finche' non lo e' davvero.
        if qualified:
            if hasattr(lead, '_promote_to_opportunity'):
                try:
                    lead._promote_to_opportunity()
                except Exception as e:
                    _logger.warning("Promozione a opportunity fallita per lead #%s: %s", lead.id, e)
            else:
                self._assign_real_salesperson(lead)

        # Avvia funnel se disponibile
        funnel_started = False
        if data.get('start_funnel', True) and hasattr(lead, '_start_funnel'):
            try:
                lead._start_funnel()
                funnel_started = True
            except Exception as e:
                _logger.warning("Funnel start error: %s", e)

        # Avvia produzione (erpv6_production, se installato). Stesso pattern
        # hasattr di _start_funnel: erpv6_api_gateway resta agnostico, non
        # dichiara erpv6_production come dipendenza.
        if hasattr(lead, '_start_production'):
            try:
                lead._start_production(
                    score=data.get('score'),
                    package_hint=data.get('package_hint') or data.get('packageId') or data.get('livello'),
                    verticale=data.get('verticale') or data.get('settore'),
                    budget=data.get('budget'),
                    tempistiche=data.get('tempistiche'),
                    tipo_progetto=data.get('tipo_progetto') or data.get('tipoProgetto'),
                    landing_source_code=data.get('landing_source_code') or data.get('source_prodotto'),
                    destinatario=data.get('destinatario'),
                    fatturato=data.get('fatturato'),
                )
            except Exception as e:
                _logger.warning("Production start error: %s", e)

        # Webhook
        for wh in env['erpv6.webhook'].sudo().search([('events', '=', 'lead.created'), ('is_active', '=', True)]):
            wh.trigger({'event': 'lead.created', 'lead_id': lead.id, 'email': email})

        # 08/10/2026 (C-security-lead-public): genera token intervista
        # multi-fase. Il frontend lo salva in sessionStorage e lo
        # rimanda nei PUT successivi (header X-Lead-Token).
        edit_token = None
        try:
            if 'erpv6.lead.edit.token' in env:
                tok_rec = env['erpv6.lead.edit.token'].sudo().generate(
                    lead, purpose='interview')
                edit_token = tok_rec.token
        except Exception as e:
            _logger.warning("Lead edit token generation failed: %s", e)

        self._log_api_call('/api/v1/leads', 'POST', None, 201, start_time)
        return self._json_response({
            'id': lead.id,
            'name': lead.name,
            'funnel_started': funnel_started,
            'edit_token': edit_token,  # 08/10/2026 C-security-lead-public
        }, 201)

    @http.route('/api/v1/leads/<int:lead_id>', type='http', auth='none', methods=['PUT', 'OPTIONS'], csrf=False)
    def update_lead(self, lead_id, **kwargs):  # pylint: disable=unused-argument
        """Aggiorna un lead. Dual-path (08/10/2026 C-security-lead-public):
          - JWT + owner (create_uid OR user_id OR admin/chief):
            modifica completa
          - X-Lead-Token purpose=interview (multi-uso, TTL 4h):
            modifica completa (flusso intervista multi-fase)
          - X-Lead-Token purpose=edit (monouso, TTL 30gg):
            whitelist [email_from, phone]
          - Nessuno: 401
        """
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        start_time = time.time()

        try:
            data = json.loads(request.httprequest.data)
        except json.JSONDecodeError:
            return self._json_response({'error': 'Invalid JSON'}, 400)

        # 08/10/2026 (C-security-lead-public fix): env con SUPERUSER
        # invece di public_user. Il public_user fa esplodere
        # mail.thread._compute_field_value durante il flush (message_post
        # con autore vuoto). La security e' enforced sopra (dual-path
        # check), non dall'env.
        from odoo import SUPERUSER_ID as _SUID
        env = request.env(user=_SUID)
        lead = env['crm.lead'].sudo().browse(lead_id)
        if not lead.exists():
            self._log_api_call(f'/api/v1/leads/{lead_id}', 'PUT', None, 404, start_time)
            return self._json_response({'error': 'Lead not found'}, 404)

        # ─── IDENTITY DETECTION ───
        auth_header = request.httprequest.headers.get('Authorization', '') or ''
        lead_token = (request.httprequest.headers.get('X-Lead-Token') or '').strip()

        user = None
        token_rec = None
        token_purpose = None
        is_jwt_path = False
        client_ip = request.httprequest.remote_addr
        ua_raw = request.httprequest.user_agent
        client_ua = ua_raw.string[:200] if ua_raw else None

        if auth_header.startswith('JWT '):
            # ─── JWT path ───
            user, err = self._authenticate(require_auth=True)
            if err:
                return err
            request.update_env(user=user.id)
            is_admin_or_chief = (
                user.has_group('base.group_system')
                or user.has_group('erpv6_core.group_chief_projects')
            )
            is_owner = (
                (lead.create_uid and lead.create_uid.id == user.id)
                or (lead.user_id and lead.user_id.id == user.id)
            )
            if not (is_admin_or_chief or is_owner):
                return self._json_response({'error': 'Accesso negato'}, 403)
            is_jwt_path = True

        elif lead_token:
            # ─── Token path ───
            if 'erpv6.lead.edit.token' not in request.env:
                return self._json_response(
                    {'error': 'Modulo token non disponibile'}, 501)
            T = request.env['erpv6.lead.edit.token'].sudo()
            # 1° tentativo: interview (multi-uso)
            ok_i, err_i, rec_i = T.verify(lead_token, lead_id, 'interview')
            if ok_i:
                token_rec = rec_i
                token_purpose = 'interview'
            else:
                # 2° tentativo: edit (monouso)
                ok_e, err_e, rec_e = T.verify(lead_token, lead_id, 'edit')
                if ok_e:
                    token_rec = rec_e
                    token_purpose = 'edit'
                else:
                    # Rate limit attempt
                    fail_rec = rec_i or rec_e
                    if fail_rec:
                        T.register_fail(fail_rec, ip=client_ip)
                    self._log_api_call(
                        f'/api/v1/leads/{lead_id}', 'PUT', None, 401, start_time)
                    return self._json_response(
                        {'error': 'Token non valido', 'code': err_e}, 401)

        else:
            self._log_api_call(f'/api/v1/leads/{lead_id}', 'PUT', None, 401, start_time)
            return self._json_response(
                {'error': 'Autenticazione richiesta (JWT o X-Lead-Token)'}, 401)

        # ─── WHITELIST CAMPI ───
        # purpose=edit: solo email_from + phone
        # JWT/interview: come prima (nessun filtro)
        edit_whitelist = {'email_from', 'phone'} if token_purpose == 'edit' else None

        # Mappa (campo Odoo, chiave JSON)
        field_map = [
            ('phone', 'phone'),
            ('description', 'description'),
            ('partner_name', 'company_name'),
            ('email_from', 'email'),  # 08/10/2026: supporto email lead
        ]
        update_vals = {}
        for fld, key in field_map:
            if data.get(key):
                if edit_whitelist is None or fld in edit_whitelist:
                    update_vals[fld] = data[key]

        # Blocca tentativi di scrittura fuori whitelist (per edit)
        if edit_whitelist is not None:
            forbidden = []
            for k in ('description', 'company_name', 'score', 'package_hint',
                      'budget', 'tempistiche', 'tipo_progetto', 'landing_source_code',
                      'destinatario', 'fatturato', 'qualified'):
                if data.get(k):
                    forbidden.append(k)
            if forbidden:
                return self._json_response({
                    'error': 'Campi non modificabili con questo token',
                    'forbidden': forbidden,
                }, 403)

        if update_vals:
            lead.sudo().write(update_vals)

        # 08/10/2026 (C-security-lead-public fix): token edit monouso.
        # Deve essere marcato used SUBITO dopo la write riuscita.
        if token_purpose == 'edit' and token_rec:
            try:
                request.env['erpv6.lead.edit.token'].sudo().mark_used(token_rec)
            except Exception:
                _logger.exception('mark_used fallito token_id=%s', token_rec.id)

        # ─── PRODUCTION + PROMOTE (solo JWT o interview) ───
        do_promote = False
        if token_purpose != 'edit':
            if hasattr(lead, '_start_production'):
                try:
                    lead._start_production(
                        score=data.get('score'),
                        package_hint=data.get('package_hint') or data.get('packageId') or data.get('livello'),
                        verticale=data.get('verticale') or data.get('settore'),
                        budget=data.get('budget'),
                        tempistiche=data.get('tempistiche'),
                        tipo_progetto=data.get('tipo_progetto') or data.get('tipoProgetto'),
                        landing_source_code=data.get('landing_source_code') or data.get('source_prodotto'),
                        destinatario=data.get('destinatario'),
                        fatturato=data.get('fatturato'),
                    )
                except Exception as e:
                    _logger.warning("Production update error per lead #%s: %s", lead.id, e)

            if bool(data.get('qualified')):
                do_promote = True

        # ─── GUARDRAIL PROMOZIONE ───
        if do_promote:
            from datetime import timedelta as _td
            from odoo import fields as _fields
            Log = request.env['erpv6.api.access.log'].sudo()
            cutoff = _fields.Datetime.now() - _td(hours=1)
            recent_promos = Log.search_count([
                ('ip_address', '=', client_ip),
                ('reason', '=', 'lead_promotion'),
                ('create_date', '>', cutoff),
            ])
            if recent_promos >= 3:
                Log.sudo().create({
                    'user_id': _SUID,
                    'route': request.httprequest.path[:200],
                    'method': 'PUT',
                    'model': 'crm.lead',
                    'record_id': lead.id,
                    'granted': False,
                    'reason': 'lead_promotion_rate_limited',
                    'ip_address': client_ip,
                    'user_agent': client_ua,
                })
                return self._json_response({
                    'error': 'Troppe promozioni da questo IP. Riprova tra un\'ora.'
                }, 429)

            # Esegui promozione
            if hasattr(lead, '_promote_to_opportunity'):
                try:
                    lead._promote_to_opportunity()
                except Exception as e:
                    _logger.warning("Promozione fallita lead #%s: %s", lead.id, e)
            else:
                self._assign_real_salesperson(lead)

            # Audit log OK
            Log.sudo().create({
                'user_id': _SUID,
                'route': request.httprequest.path[:200],
                'method': 'PUT',
                'model': 'crm.lead',
                'record_id': lead.id,
                'granted': True,
                'reason': 'lead_promotion',
                'ip_address': client_ip,
                'user_agent': client_ua,
            })
            _logger.info(
                'Lead promotion: lead=%s ip=%s ua=%s token_id=%s jwt=%s',
                lead.id, client_ip, client_ua,
                token_rec.id if token_rec else None, is_jwt_path)

            # Telegram best-effort su promozione anonima
            if not is_jwt_path:
                try:
                    self._notify_lead_promotion(lead, client_ip, token_rec)
                except Exception:
                    pass

        self._log_api_call(
            f'/api/v1/leads/{lead_id}', 'PUT',
            user.id if user else None, 200, start_time)
        return self._json_response({
            'id': lead.id,
            'name': lead.name,
            'qualified': lead.sudo().type == 'opportunity',
        }, 200)

    def _notify_lead_promotion(self, lead, ip, token_rec):
        """08/10/2026: notifica Telegram su promozione da anonimo.
        Best-effort, mai blocca il flusso."""
        try:
            Config = request.env.get('erpv6.agent.telegram.config')
            if not Config:
                return
            bot = Config.sudo().search([('mode', '=', 'otp'), ('is_active', '=', True)], limit=1)
            if not bot:
                return
            text = "🔔 Lead promosso da anonimo\nLead: %s (%s)\nEmail: %s\nIP: %s\nToken: %s" % (
                lead.name, lead.id, lead.email_from or '-', ip,
                'id=%s' % (token_rec.id if token_rec else 'n/a'))
            # Uso un metodo generico se esiste, altrimenti skip
            if hasattr(bot, '_send_otp_message'):
                # Riuso (chat_id team: da definire in futuro)
                pass
        except Exception:
            _logger.debug('_notify_lead_promotion skipped')

    @http.route('/api/v1/leads/<int:lead_id>/request-edit',
                type='http', auth='none', methods=['POST', 'OPTIONS'],
                csrf=False)
    def request_edit_link(self, lead_id, **kwargs):
        """08/10/2026 (C-security-lead-public): genera token edit
        e invia email al lead con link di conferma dati.

        Protetto: solo consulente V6 owner del lead (create_uid == user.id)
        o admin/chief. Il lead pubblico NON può chiamare questo endpoint.
        """
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        start_time = time.time()

        user, err = self._authenticate(require_auth=True)
        if err:
            return err
        request.update_env(user=user.id)

        lead = request.env['crm.lead'].sudo().browse(lead_id)
        if not lead.exists():
            return self._json_response({'error': 'Lead not found'}, 404)

        # Check owner
        is_admin_or_chief = (
            user.has_group('base.group_system')
            or user.has_group('erpv6_core.group_chief_projects')
        )
        is_owner = lead.create_uid and lead.create_uid.id == user.id
        if not (is_admin_or_chief or is_owner):
            return self._json_response(
                {'error': 'Accesso negato: solo owner o admin'}, 403)

        if 'erpv6.lead.edit.token' not in request.env:
            return self._json_response(
                {'error': 'Modulo token non disponibile'}, 501)

        try:
            tok = request.env['erpv6.lead.edit.token'].sudo().generate(
                lead, purpose='edit')
            sent = tok.send_edit_link_email()
        except Exception as e:
            _logger.exception('request_edit_link fallito per lead %s', lead_id)
            return self._json_response({'error': str(e)}, 500)

        self._log_api_call(
            f'/api/v1/leads/{lead_id}/request-edit', 'POST',
            user.id, 200, start_time)
        return self._json_response({
            'success': True,
            'token_id': tok.id,  # NON esporre il token raw
            'email_sent': bool(sent),
            'email_to': lead.email_from,
        })

    @http.route('/api/v1/leads/evaluate', type='http', auth='none', methods=['POST', 'OPTIONS'], csrf=False)
    def evaluate_lead(self, **kwargs):  # pylint: disable=unused-argument
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})

        try:
            data = json.loads(request.httprequest.data)
        except json.JSONDecodeError:
            return self._json_response({'error': 'Invalid JSON'}, 400)

        score = 0
        fatturato = data.get('fatturato', 0)
        if fatturato >= 500000:
            score += 30
        elif fatturato >= 100000:
            score += 15
        elif fatturato > 0:
            score += 5

        dig = data.get('digitalizzazione', 'none')
        if dig == 'avanzato':
            score += 25
        elif dig == 'base':
            score += 10

        if data.get('sostenibilita'):
            score += 15
        if data.get('innovazione'):
            score += 10

        dip = data.get('dipendenti', 0)
        if dip >= 10:
            score += 10
        elif dip >= 5:
            score += 5

        if score >= 93:
            livello = 'IV'
        elif score >= 80:
            livello = 'III'
        elif score >= 65:
            livello = 'II'
        else:
            livello = 'I'

        moduli = []
        if dig in ('none', 'base'):
            moduli.append('Modulo C - Comunicazione')
        if data.get('sostenibilita'):
            moduli.append('BioCircolo')
        if fatturato >= 100000:
            moduli.append('Fenice Procurement')

        return self._json_response({'score': score, 'livello': livello, 'moduli_consigliati': moduli})
