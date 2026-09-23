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


class ConsultantAPIController(APIBaseController):

    def _is_responsabile_o_admin(self, user):
        return user.has_group('base.group_system') or user.has_group('sales_team.group_sale_manager')

    def _not_installed(self, path, start_time):
        self._log_api_call(path, 'GET', None, 501, start_time)
        return self._json_response({'error': 'erpv6_production non installato'}, 501)

    # ------------------------------------------------------------------
    # Tab "Progetti": erpv6.production.order/crm.lead del consulente
    # loggato (o di TUTTI se Responsabile/Admin passa ?all=1 - azione in
    # piu' riservata al suo ruolo, vedi compito 3).
    # ------------------------------------------------------------------
    @http.route('/api/v1/consultant/projects', type='http', auth='none', methods=['GET', 'OPTIONS'], csrf=False)
    def get_consultant_projects(self, **kwargs):  # pylint: disable=unused-argument
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        start_time = time.time()
        user, error_response = self._authenticate(require_auth=True)
        if error_response:
            return error_response

        env = request.env
        if 'erpv6.production.order' not in env:
            return self._not_installed('/api/v1/consultant/projects', start_time)

        is_admin = self._is_responsabile_o_admin(user)
        show_all = is_admin and kwargs.get('all') in ('1', 'true', 'True')
        domain = [] if show_all else [('lead_id.user_id', '=', user.id)]

        Order = env['erpv6.production.order'].sudo()
        orders = Order.search(domain, order='create_date desc')

        def role_labels(lead):
            mine = lead.consulente_line_ids.filtered(lambda l: l.user_id.id == user.id)
            return [dict(l._fields['role'].selection).get(l.role) for l in mine]

        projects = []
        for order in orders:
            lead = order.lead_id
            projects.append({
                'id': order.id,
                'lead_id': lead.id,
                'name': lead.name or order.name,
                'client': lead.partner_name or lead.contact_name or '',
                'phase': order.phase_id.name or '',
                'verticale': order.verticale or '',
                'package_hint': order.interview_package_hint or '',
                'lead_type': lead.type,
                'consulente': lead.user_id.name if lead.user_id else '',
                'consulente_id': lead.user_id.id if lead.user_id else None,
                'ruoli_miei': role_labels(lead),
                'create_date': order.create_date.isoformat() if order.create_date else None,
            })

        # Lead gia' sourced dal consulente (o comunque suoi) ma senza
        # ancora una erpv6.production.order (es. intervista dalla dashboard
        # avviata ma non ancora completata, vedi _start_production) - non
        # vanno nascosti silenziosamente, sono comunque un "progetto" reale
        # in corso agli occhi del consulente, solo non ancora arrivato in
        # produzione.
        Lead = env['crm.lead'].sudo()
        lead_domain = [] if show_all else [('user_id', '=', user.id)]
        leads_without_order = Lead.search(lead_domain + [('id', 'not in', orders.mapped('lead_id').ids)],
                                           order='create_date desc')
        leads_pending = [{
            'id': lead.id,
            'name': lead.name,
            'client': lead.partner_name or lead.contact_name or '',
            'type': lead.type,
            'consulente': lead.user_id.name if lead.user_id else '',
            'ruoli_miei': role_labels(lead),
            'create_date': lead.create_date.isoformat() if lead.create_date else None,
        } for lead in leads_without_order]

        self._log_api_call('/api/v1/consultant/projects', 'GET', user.id, 200, start_time)
        return self._json_response({
            'is_admin': is_admin,
            'showing_all': show_all,
            'orders': projects,
            'leads_senza_produzione': leads_pending,
        })

    # ------------------------------------------------------------------
    # Tab "Richieste": erpv6.consulente.richiesta - un Consulente vede/crea
    # solo le proprie, un Responsabile/Admin vede tutte (default) e puo'
    # approvare/rifiutare (azione in piu' riservata al suo ruolo).
    # ------------------------------------------------------------------
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
    @http.route('/api/v1/consultant/emails', type='http', auth='none', methods=['GET', 'OPTIONS'], csrf=False)
    def get_consultant_emails(self, **kwargs):  # pylint: disable=unused-argument
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        start_time = time.time()
        user, error_response = self._authenticate(require_auth=True)
        if error_response:
            return error_response

        env = request.env
        if 'erpv6.winwin.email.log' not in env:
            self._log_api_call('/api/v1/consultant/emails', 'GET', user.id, 501, start_time)
            return self._json_response({'error': 'erpv6_winwin_renderdata non installato'}, 501)

        is_admin = self._is_responsabile_o_admin(user)
        show_all = is_admin and kwargs.get('all') in ('1', 'true', 'True')

        domain = [] if show_all else [('recipient_user_id', '=', user.id)]
        # 22/09/2026: escludi archiviate (o mostra solo archiviate con ?archived=1)
        if kwargs.get('archived') in ('1','true','True'):
            domain.append(('is_archived', '=', True))
        else:
            domain.append(('is_archived', '=', False))
        # opzionale filtro per progetto
        relation_id = kwargs.get('relation_id')
        if relation_id:
            try:
                domain.append(('relation_id', '=', int(relation_id)))
            except (ValueError, TypeError):
                pass

        limit = min(int(kwargs.get('limit') or 50), 200)
        Log = env['erpv6.winwin.email.log'].sudo()
        logs = Log.search(domain, order='create_date desc', limit=limit)

        emails = [{
            'id': l.id,
            'subject': l.name or '(senza oggetto)',
            'sender_email': l.sender_email or '',
            'recipient_emails': l.recipient_emails or '',
            'cc_emails': l.cc_emails or '',
            'match_status': l.match_status,
            'matched_alias': l.matched_alias or '',
            'relation_id': l.relation_id.id if l.relation_id else None,
            'relation_name': l.relation_id.name if l.relation_id else None,
            'recipient_user_id': l.recipient_user_id.id if l.recipient_user_id else None,
            'recipient_user_name': l.recipient_user_id.name if l.recipient_user_id else None,
            'create_date': l.create_date.isoformat() if l.create_date else None,
        } for l in logs]

        self._log_api_call('/api/v1/consultant/emails', 'GET', user.id, 200, start_time)
        return self._json_response({
            'is_admin': is_admin,
            'showing_all': show_all,
            'count': len(emails),
            'emails': emails,
        })

    # ------------------------------------------------------------------
    # Tab "Pagamenti" (21/09/2026): compensi del consulente calcolati dallo
    # split V6 dei progetti dove compare come beneficiario 'consulente'.
    # Fonte: erpv6.tracking.relation.x_v6_revenue_split (JSON).
    # ------------------------------------------------------------------
    @http.route('/api/v1/consultant/payments', type='http', auth='none', methods=['GET', 'OPTIONS'], csrf=False)
    def get_consultant_payments(self, **kwargs):  # pylint: disable=unused-argument
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        start_time = time.time()
        user, error_response = self._authenticate(require_auth=True)
        if error_response:
            return error_response

        env = request.env
        if 'erpv6.tracking.relation' not in env:
            self._log_api_call('/api/v1/consultant/payments', 'GET', user.id, 501, start_time)
            return self._json_response({'error': 'aeosv6_relation non installato'}, 501)

        Relation = env['erpv6.tracking.relation'].sudo()
        roots = Relation.search([('parent_id', '=', False), ('x_v6_revenue_split', '!=', False)])

        my_partner_id = user.partner_id.id
        payments = []

        for root in roots:
            try:
                split = json.loads(root.x_v6_revenue_split or '{}')
            except (json.JSONDecodeError, TypeError):
                continue

            beneficiari = split.get('beneficiari') or []
            mine = None
            for b in beneficiari:
                if (b.get('res_partner_id') == my_partner_id
                        and b.get('tipo') == 'consulente'):
                    mine = b
                    break
            if not mine:
                continue

            base = split.get('base') or {}
            base_tipo = base.get('tipo', 'fisso_unita')
            base_valore = float(base.get('valore') or 0)
            base_unita = base.get('unita') or ''
            mia_pct = float(mine.get('pct') or 0)

            payments.append({
                'project_id': root.id,
                'project_name': root.name,
                'base_tipo': base_tipo,
                'base_valore': base_valore,
                'base_unita': base_unita,
                'mia_pct': mia_pct,
                'mia_quota_teorica': round(base_valore * mia_pct / 100.0, 4),
                'split_approvato': bool(root.revenue_split_approved),
                'split_approvato_il': root.revenue_split_approved_at.isoformat() if root.revenue_split_approved_at else None,
                'split_hash': root.revenue_split_hash or '',
            })

        self._log_api_call('/api/v1/consultant/payments', 'GET', user.id, 200, start_time)
        return self._json_response({
            'count': len(payments),
            'payments': payments,
        })

    # ------------------------------------------------------------------
    # Playbook (23/09/2026): vista pronta da condividere col consulente.
    # Aggrega charter + dossier + target ideali + contatti scouting + KPI.
    # Solo owner/access/split possono vederlo.
    # ------------------------------------------------------------------
    @http.route('/api/v1/consultant/projects/<int:relation_id>/playbook', type='http', auth='none',
                methods=['GET', 'OPTIONS'], csrf=False)
    def get_consultant_project_playbook(self, relation_id, **kwargs):
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        user, err = self._authenticate(require_auth=True)
        if err: return err
        env = request.env
        Relation = env['erpv6.tracking.relation'].sudo()
        root = Relation.browse(relation_id)
        if not root.exists():
            return self._json_response({'error': 'Progetto non trovato'}, 404)
        is_admin = self._is_responsabile_o_admin(user)
        if not is_admin:
            in_access = user.id in (root.access_user_ids.ids or [])
            is_owner = root.owner_user_id.id == user.id
            in_split = False
            try:
                split = json.loads(root.x_v6_revenue_split or '{}')
                in_split = any(
                    b.get('res_partner_id') == user.partner_id.id and b.get('tipo') == 'consulente'
                    for b in (split.get('beneficiari') or []))
            except Exception:
                pass
            if not (is_owner or in_access or in_split):
                return self._json_response({'error': 'Non hai accesso'}, 403)

        charter = None
        try: charter = json.loads(root.x_v6_charter or '{}') if root.x_v6_charter else None
        except Exception: pass
        scouting = None
        try: scouting = json.loads(root.x_v6_scouting or '{}') if root.x_v6_scouting else None
        except Exception: pass

        targets = root.child_ids.filtered(lambda c: c.funzione_progetto == 'target')
        targets_data = []
        for t in targets:
            p = t.partner_id
            c = t.contatto_principale_id
            targets_data.append({
                'id': t.id, 'name': t.name,
                'partner_name': p.name if p else None,
                'partner_email': p.email if p else None,
                'partner_phone': p.phone if p else None,
                'contatto_name': c.name if c else None,
                'stage_name': t.stage_id.name if t.stage_id else None,
                'state': t.state,
            })

        return self._json_response({
            'id': root.id,
            'name': root.name,
            'email_alias': root.email_alias or '',
            'phase': root.state,
            'charter': charter,
            'scouting': scouting,
            'targets': targets_data,
            'target_count': len(targets_data),
        })

    # ------------------------------------------------------------------
    # Split V6 personale (23/09/2026): dettaglio + accetta/rifiuta.
    # ------------------------------------------------------------------
    @http.route('/api/v1/consultant/projects/<int:relation_id>/my-split', type='http', auth='none',
                methods=['GET', 'OPTIONS'], csrf=False)
    def get_my_split(self, relation_id, **kwargs):
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        user, err = self._authenticate(require_auth=True)
        if err: return err
        env = request.env
        root = env['erpv6.tracking.relation'].sudo().browse(relation_id)
        if not root.exists():
            return self._json_response({'error': 'Progetto non trovato'}, 404)
        try:
            split = json.loads(root.x_v6_revenue_split or '{}')
        except (json.JSONDecodeError, TypeError):
            split = {}
        beneficiari = split.get('beneficiari') or []
        base = split.get('base') or {}
        mine = next((b for b in beneficiari if b.get('res_partner_id') == user.partner_id.id), None)
        if not mine:
            return self._json_response({'has_split': False})
        # has_fiscal_data?
        p = user.partner_id
        has_fiscal = bool(p.l10n_it_codice_fiscale and p.street and p.city and p.zip)
        return self._json_response({
            'has_split': True,
            'pct': float(mine.get('pct') or 0),
            'base_tipo': base.get('tipo'),
            'base_valore': float(base.get('valore') or 0),
            'base_unita': base.get('unita') or '',
            'approved': bool(root.revenue_split_approved),
            'accepted_at': root.revenue_split_accepted_at.isoformat() if root.revenue_split_accepted_at else None,
            'accepted_by_name': root.revenue_split_accepted_by.name if root.revenue_split_accepted_by else None,
            'rejected_reason': root.revenue_split_rejected_reason or None,
            'rejected_at': root.revenue_split_rejected_at.isoformat() if root.revenue_split_rejected_at else None,
            'notified_at': root.revenue_split_notified_at.isoformat() if root.revenue_split_notified_at else None,
            'has_fiscal_data': has_fiscal,
        })

    @http.route('/api/v1/consultant/projects/<int:relation_id>/accept-split', type='http', auth='none',
                methods=['POST', 'OPTIONS'], csrf=False)
    def post_accept_split(self, relation_id, **kwargs):
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        user, err = self._authenticate(require_auth=True)
        if err: return err
        env = request.env
        root = env['erpv6.tracking.relation'].sudo().browse(relation_id)
        if not root.exists():
            return self._json_response({'error': 'Progetto non trovato'}, 404)
        try:
            split = json.loads(root.x_v6_revenue_split or '{}')
        except (json.JSONDecodeError, TypeError):
            split = {}
        mine = next(
            (b for b in (split.get('beneficiari') or []) if b.get('res_partner_id') == user.partner_id.id),
            None,
        )
        if not mine:
            return self._json_response({'error': 'Non sei nello split di questo progetto'}, 403)
        root.write({
            'revenue_split_accepted_at': fields.Datetime.now(),
            'revenue_split_accepted_by': user.id,
            'revenue_split_rejected_reason': False,
            'revenue_split_rejected_at': False,
        })
        return self._json_response({'success': True})

    @http.route('/api/v1/consultant/projects/<int:relation_id>/reject-split', type='http', auth='none',
                methods=['POST', 'OPTIONS'], csrf=False)
    def post_reject_split(self, relation_id, **kwargs):
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        user, err = self._authenticate(require_auth=True)
        if err: return err
        try:
            data = json.loads(request.httprequest.body or b'{}')
        except json.JSONDecodeError:
            data = {}
        reason = (data.get('reason') or '').strip()
        if not reason:
            return self._json_response({'error': 'Il motivo del rifiuto è obbligatorio'}, 400)
        env = request.env
        root = env['erpv6.tracking.relation'].sudo().browse(relation_id)
        if not root.exists():
            return self._json_response({'error': 'Progetto non trovato'}, 404)
        try:
            split = json.loads(root.x_v6_revenue_split or '{}')
        except (json.JSONDecodeError, TypeError):
            split = {}
        mine = next(
            (b for b in (split.get('beneficiari') or []) if b.get('res_partner_id') == user.partner_id.id),
            None,
        )
        if not mine:
            return self._json_response({'error': 'Non sei nello split'}, 403)
        root.write({
            'revenue_split_rejected_reason': reason,
            'revenue_split_rejected_at': fields.Datetime.now(),
            'revenue_split_accepted_at': False,
            'revenue_split_accepted_by': False,
            'revenue_split_state': 'rifiutato',
        })

        # notifica admin (Denis) con motivazione
        try:
            admin = env.ref('base.user_admin', raise_if_not_found=False)
            if admin and admin.partner_id:
                server = env['ir.mail_server'].sudo().search(
                    [('from_filter', '=', 'v6sviluppoimpresa.it')], limit=1)
                ctx = root.with_context(
                    mail_server_id=server.id if server else False,
                    email_from='V6impresa Sistema <sistema@v6sviluppoimpresa.it>',
                )
                ctx.message_notify(
                    partner_ids=[admin.partner_id.id],
                    subject=f'[Rifiuto] Split {root.name} rifiutato da {user.name}',
                    body=(
                        f'<p><b>{user.name}</b> ha <b>rifiutato</b> lo split del progetto <b>{root.name}</b>.</p>'
                        f'<p><b>Motivazione:</b></p>'
                        f'<blockquote style="border-left:3px solid #ccc;padding-left:10px;color:#444;">'
                        f'{reason}</blockquote>'
                        f'<p>Puoi ora modificare lo split e rimandarlo in firma.</p>'
                    ),
                    subtype_xmlid='mail.mt_comment',
                )
        except Exception:
            _logger.exception('Notifica rifiuto ad admin fallita')

        return self._json_response({'success': True})

    # ------------------------------------------------------------------
    # Dati fiscali consulente (23/09/2026): form dashboard.
    # ------------------------------------------------------------------
    @http.route('/api/v1/consultant/me/fiscal-data', type='http', auth='none',
                methods=['GET', 'OPTIONS'], csrf=False)
    def get_my_fiscal_data(self, **kwargs):
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        user, err = self._authenticate(require_auth=True)
        if err: return err
        p = user.partner_id
        return self._json_response({
            'vat': p.vat or '',
            'codice_fiscale': p.l10n_it_codice_fiscale or '',
            'street': p.street or '',
            'street2': p.street2 or '',
            'city': p.city or '',
            'zip': p.zip or '',
            'country': p.country_id.name if p.country_id else '',
            'email': p.email or '',
            'phone': p.phone or '',
            'confirmed_at': p.fiscal_data_confirmed_at.isoformat() if p.fiscal_data_confirmed_at else None,
            'confirmed_ip': p.fiscal_data_confirmed_ip or None,
        })

    @http.route('/api/v1/consultant/me/fiscal-data', type='http', auth='none',
                methods=['POST', 'PUT', 'OPTIONS'], csrf=False)
    def post_my_fiscal_data(self, **kwargs):
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        user, err = self._authenticate(require_auth=True)
        if err: return err
        try:
            data = json.loads(request.httprequest.body or b'{}')
        except json.JSONDecodeError:
            return self._json_response({'error': 'JSON non valido'}, 400)

        cf = (data.get('codice_fiscale') or '').strip().upper()
        piva = (data.get('vat') or '').strip()
        street = (data.get('street') or '').strip()
        city = (data.get('city') or '').strip()
        zipcode = (data.get('zip') or '').strip()

        errors = []
        if not cf or len(cf) != 16:
            errors.append('Il codice fiscale deve avere 16 caratteri')
        if piva and (not piva.isdigit() or len(piva) != 11):
            errors.append('La P.IVA deve essere 11 cifre numeriche')
        if not street:
            errors.append('Indirizzo obbligatorio')
        if not city:
            errors.append('Città obbligatoria')
        if not zipcode or len(zipcode) != 5 or not zipcode.isdigit():
            errors.append('CAP deve essere 5 cifre')
        if not data.get('declaration_accepted'):
            errors.append('Devi dichiarare che i dati sono veritieri')

        if errors:
            return self._json_response({'error': ' · '.join(errors), 'errors': errors}, 400)

        p = user.partner_id
        ip = request.httprequest.headers.get('X-Forwarded-For', '') or request.httprequest.remote_addr or ''
        p.sudo().write({
            'vat': piva or False,
            'l10n_it_codice_fiscale': cf,
            'street': street,
            'street2': (data.get('street2') or '').strip() or False,
            'city': city,
            'zip': zipcode,
        })
        try:
            if 'fiscal_data_confirmed_at' in p._fields:
                p.sudo().write({
                    'fiscal_data_confirmed_at': fields.Datetime.now(),
                    'fiscal_data_confirmed_ip': ip,
                })
        except Exception:
            _logger.exception("Log conferma dati fiscali fallito")

        # 23/09/2026: rivaluta automaticamente gli split in sospeso.
        # Se il consulente era bloccato per dati fiscali mancanti, ora
        # che li ha compilati la firma parte da sola.
        try:
            Relation = env['erpv6.tracking.relation'].sudo()
            pending = Relation.search([
                ('revenue_split_state', '=', 'in_firma'),
                ('revenue_split_notified_at', '!=', False),
                ('revenue_split_accepted_at', '=', False),
            ])
            for proj in pending:
                try:
                    split = json.loads(proj.x_v6_revenue_split or '{}')
                    has_me = any(
                        b.get('res_partner_id') == user.partner_id.id
                        and b.get('tipo') == 'consulente'
                        for b in (split.get('beneficiari') or [])
                    )
                    if has_me:
                        # verifica se sono davvero io ad avere dati mancanti
                        # (se sono io nello split, ora che ho compilato, riparte)
                        proj.action_send_split_to_sign()
                        _logger.info('Rivalutazione firma split per progetto %s dopo dati fiscali', proj.id)
                except Exception:
                    _logger.exception('Rivalutazione split fallita progetto %s', proj.id)
        except Exception:
            _logger.exception('Rivalutazione automatica split fallita')

        return self._json_response({'success': True})

    # ------------------------------------------------------------------
    # Dettaglio progetto filtrato (21/09/2026): un consulente puo' aprire

    # ------------------------------------------------------------------
    # Dettaglio progetto filtrato (21/09/2026): un consulente puo' aprire
    # un progetto solo se e' owner_user_id, in access_user_ids, o compare
    # nei beneficiari dello split come consulente. Admin vede tutto.
    # ------------------------------------------------------------------
    @http.route('/api/v1/consultant/projects/<int:relation_id>', type='http', auth='none',
                methods=['GET', 'OPTIONS'], csrf=False)
    def get_consultant_project_detail(self, relation_id, **kwargs):  # pylint: disable=unused-argument
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        start_time = time.time()
        user, error_response = self._authenticate(require_auth=True)
        if error_response:
            return error_response

        env = request.env
        Relation = env['erpv6.tracking.relation'].sudo()
        root = Relation.browse(relation_id)
        if not root.exists():
            self._log_api_call('/api/v1/consultant/projects/detail', 'GET', user.id, 404, start_time)
            return self._json_response({'error': 'Progetto non trovato'}, 404)

        is_admin = self._is_responsabile_o_admin(user)
        if not is_admin:
            # Verifica accesso
            is_owner = root.owner_user_id.id == user.id
            in_access = user.id in (root.access_user_ids.ids or [])
            in_split = False
            try:
                split = json.loads(root.x_v6_revenue_split or '{}')
                in_split = any(
                    b.get('res_partner_id') == user.partner_id.id and b.get('tipo') == 'consulente'
                    for b in (split.get('beneficiari') or [])
                )
            except (json.JSONDecodeError, TypeError):
                pass

            if not (is_owner or in_access or in_split):
                self._log_api_call('/api/v1/consultant/projects/detail', 'GET', user.id, 403, start_time)
                return self._json_response({'error': 'Non hai accesso a questo progetto'}, 403)

        # Target figli (funzione=target)
        targets = root.child_ids.filtered(lambda c: c.funzione_progetto == 'target')
        targets_data = [{
            'id': t.id,
            'name': t.name,
            'partner_id': t.partner_id.id if t.partner_id else None,
            'partner_name': t.partner_id.name if t.partner_id else '',
            'contatto_id': t.contatto_principale_id.id if t.contatto_principale_id else None,
            'contatto_name': t.contatto_principale_id.name if t.contatto_principale_id else '',
            'stage_id': t.stage_id.id if t.stage_id else None,
            'stage_name': t.stage_id.name if t.stage_id else '',
            'state': t.state,
        } for t in targets]

        # 21/09/2026: email del progetto - shared inbox, il consulente
        # vede TUTTE le email del progetto (non solo quelle a lui indirizzate).
        email_domain = [('relation_id', '=', root.id)]
        emails = env['erpv6.winwin.email.log'].sudo().search(email_domain, order='create_date desc', limit=50) \
            if 'erpv6.winwin.email.log' in env else []
        emails_data = [{
            'id': e.id,
            'subject': e.name,
            'sender_email': e.sender_email or '',
            'recipient_user_id': e.recipient_user_id.id if e.recipient_user_id else None,
            'create_date': e.create_date.isoformat() if e.create_date else None,
        } for e in emails]

        # Mio compenso (se presente nello split)
        mio_compenso = None
        try:
            split = json.loads(root.x_v6_revenue_split or '{}')
            base = split.get('base') or {}
            mine = next(
                (b for b in (split.get('beneficiari') or [])
                 if b.get('res_partner_id') == user.partner_id.id and b.get('tipo') == 'consulente'),
                None,
            )
            if mine:
                mio_compenso = {
                    'pct': float(mine.get('pct') or 0),
                    'base_tipo': base.get('tipo'),
                    'base_valore': float(base.get('valore') or 0),
                    'base_unita': base.get('unita') or '',
                    'approvato': bool(root.revenue_split_approved),
                }
        except (json.JSONDecodeError, TypeError):
            pass

        self._log_api_call('/api/v1/consultant/projects/detail', 'GET', user.id, 200, start_time)
        return self._json_response({
            'id': root.id,
            'name': root.name,
            'is_admin': is_admin,
            'project_phase': root.state,
            'targets': targets_data,
            'emails': emails_data,
            'mio_compenso': mio_compenso,
        })

    # ------------------------------------------------------------------
    # Tab "Progetti Partner" (21/09/2026): nodi erpv6.tracking.relation
    # radice (parent_id=False) dove il consulente e' owner_user_id,
    # in access_user_ids, o compare come beneficiario tipo='consulente'
    # nello split V6. Distinto da /consultant/projects (che mostra solo
    # production order / crm.lead di consulenza).
    # ------------------------------------------------------------------
    @http.route('/api/v1/consultant/partner-projects', type='http', auth='none', methods=['GET', 'OPTIONS'], csrf=False)
    def get_consultant_partner_projects(self, **kwargs):  # pylint: disable=unused-argument
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        start_time = time.time()
        user, error_response = self._authenticate(require_auth=True)
        if error_response:
            return error_response

        env = request.env
        if 'erpv6.tracking.relation' not in env:
            self._log_api_call('/api/v1/consultant/partner-projects', 'GET', user.id, 501, start_time)
            return self._json_response({'error': 'aeosv6_relation non installato'}, 501)

        is_admin = self._is_responsabile_o_admin(user)
        Relation = env['erpv6.tracking.relation'].sudo()

        # Base: tutti i root con split configurato (per admin)
        # o con accesso specifico (per consulente)
        domain = [('parent_id', '=', False)]

        candidates = Relation.search(domain, order='name asc')

        result = []
        for root in candidates:
            # Verifica accesso per consulente
            if not is_admin:
                is_owner = root.owner_user_id.id == user.id
                in_access = user.id in (root.access_user_ids.ids or [])
                in_split = False
                try:
                    split = json.loads(root.x_v6_revenue_split or '{}')
                    in_split = any(
                        b.get('res_partner_id') == user.partner_id.id and b.get('tipo') == 'consulente'
                        for b in (split.get('beneficiari') or [])
                    )
                except (json.JSONDecodeError, TypeError):
                    pass
                if not (is_owner or in_access or in_split):
                    continue

            # Conta i target figli
            targets_count = len(root.child_ids.filtered(lambda c: c.funzione_progetto == 'target'))

            result.append({
                'id': root.id,
                'name': root.name,
                'state': root.state or 'attivo',
                'targets_count': targets_count,
                'email_alias': root.email_alias or '',
                'owner_name': root.owner_user_id.name if root.owner_user_id else '',
                'has_split': bool(root.x_v6_revenue_split),
                'split_approvato': bool(root.revenue_split_approved),
            })

        self._log_api_call('/api/v1/consultant/partner-projects', 'GET', user.id, 200, start_time)
        return self._json_response({
            'is_admin': is_admin,
            'count': len(result),
            'projects': result,
        })

    # ------------------------------------------------------------------
    # Dettaglio email (21/09/2026): ritorna il corpo dell'email leggendo
    # il mail.message collegato a erpv6.winwin.email.log (via mail.thread).
    # ------------------------------------------------------------------
    # ------------------------------------------------------------------
    # DELETE email: rimuove il log e i mail.message collegati.
    # Solo admin/responsabile oppure il recipient_user_id.
    # (21/09/2026)
    # ------------------------------------------------------------------
    # ------------------------------------------------------------------
    # Email non lette: conteggio + mark-read. (22/09/2026)
    # Solo email 'ricevuta' con is_read=False per l'utente loggato.
    # ------------------------------------------------------------------
    @http.route('/api/v1/consultant/emails/unread-count', type='http', auth='none',
                methods=['GET', 'OPTIONS'], csrf=False)
    def get_consultant_emails_unread_count(self, **kwargs):  # pylint: disable=unused-argument
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        user, error_response = self._authenticate(require_auth=True)
        if error_response:
            return error_response

        env = request.env
        if 'erpv6.winwin.email.log' not in env:
            return self._json_response({'unread': 0})

        Log = env['erpv6.winwin.email.log'].sudo()
        count = Log.search_count([
            ('recipient_user_id', '=', user.id),
            ('direction', '=', 'ricevuta'),
            ('is_read', '=', False),
        ])
        return self._json_response({'unread': count})

    @http.route('/api/v1/consultant/emails/<int:email_id>/attachments', type='http', auth='none',
                methods=['GET', 'OPTIONS'], csrf=False)
    def get_consultant_email_attachments(self, email_id, **kwargs):
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        user, err = self._authenticate(require_auth=True)
        if err: return err
        env = request.env
        Log = env['erpv6.winwin.email.log'].sudo()
        log = Log.browse(email_id)
        if not log.exists():
            return self._json_response({'error': 'Email non trovata'}, 404)
        if not self._is_responsabile_o_admin(user) and log.recipient_user_id.id != user.id:
            return self._json_response({'error': 'Non hai accesso'}, 403)
        atts = env['ir.attachment'].sudo().search([
            ('res_model', '=', 'erpv6.winwin.email.log'), ('res_id', '=', log.id),
        ])
        return self._json_response({'attachments': [{
            'id': a.id, 'name': a.name, 'mimetype': a.mimetype,
            'size': a.file_size,
        } for a in atts]})

    @http.route('/api/v1/consultant/emails/<int:email_id>/mark-read', type='http', auth='none',
                methods=['POST', 'OPTIONS'], csrf=False)
    def post_consultant_email_mark_read(self, email_id, **kwargs):  # pylint: disable=unused-argument
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        user, error_response = self._authenticate(require_auth=True)
        if error_response:
            return error_response

        env = request.env
        Log = env['erpv6.winwin.email.log'].sudo()
        log = Log.browse(email_id)
        if not log.exists():
            return self._json_response({'error': 'Email non trovata'}, 404)

        is_admin = self._is_responsabile_o_admin(user)
        if not is_admin and log.recipient_user_id.id != user.id:
            return self._json_response({'error': 'Non hai accesso a questa email'}, 403)

        if not log.is_read:
            log.write({'is_read': True})
        return self._json_response({'success': True})

    @http.route('/api/v1/consultant/emails/<int:email_id>/archive', type='http', auth='none',
                methods=['POST', 'OPTIONS'], csrf=False)
    def post_consultant_email_archive(self, email_id, **kwargs):
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        user, err = self._authenticate(require_auth=True)
        if err: return err
        env = request.env
        Log = env['erpv6.winwin.email.log'].sudo()
        log = Log.browse(email_id)
        if not log.exists():
            return self._json_response({'error': 'Email non trovata'}, 404)
        if not self._is_responsabile_o_admin(user) and log.recipient_user_id.id != user.id:
            return self._json_response({'error': 'Non hai accesso'}, 403)
        log.write({'is_archived': True})
        return self._json_response({'success': True})

    @http.route('/api/v1/consultant/emails/<int:email_id>/unarchive', type='http', auth='none',
                methods=['POST', 'OPTIONS'], csrf=False)
    def post_consultant_email_unarchive(self, email_id, **kwargs):
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        user, err = self._authenticate(require_auth=True)
        if err: return err
        env = request.env
        Log = env['erpv6.winwin.email.log'].sudo()
        log = Log.browse(email_id)
        if not log.exists():
            return self._json_response({'error': 'Email non trovata'}, 404)
        if not self._is_responsabile_o_admin(user) and log.recipient_user_id.id != user.id:
            return self._json_response({'error': 'Non hai accesso'}, 403)
        log.write({'is_archived': False})
        return self._json_response({'success': True})

    @http.route('/api/v1/consultant/emails/<int:email_id>', type='http', auth='none',
                methods=['DELETE', 'OPTIONS'], csrf=False)
    def delete_consultant_email(self, email_id, **kwargs):  # pylint: disable=unused-argument
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        user, error_response = self._authenticate(require_auth=True)
        if error_response:
            return error_response

        env = request.env
        Log = env['erpv6.winwin.email.log'].sudo()
        log = Log.browse(email_id)
        if not log.exists():
            return self._json_response({'error': 'Email non trovata'}, 404)

        is_admin = self._is_responsabile_o_admin(user)
        if not is_admin:
            if log.recipient_user_id.id != user.id:
                return self._json_response({'error': 'Non hai accesso a questa email'}, 403)

        # Rimuovi anche i mail.message collegati (thread)
        try:
            env['mail.message'].sudo().search([
                ('model', '=', 'erpv6.winwin.email.log'),
                ('res_id', '=', log.id),
            ]).unlink()
        except Exception:
            _logger.exception("Cleanup mail.message fallito per log %s", email_id)

        log.unlink()
        return self._json_response({'success': True})

    @http.route('/api/v1/consultant/emails/<int:email_id>', type='http', auth='none',
                methods=['GET', 'OPTIONS'], csrf=False)
    def get_consultant_email_detail(self, email_id, **kwargs):  # pylint: disable=unused-argument
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        start_time = time.time()
        user, error_response = self._authenticate(require_auth=True)
        if error_response:
            return error_response

        env = request.env
        if 'erpv6.winwin.email.log' not in env:
            return self._json_response({'error': 'erpv6_winwin_renderdata non installato'}, 501)

        Log = env['erpv6.winwin.email.log'].sudo()
        log = Log.browse(email_id)
        if not log.exists():
            return self._json_response({'error': 'Email non trovata'}, 404)

        is_admin = self._is_responsabile_o_admin(user)
        # Accesso: admin vede tutto. Consulente vede se e' destinatario
        # oppure se e' nel progetto (relation_id e lui ha accesso).
        if not is_admin:
            is_recipient = log.recipient_user_id.id == user.id
            in_project = False
            if log.relation_id:
                in_project = (
                    log.relation_id.owner_user_id.id == user.id
                    or user.id in log.relation_id.access_user_ids.ids
                )
            if not (is_recipient or in_project):
                return self._json_response({'error': 'Non hai accesso a questa email'}, 403)

        # Body: cerca il mail.message comment (esclude le notification di sistema
        # tipo 'created' che finivano per essere mostrate come corpo email).
        Message = env['mail.message'].sudo()
        msg = Message.search([
            ('model', '=', 'erpv6.winwin.email.log'),
            ('res_id', '=', log.id),
            ('message_type', '=', 'comment'),
        ], order='id desc', limit=1)

        body = ''
        if msg:
            body = msg.body or ''

        self._log_api_call('/api/v1/consultant/emails/detail', 'GET', user.id, 200, start_time)
        return self._json_response({
            'id': log.id,
            'subject': log.name or '(senza oggetto)',
            'sender_email': log.sender_email or '',
            'recipient_emails': log.recipient_emails or '',
            'cc_emails': log.cc_emails or '',
            'relation_id': log.relation_id.id if log.relation_id else None,
            'relation_name': log.relation_id.name if log.relation_id else None,
            'recipient_user_name': log.recipient_user_id.name if log.recipient_user_id else None,
            'create_date': log.create_date.isoformat() if log.create_date else None,
            'body': body,
        })

    # ------------------------------------------------------------------
    # Reply-data: precompila il composer (To/Cc/Subject/From)
    # (21/09/2026)
    # ------------------------------------------------------------------
    @http.route('/api/v1/consultant/emails/<int:email_id>/reply-data', type='http', auth='none',
                methods=['GET', 'OPTIONS'], csrf=False)
    def get_consultant_email_reply_data(self, email_id, **kwargs):  # pylint: disable=unused-argument
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        user, error_response = self._authenticate(require_auth=True)
        if error_response:
            return error_response

        import re as _re
        env = request.env
        if 'erpv6.winwin.email.log' not in env:
            return self._json_response({'error': 'Modulo non installato'}, 501)

        log = env['erpv6.winwin.email.log'].sudo().browse(email_id)
        if not log.exists():
            return self._json_response({'error': 'Email non trovata'}, 404)

        # Check accesso
        is_admin = self._is_responsabile_o_admin(user)
        if not is_admin:
            is_recipient = log.recipient_user_id.id == user.id
            in_project = False
            if log.relation_id:
                in_project = (log.relation_id.owner_user_id.id == user.id
                              or user.id in log.relation_id.access_user_ids.ids)
            if not (is_recipient or in_project):
                return self._json_response({'error': 'Non hai accesso'}, 403)

        # From: la casella su cui e' arrivata (slug@ o slug+progetto@).
        # Il recipient puo' contenere prefissi tecnici (v6impresa-it-*) dai
        # server SMTP - scartiamo tutto cio' che non e' esattamente
        # 'slug@' o 'slug+xxx@'.
        import re as _re2
        user_slug = getattr(user, 'email_slug', None) or ''
        from_email = None
        if user_slug:
            for r in (log.recipient_emails or '').split(','):
                r = r.strip().lower()
                # estrai solo la parte email
                m2 = _re2.search(r'([a-z0-9._+\-]+@v6impresa\.it)', r)
                if not m2:
                    continue
                candidate = m2.group(1)
                local = candidate.split('@')[0]
                # accetta solo 'slug' puro o 'slug+hint'
                if local == user_slug or local.startswith(user_slug + '+'):
                    from_email = candidate
                    break
        if not from_email and user_slug:
            from_email = f'{user_slug}@v6impresa.it'

        # TO: mittente originale
        sender = log.sender_email or ''
        m = _re.search(r'<([^>]+)>', sender)
        to_email = m.group(1).strip() if m else sender.strip()

        # CC: altri destinatari originali (escludo me, catchall, v6impresa/v6sviluppoimpresa)
        cc_list = []
        for r in (log.recipient_emails or '').split(','):
            r = r.strip()
            if not r:
                continue
            low = r.lower()
            if '@v6impresa.it' in low or '@v6sviluppoimpresa.it' in low:
                continue
            cc_list.append(r)
        for r in (log.cc_emails or '').split(','):
            r = r.strip()
            if r and '@v6impresa.it' not in r.lower() and '@v6sviluppoimpresa.it' not in r.lower():
                cc_list.append(r)

        subject = log.name or ''
        if not subject.lower().startswith('re:'):
            subject = 'Re: ' + subject

        original_body = ''
        if log.message_ids:
            comment_msgs = log.message_ids.filtered(lambda m: m.message_type == 'comment')
            original_body = (comment_msgs[0].body if comment_msgs else '') or ''

        return self._json_response({
            'from_email': from_email,
            'to': to_email,
            'cc': ', '.join(cc_list),
            'subject': subject,
            'original_body': original_body,
        })

    # ------------------------------------------------------------------
    # Send: invia email dal consulente. From = stessa casella della
    # reply (slug@ o slug+progetto@). Log in erpv6.winwin.email.log
    # con direction=inviata. (21/09/2026)
    # ------------------------------------------------------------------
    @http.route('/api/v1/consultant/emails/send', type='http', auth='none',
                methods=['POST', 'OPTIONS'], csrf=False)
    def send_consultant_email(self, **kwargs):  # pylint: disable=unused-argument
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        user, error_response = self._authenticate(require_auth=True)
        if error_response:
            return error_response

        env = request.env
        if 'erpv6.winwin.email.log' not in env:
            return self._json_response({'error': 'Modulo non installato'}, 501)

        try:
            data = json.loads(request.httprequest.data or b'{}')
        except json.JSONDecodeError:
            return self._json_response({'error': 'JSON non valido'}, 400)

        to = (data.get('to') or '').strip()
        cc = (data.get('cc') or '').strip()
        bcc = (data.get('bcc') or '').strip()
        attachments = data.get('attachments') or []
        subject = (data.get('subject') or '').strip()
        body = data.get('body') or ''
        in_reply_to_id = data.get('in_reply_to_id')
        from_email = (data.get('from_email') or '').strip()

        if not to or not subject or not body:
            return self._json_response({'error': 'to, subject, body obbligatori'}, 400)

        user_slug = getattr(user, 'email_slug', None) or ''
        if not from_email:
            from_email = f'{user_slug}@v6impresa.it' if user_slug else ''

        # SMTP per v6impresa.it
        mail_server = env['ir.mail_server'].sudo().search(
            [('from_filter', '=', 'v6impresa.it'), ('active', '=', True)], limit=1)
        if not mail_server:
            return self._json_response({'error': 'SMTP v6impresa.it non configurato'}, 500)

        # Contesto: relation_id + matched_alias dalla reply originale
        relation_id = None
        matched_alias = user_slug or None
        recipient_user_id = user.id
        if in_reply_to_id:
            orig = env['erpv6.winwin.email.log'].sudo().browse(int(in_reply_to_id))
            if orig.exists():
                if orig.relation_id:
                    relation_id = orig.relation_id.id
                if orig.matched_alias:
                    matched_alias = orig.matched_alias
                if orig.recipient_user_id:
                    recipient_user_id = orig.recipient_user_id.id

        all_recipients = [to]
        if cc:
            all_recipients += [e.strip() for e in cc.split(',') if e.strip()]

        # 22/09/2026: threading - se e' una reply, prendi il Message-Id originale
        # dal mail.message del log reply-to e mettilo in In-Reply-To/References.
        reply_headers = None
        if in_reply_to_id:
            try:
                orig_log = env['erpv6.winwin.email.log'].sudo().browse(int(in_reply_to_id))
                if orig_log.exists():
                    orig_msg = env['mail.message'].sudo().search([
                        ('model', '=', 'erpv6.winwin.email.log'),
                        ('res_id', '=', orig_log.id),
                    ], order='id desc', limit=1)
                    if orig_msg and orig_msg.message_id:
                        reply_headers = {
                            'In-Reply-To': orig_msg.message_id,
                            'References': orig_msg.message_id,
                        }
            except Exception:
                _logger.exception("Recupero Message-Id originale fallito (threading best-effort).")

        # BCC: Odoo 18 non ha email_bcc, lo passiamo via headers 'Bcc'
        # (RFC 5322: header opzionale, i client lo rispettano).
        if bcc:
            existing_h = reply_headers or {}
            existing_h['Bcc'] = ','.join([e.strip() for e in bcc.split(',') if e.strip()])
            reply_headers = existing_h

        # 23/09/2026: fix spam. Register autentica come catchall@v6impresa.it:
        # allineare il From al mittente tecnico e mettere l'alias consulente
        # in Reply-To. Gmail/Outlook vedono allineamento SMTP <-> From.
        display_name = user.name or 'V6 Impresa'
        header_from = f'"{display_name} via V6" <catchall@v6impresa.it>'

        mail = env['mail.mail'].sudo().create({
            'email_from': header_from,
            'reply_to': from_email,
            'email_to': ','.join(all_recipients),
            'email_cc': ','.join([e.strip() for e in cc.split(',') if e.strip()]) if cc else False,
            # 23/09/2026: Odoo 18 ha rimosso email_bcc da mail.mail. Il BCC
            # viene aggiunto via header nel momento dell'invio SMTP
            # (workaround: se bcc c'e', lo metto negli header).
            'subject': subject,
            'body_html': body,
            'mail_server_id': mail_server.id,
            'auto_delete': False,
            'headers': json.dumps(reply_headers) if reply_headers else False,
        })
        try:
            mail.send()
        except Exception as e:
            _logger.exception("Invio email consulente fallito.")
            return self._json_response({'error': str(e)}, 500)

        # 22/09/2026: allegati (da PC o da Libreria). Ogni file diventa un
        # ir.attachment sul log; se il log ha relation_id crea anche un
        # erpv6.library.document collegato (appare in progetto + libreria).
        if attachments:
            Att = env['ir.attachment'].sudo()
            Lib = env['erpv6.library.document'].sudo() if 'erpv6.library.document' in env else None
            att_ids = []
            for item in attachments:
                try:
                    if item.get('attachmentId'):
                        existing = Att.browse(int(item['attachmentId']))
                        if existing.exists():
                            existing.write({'res_model': 'erpv6.winwin.email.log', 'res_id': log.id})
                            att_ids.append(existing.id)
                        continue
                    fname = item.get('fileName') or 'allegato'
                    mimetype = item.get('mimetype') or 'application/octet-stream'
                    data = item.get('fileBase64') or ''
                    att = Att.create({
                        'name': fname, 'datas': data, 'mimetype': mimetype,
                        'res_model': 'erpv6.winwin.email.log', 'res_id': log.id,
                    })
                    att_ids.append(att.id)
                    if Lib is not None and log.relation_id and data:
                        Lib.create({
                            'name': fname, 'category': 'other', 'origin': 'internal_upload',
                            'file': data, 'file_name': fname,
                            'source_model': 'erpv6.tracking.relation',
                            'source_res_id': log.relation_id.id,
                        })
                except Exception:
                    _logger.exception("Allegato email fallito: %s", item.get('fileName'))
            if att_ids:
                mail.write({'attachment_ids': [(6, 0, att_ids)]})

        log = env['erpv6.winwin.email.log'].sudo().create({
            'name': subject,
            'sender_email': from_email,
            'recipient_emails': ','.join(all_recipients),
            'cc_emails': cc or False,
            # bcc non salvato per privacy (il destinatario finale non deve vederlo nei log condivisi)
            'match_status': 'utente_consulente',
            'matched_alias': matched_alias or '',
            'relation_id': relation_id,
            'recipient_user_id': recipient_user_id,
            'direction': 'inviata',
            'is_read': True,
        })
        try:
            log.message_post(body=Markup(body), subject=subject, message_type='comment',
                              subtype_xmlid='mail.mt_comment',
                              author_id=SUPERUSER_ID, email_from=from_email)
        except Exception:
            _logger.exception("message_post sul log email fallito (invio OK).")

        return self._json_response({'success': True, 'id': log.id})

    # ------------------------------------------------------------------
    # Dettaglio target (21/09/2026): nodo figlio con funzione_progetto='target'.
    # Ritorna azienda, contatto, stage, dossier, email del target, call.
    # Accesso: il consulente deve avere accesso al progetto root.
    # ------------------------------------------------------------------
    @http.route('/api/v1/consultant/targets/<int:target_id>', type='http', auth='none',
                methods=['GET', 'OPTIONS'], csrf=False)
    def get_consultant_target_detail(self, target_id, **kwargs):  # pylint: disable=unused-argument
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        start_time = time.time()
        user, error_response = self._authenticate(require_auth=True)
        if error_response:
            return error_response

        env = request.env
        if 'erpv6.tracking.relation' not in env:
            return self._json_response({'error': 'Modulo non installato'}, 501)

        Target = env['erpv6.tracking.relation'].sudo()
        target = Target.browse(target_id)
        if not target.exists():
            return self._json_response({'error': 'Target non trovato'}, 404)

        if not target.parent_id or target.funzione_progetto != 'target':
            return self._json_response({'error': 'Nodo non è un target'}, 400)

        root = target.parent_id
        is_admin = self._is_responsabile_o_admin(user)
        if not is_admin:
            is_owner = root.owner_user_id.id == user.id
            in_access = user.id in root.access_user_ids.ids
            in_split = False
            try:
                split = json.loads(root.x_v6_revenue_split or '{}')
                in_split = any(
                    b.get('res_partner_id') == user.partner_id.id and b.get('tipo') == 'consulente'
                    for b in (split.get('beneficiari') or [])
                )
            except (json.JSONDecodeError, TypeError):
                pass
            if not (is_owner or in_access or in_split):
                return self._json_response({'error': 'Non hai accesso a questo target'}, 403)

        partner = target.partner_id
        contatto = target.contatto_principale_id

        dossier = None
        if target.x_v6_dossier:
            try:
                dossier = json.loads(target.x_v6_dossier)
            except (json.JSONDecodeError, TypeError):
                pass

        # Email del target (relation_id = target.id)
        emails_data = []
        if 'erpv6.winwin.email.log' in env:
            emails = env['erpv6.winwin.email.log'].sudo().search([
                ('relation_id', '=', target.id)
            ], order='create_date desc', limit=30)
            emails_data = [{
                'id': e.id,
                'subject': e.name,
                'sender_email': e.sender_email or '',
                'direction': e.direction or 'ricevuta',
            'is_read': bool(e.is_read),
            'is_archived': bool(e.is_archived),
            'has_attachments': bool(env['ir.attachment'].sudo().search_count([('res_model', '=', 'erpv6.winwin.email.log'), ('res_id', '=', e.id)])),
                'create_date': e.create_date.isoformat() if e.create_date else None,
            } for e in emails]

        # Call del target
        calls_data = []
        if 'erpv6.call.log' in env:
            calls = env['erpv6.call.log'].sudo().search([
                ('relation_id', '=', target.id)
            ], order='started_at desc', limit=10)
            calls_data = [{
                'id': c.id,
                'started_at': c.started_at.isoformat() if c.started_at else None,
                'duration_minutes': c.duration_minutes or 0,
                'state': c.state,
            } for c in calls]

        self._log_api_call('/api/v1/consultant/targets/detail', 'GET', user.id, 200, start_time)
        return self._json_response({
            'id': target.id,
            'name': target.name,
            'root_id': root.id,
            'root_name': root.name,
            'stage_name': target.stage_id.name if target.stage_id else '',
            'state': target.state or 'attivo',
            'funzione': target.funzione_progetto,
            'partner': {
                'id': partner.id, 'name': partner.name or '',
                'email': partner.email or '', 'phone': partner.phone or '',
            } if partner else None,
            'contatto': {
                'id': contatto.id, 'name': contatto.name or '',
                'email': contatto.email or '', 'phone': contatto.phone or '',
            } if contatto else None,
            'dossier': dossier,
            'emails': emails_data,
            'calls': calls_data,
        })

