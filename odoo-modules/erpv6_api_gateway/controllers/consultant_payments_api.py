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


class ConsultantPaymentsAPIController(ConsultantAPIController):

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

