# -*- coding: utf-8 -*-
"""API richieste accesso al catalogo playbook progetti.

30/09/2026 — Flusso opt-in consultant:
- /consultant/projects/catalog: progetti pubblicati + non accessibili al viewer
- /consultant/projects/<id>/request-access: crea richiesta
- /consultant/projects/my-requests: richieste del viewer
- /admin/access-requests: lista (admin/chief_projects)
- /admin/access-requests/<id>/approve: approva
- /admin/access-requests/<id>/reject: rifiuta
"""
import json
import logging
import time

from odoo import http
from odoo.http import request

from .consultant_api import ConsultantAPIController

_logger = logging.getLogger(__name__)


class AccessRequestsAPIController(ConsultantAPIController):

    def _is_admin_or_chief_projects(self, user):
        """Admin OR chief_projects. Per approvare le richieste."""
        if not user:
            return False
        uids = set(user.groups_id.ids)
        for xmlid in [
            'base.group_system',
            'sales_team.group_sale_manager',
            'erpv6_core.group_chief_projects',
        ]:
            grp = request.env.ref(xmlid, raise_if_not_found=False)
            if grp and grp.id in uids:
                return True
        return False

    # ---------------------------------------------------------------
    # CATALOGO (consultant)
    # ---------------------------------------------------------------

    @http.route('/api/v1/consultant/projects/catalog', type='http',
                auth='none', methods=['GET', 'OPTIONS'], csrf=False)
    def list_catalog(self, **kwargs):
        """Progetti pubblicati nel catalogo, NON accessibili al viewer."""
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        user, err = self._authenticate(require_auth=True)
        if err:
            return err

        Relation = request.env['erpv6.tracking.relation'].sudo()
        # Tutti i progetti pubblicati
        catalog = Relation.search([
            ('x_v6_catalog_visible', '=', True),
        ], order='x_v6_catalog_published_at desc, name')

        # Escludi quelli dove l'utente è già dentro (access_user_ids o partner match)
        my_partner = user.partner_id
        visible = []
        for rel in catalog:
            if user in rel.access_user_ids:
                continue
            # Se il suo partner è già "parte", non mostrare (già dentro)
            if my_partner and rel.child_ids.filtered(
                    lambda c: c.partner_id == my_partner):
                continue
            # Richiesta già pending?
            existing = request.env['erpv6.project.access.request'].sudo().search([
                ('relation_id', '=', rel.id),
                ('user_id', '=', user.id),
                ('state', '=', 'pending'),
            ], limit=1)

            visible.append({
                'id': rel.id,
                'name': rel.name or '',
                'pitchTitle': rel.x_v6_pitch_title or rel.name or '',
                'pitchSummary': rel.x_v6_pitch_summary or '',
                'ownerName': rel.owner_user_id.name if rel.owner_user_id else None,
                'funzioneProgetto': rel.funzione_progetto or '',
                'publishedAt': self._iso_utc(rel.x_v6_catalog_published_at) if rel.x_v6_catalog_published_at else None,
                'pendingRequestId': existing.id if existing else None,
                'emailAlias': rel.email_alias or None,
            })
        return self._json_response({'success': True, 'projects': visible})

    @http.route('/api/v1/consultant/projects/<int:relation_id>/request-access',
                type='http', auth='none', methods=['POST', 'OPTIONS'], csrf=False)
    def create_request(self, relation_id, **kwargs):
        """Crea una richiesta di accesso per il viewer."""
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        user, err = self._authenticate(require_auth=True)
        if err:
            return err

        Relation = request.env['erpv6.tracking.relation'].sudo()
        rel = Relation.browse(relation_id)
        if not rel.exists() or not rel.x_v6_catalog_visible:
            return self._json_response({'error': 'Progetto non nel catalogo'}, 404)

        # Già dentro?
        if user in rel.access_user_ids:
            return self._json_response({'error': 'Hai già accesso al progetto'}, 400)
        if user.partner_id and rel.child_ids.filtered(lambda c: c.partner_id == user.partner_id):
            return self._json_response({'error': 'Sei già parte del progetto'}, 400)

        # Request già pending?
        existing = request.env['erpv6.project.access.request'].sudo().search([
            ('relation_id', '=', rel.id),
            ('user_id', '=', user.id),
            ('state', '=', 'pending'),
        ], limit=1)
        if existing:
            return self._json_response({
                'error': 'Richiesta già in attesa',
                'requestId': existing.id,
            }, 400)

        try:
            body = json.loads(request.httprequest.data or b'{}')
        except (ValueError, TypeError):
            body = {}

        req = request.env['erpv6.project.access.request'].sudo().create({
            'relation_id': rel.id,
            'user_id': user.id,
            'message': body.get('message', ''),
            'creates_part_node': True,
        })
        request.env.cr.commit()
        return self._json_response({
            'success': True,
            'requestId': req.id,
        })

    @http.route('/api/v1/consultant/projects/my-requests', type='http',
                auth='none', methods=['GET', 'OPTIONS'], csrf=False)
    def my_requests(self, **kwargs):
        """Richieste del viewer (tutte, tutti gli stati)."""
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        user, err = self._authenticate(require_auth=True)
        if err:
            return err

        reqs = request.env['erpv6.project.access.request'].sudo().search([
            ('user_id', '=', user.id),
        ], order='create_date desc', limit=50)

        return self._json_response({
            'success': True,
            'requests': [{
                'id': r.id,
                'relationId': r.relation_id.id,
                'relationName': r.relation_id.name,
                'state': r.state,
                'message': r.message or '',
                'rejectedReason': r.rejected_reason or '',
                'approvedBy': r.approved_by.name if r.approved_by else None,
                'approvedAt': self._iso_utc(r.approved_at) if r.approved_at else None,
                'createDate': self._iso_utc(r.create_date) if r.create_date else None,
            } for r in reqs],
        })

    # ---------------------------------------------------------------
    # ADMIN / CHIEF — approvazioni
    # ---------------------------------------------------------------

    @http.route('/api/v1/admin/access-requests', type='http',
                auth='none', methods=['GET', 'OPTIONS'], csrf=False)
    def list_requests(self, **kwargs):
        """Lista richieste. Default: pending. ?all=1 per tutte."""
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        user, err = self._authenticate(require_auth=True)
        if err:
            return err
        if not self._is_admin_or_chief_projects(user):
            return self._json_response({'error': 'Riservato a admin/chief_projects'}, 403)

        show_all = kwargs.get('all') in ('1', 'true', 'True')
        domain = [] if show_all else [('state', '=', 'pending')]
        reqs = request.env['erpv6.project.access.request'].sudo().search(
            domain, order='create_date desc', limit=100)

        return self._json_response({
            'success': True,
            'count': len(reqs),
            'requests': [{
                'id': r.id,
                'relationId': r.relation_id.id,
                'relationName': r.relation_id.name,
                'userId': r.user_id.id,
                'userName': r.user_id.name,
                'userEmail': r.user_id.email or r.user_id.login,
                'partnerId': r.partner_id.id if r.partner_id else None,
                'partnerName': r.partner_id.name if r.partner_id else None,
                'message': r.message or '',
                'state': r.state,
                'createsPartNode': r.creates_part_node,
                'approvedBy': r.approved_by.name if r.approved_by else None,
                'approvedAt': self._iso_utc(r.approved_at) if r.approved_at else None,
                'rejectedReason': r.rejected_reason or '',
                'createDate': self._iso_utc(r.create_date) if r.create_date else None,
            } for r in reqs],
        })

    @http.route('/api/v1/admin/access-requests/<int:req_id>/approve',
                type='http', auth='none', methods=['POST', 'OPTIONS'], csrf=False)
    def approve_request(self, req_id, **kwargs):
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        user, err = self._authenticate(require_auth=True)
        if err:
            return err
        if not self._is_admin_or_chief_projects(user):
            return self._json_response({'error': 'Riservato a admin/chief_projects'}, 403)

        req = request.env['erpv6.project.access.request'].sudo().browse(req_id)
        if not req.exists():
            return self._json_response({'error': 'Richiesta non trovata'}, 404)

        # Body opzionale: createsPartNode
        try:
            body = json.loads(request.httprequest.data or b'{}')
        except (ValueError, TypeError):
            body = {}
        creates_part = body.get('createsPartNode', req.creates_part_node)

        try:
            req.with_user(user).action_approve(creates_part_node=creates_part)
            request.env.cr.commit()
        except Exception as e:
            _logger.exception('Errore approve request %s', req_id)
            return self._json_response({'error': str(e)}, 400)

        return self._json_response({
            'success': True,
            'requestId': req.id,
            'state': req.state,
        })

    @http.route('/api/v1/admin/access-requests/<int:req_id>/reject',
                type='http', auth='none', methods=['POST', 'OPTIONS'], csrf=False)
    def reject_request(self, req_id, **kwargs):
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        user, err = self._authenticate(require_auth=True)
        if err:
            return err
        if not self._is_admin_or_chief_projects(user):
            return self._json_response({'error': 'Riservato a admin/chief_projects'}, 403)

        req = request.env['erpv6.project.access.request'].sudo().browse(req_id)
        if not req.exists():
            return self._json_response({'error': 'Richiesta non trovata'}, 404)

        try:
            body = json.loads(request.httprequest.data or b'{}')
        except (ValueError, TypeError):
            body = {}

        try:
            req.with_user(user).action_reject(reason=body.get('reason', ''))
            request.env.cr.commit()
        except Exception as e:
            _logger.exception('Errore reject request %s', req_id)
            return self._json_response({'error': str(e)}, 400)

        return self._json_response({
            'success': True,
            'requestId': req.id,
            'state': req.state,
        })

    # ---------------------------------------------------------------
    # ADMIN — pubblicazione nel catalogo
    # ---------------------------------------------------------------

    @http.route('/api/v1/admin/projects/<int:relation_id>/catalog-toggle',
                type='http', auth='none', methods=['POST', 'OPTIONS'], csrf=False)
    def toggle_catalog(self, relation_id, **kwargs):
        """Attiva/disattiva x_v6_catalog_visible sul progetto."""
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        user, err = self._authenticate(require_auth=True)
        if err:
            return err
        if not self._is_admin_or_chief_projects(user):
            return self._json_response({'error': 'Riservato a admin/chief_projects'}, 403)

        rel = request.env['erpv6.tracking.relation'].sudo().browse(relation_id)
        if not rel.exists():
            return self._json_response({'error': 'Progetto non trovato'}, 404)

        try:
            body = json.loads(request.httprequest.data or b'{}')
        except (ValueError, TypeError):
            body = {}

        new_value = bool(body.get('visible', not rel.x_v6_catalog_visible))
        vals = {'x_v6_catalog_visible': new_value}
        if new_value and not rel.x_v6_catalog_published_at:
            vals['x_v6_catalog_published_at'] = request.env['ir.fields']._now() if False else __import__('odoo').fields.Datetime.now()
        rel.write(vals)
        request.env.cr.commit()

        return self._json_response({
            'success': True,
            'relationId': rel.id,
            'visible': new_value,
        })
