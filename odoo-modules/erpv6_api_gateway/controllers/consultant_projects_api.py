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


class ConsultantProjectsAPIController(ConsultantAPIController):

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
                'create_date': self._iso_utc(order.create_date) if order.create_date else None,
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
            'create_date': self._iso_utc(lead.create_date) if lead.create_date else None,
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

        # 05/10/2026 (C-playbook-1): sezione Knowledge da KB collegate.
        knowledge = []
        if 'playbook_kb_ids' in root._fields:
            for kb in root.playbook_kb_ids:
                knowledge.append({
                    'id': kb.id,
                    'name': kb.name,
                    'category': kb.category_id.name if 'category_id' in kb._fields and kb.category_id else None,
                    'kb_type': kb.kb_type if 'kb_type' in kb._fields else None,
                    'content_format': kb.content_format if 'content_format' in kb._fields else 'text',
                    'content': kb.content or '',
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
            'knowledge': knowledge,
            'knowledge_count': len(knowledge),
        })

    # ------------------------------------------------------------------
    # Split V6 personale (23/09/2026): dettaglio + accetta/rifiuta.
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
            'create_date': self._iso_utc(e.create_date) if e.create_date else None,
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
                'create_date': self._iso_utc(e.create_date) if e.create_date else None,
            } for e in emails]

        # Call del target
        calls_data = []
        if 'erpv6.call.log' in env:
            calls = env['erpv6.call.log'].sudo().search([
                ('relation_id', '=', target.id)
            ], order='started_at desc', limit=10)
            calls_data = [{
                'id': c.id,
                'started_at': self._iso_utc(c.started_at) if c.started_at else None,
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

    # ═══════════════════════════════════════════════════════════════
    # GET /api/v1/consultant/projects/<id>/playbook/pdf
    # 05/10/2026 (C-playbook-3a): export PDF del playbook consulente.
    # Compila il template Typst con i dati del playbook.
    # ═══════════════════════════════════════════════════════════════

    # ═══════════════════════════════════════════════════════════════
    # Helper: costruisce i dati del playbook + compila PDF.
    # 05/10/2026 (C-playbook-3a): estratto per riuso tra GET pdf
    # e POST send.
    # ═══════════════════════════════════════════════════════════════
    def _build_playbook_data(self, root):
        """Ritorna dict con tutti i dati del playbook."""
        import json as _json
        from datetime import date as _date

        charter = {}
        try:
            charter = _json.loads(root.x_v6_charter or '{}') if root.x_v6_charter else {}
        except Exception:
            pass
        charter_data = charter.get('data') or {}

        scouting = {}
        try:
            scouting = _json.loads(root.x_v6_scouting or '{}') if root.x_v6_scouting else {}
        except Exception:
            pass
        scouting_data = scouting.get('data') or {}

        knowledge = []
        if 'playbook_kb_ids' in root._fields:
            for kb in root.playbook_kb_ids:
                knowledge.append({
                    'name': kb.name or '',
                    'category': kb.category_id.name if kb.category_id else '',
                    'kb_type': kb.kb_type or '',
                    'content': kb.content or '',
                })

        def _kv_block(d, keys):
            parts = []
            for k, label in keys:
                v = d.get(k)
                if v:
                    parts.append('%s: %s' % (label, v))
            return '\n\n'.join(parts)

        charter_text = _kv_block(charter_data, [
            ('origin', 'Origine'),
            ('regulatoryContext', 'Contesto normativo'),
            ('requirements', 'Requisiti'),
            ('commercialTerms', 'Termini commerciali'),
            ('currentPhase', 'Fase attuale'),
        ])

        scouting_text = ''
        if scouting_data:
            lines = []
            for k, v in scouting_data.items():
                if isinstance(v, dict):
                    lines.append('%s:' % k)
                    for k2, v2 in v.items():
                        lines.append('  - %s: %s' % (k2, v2))
                else:
                    lines.append('%s: %s' % (k, v))
            scouting_text = '\n'.join(lines)

        user = request.env.user
        return {
            'project_name': root.name or '',
            'phase': root.state or '',
            'email_alias': root.email_alias or '',
            'export_date': _date.today().strftime('%d/%m/%Y'),
            'exported_by': user.partner_id.name or user.name or '',
            'charter': charter_text,
            'pitch_cosa_cerchiamo': charter_data.get('pitchCosaCerchiamo', ''),
            'pitch_tipologie_target': charter_data.get('pitchTipologieTarget', ''),
            'pitch_cosa_offriamo': charter_data.get('pitchCosaOffriamo', ''),
            'scouting': scouting_text,
            'knowledge': knowledge,
        }

    def _build_playbook_pdf_bytes(self, root, payload=None):
        """Compila il PDF. Ritorna (pdf_bytes, error_str)."""
        import os
        if payload is None:
            payload = self._build_playbook_data(root)

        # Trova template
        candidates = [
            '/mnt/custom-addons/erpv6_typst/templates/playbook.typ',
            os.path.join(
                os.path.dirname(os.path.dirname(os.path.dirname(
                    os.path.abspath(__file__)))),
                'erpv6_typst', 'templates', 'playbook.typ'),
        ]
        source = None
        for path in candidates:
            if os.path.exists(path):
                try:
                    with open(path, 'r', encoding='utf-8') as f:
                        source = f.read()
                    break
                except Exception:
                    continue
        if not source:
            return None, 'Template PDF non disponibile'

        engine = request.env['erpv6.typst.engine'].sudo()
        result = engine.preview_source(source, data=payload)
        if not result.get('ok'):
            errs = result.get('errors') or []
            msg = errs[0].get('message') if errs else 'Errore compilazione Typst'
            return None, msg
        return result['pdf'], None

    def _playbook_filename(self, root):
        from datetime import date as _date
        slug = ''.join(c if c.isalnum() else '_' for c in (root.email_alias or str(root.id)))
        return 'playbook_%s_%s.pdf' % (slug, _date.today().strftime('%Y%m%d'))

    @http.route('/api/v1/consultant/projects/<int:relation_id>/playbook/pdf',
                type='http', auth='none', methods=['GET', 'OPTIONS'],
                csrf=False)
    def get_playbook_pdf(self, relation_id, **kwargs):
        """05/10/2026 (C-playbook-3a): export PDF del playbook."""
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        user, err = self._authenticate(require_auth=True)
        if err:
            return err
        request.update_env(user=user.id)

        Relation = request.env['erpv6.tracking.relation'].sudo()
        root = Relation.browse(relation_id)
        if not root.exists():
            return self._json_response({'error': 'Progetto non trovato'}, 404)

        is_admin = self._is_responsabile_o_admin(user)
        if not is_admin:
            in_access = user.id in (root.access_user_ids.ids or [])
            is_owner = root.owner_user_id.id == user.id
            if not (is_owner or in_access):
                return self._json_response({'error': 'Non hai accesso'}, 403)

        pdf_bytes, error = self._build_playbook_pdf_bytes(root)
        if error:
            _logger.warning('playbook pdf: %s', error)
            return self._json_response({'error': error}, 500)

        filename = self._playbook_filename(root)
        return request.make_response(
            pdf_bytes,
            headers=[
                ('Content-Type', 'application/pdf'),
                ('Content-Disposition', 'inline; filename="%s"' % filename),
                ('Content-Length', str(len(pdf_bytes))),
            ],
        )

    @http.route('/api/v1/consultant/projects/<int:relation_id>/playbook/send',
                type='http', auth='none', methods=['POST', 'OPTIONS'],
                csrf=False)
    def post_playbook_send(self, relation_id, **kwargs):
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        user, err = self._authenticate(require_auth=True)
        if err:
            return err
        request.update_env(user=user.id)

        Relation = request.env['erpv6.tracking.relation'].sudo()
        root = Relation.browse(relation_id)
        if not root.exists():
            return self._json_response({'error': 'Progetto non trovato'}, 404)

        is_admin = self._is_responsabile_o_admin(user)
        if not is_admin:
            in_access = user.id in (root.access_user_ids.ids or [])
            is_owner = root.owner_user_id.id == user.id
            if not (is_owner or in_access):
                return self._json_response({'error': 'Non hai accesso'}, 403)

        try:
            body = request.httprequest.get_json(force=True, silent=True) or {}
        except Exception:
            body = {}

        import re as _re
        raw_recipients = body.get('recipients') or []
        if isinstance(raw_recipients, str):
            raw_recipients = [raw_recipients]
        recipients = []
        invalid = []
        for r in raw_recipients:
            r = (r or '').strip().lower()
            if not r:
                continue
            if not _re.match(r'^[^@\s]+@[^@\s]+\.[^@\s]+$', r):
                invalid.append(r)
                continue
            if not r.endswith('@v6impresa.it'):
                invalid.append(r)
                continue
            recipients.append(r)
        if invalid:
            return self._json_response({
                'error': 'Il playbook e riservato ai consulenti V6. Non validi: %s'
                         % ', '.join(invalid)
            }, 400)
        if not recipients:
            return self._json_response({'error': 'Nessun destinatario valido'}, 400)

        pdf_bytes, error = self._build_playbook_pdf_bytes(root)
        if error:
            return self._json_response({'error': 'PDF: %s' % error}, 500)

        filename = self._playbook_filename(root)
        import base64 as _b64

        user_name = user.partner_id.name or user.name or 'Consulente V6'
        user_slug = getattr(user, 'email_slug', None) or ''
        firma_email = '%s@v6impresa.it' % user_slug if user_slug else ''

        custom_message = (body.get('message') or '').strip()
        custom_html = ''
        if custom_message:
            custom_html = '<p style="white-space:pre-wrap;">%s</p>' % custom_message.replace('<', '&lt;')

        subject = (body.get('subject') or '').strip() or (
            'Playbook %s - V6 Impresa' % (root.name or ''))

        body_html = (
            '<div style="font-family:sans-serif;font-size:14px;color:#333;">'
            '<p>Buongiorno,</p>'
            '<p>ti condivido il playbook del progetto <strong>%s</strong>.</p>'
            '%s'
            '<p>Lo trovi in allegato come PDF.</p>'
            '<p style="color:#666;font-size:13px;margin-top:24px;">'
            '<strong>%s</strong><br/>V6 Impresa - Consulente<br/>%s</p>'
            '</div>'
        ) % (root.name or '', custom_html, user_name, firma_email)

        Mail = request.env['mail.mail'].sudo()
        attach = request.env['ir.attachment'].sudo().create({
            'name': filename,
            'type': 'binary',
            'datas': _b64.b64encode(pdf_bytes),
            'mimetype': 'application/pdf',
            'res_model': 'erpv6.tracking.relation',
            'res_id': root.id,
        })

        mail = Mail.create({
            'subject': subject,
            'body_html': body_html,
            'email_from': firma_email or 'noreply@v6impresa.it',
            'email_to': ', '.join(recipients),
            'attachment_ids': [(4, attach.id)],
            'state': 'outgoing',
            'reply_to': firma_email or False,
        })

        try:
            mail.with_context(mail_transactional_approved=True).send()
        except Exception as e:
            _logger.exception('playbook send: errore invio email')
            return self._json_response({'error': 'Invio fallito: %s' % e}, 500)

        return self._json_response({
            'ok': True,
            'message_id': mail.id,
            'recipients': recipients,
            'subject': subject,
        })

