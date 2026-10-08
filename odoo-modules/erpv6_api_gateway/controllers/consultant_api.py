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
from .lib.security import check_record_access

_logger = logging.getLogger(__name__)

class ConsultantAPIController(APIBaseController):

    def _require_relation_access(self, user, relation, mode='read'):
        """08/10/2026 (C-security-audit-3icd): record-level check su
        erpv6.tracking.relation + audit log. Usato da contratti e split.

        Ritorna None se OK, altrimenti Response 403.
        """
        granted = check_record_access(user, relation, mode)
        request.env['erpv6.api.access.log'].sudo().log_access(
            user=user, route=request.httprequest.path,
            method=request.httprequest.method,
            model='erpv6.tracking.relation', record_id=relation.id,
            granted=granted,
            reason='ok' if granted else 'denied_no_ownership',
        )
        if not granted:
            return self._json_response({'error': 'Accesso negato'}, 403)
        return None

    def _get_visible_relation_ids(self, user):
        """08/10/2026 (C-security-audit-3efghj): spostato da
        ConsultantEmailAPIController per condivisione su admin_emails."""
        if self._is_responsabile_o_admin(user):
            return None
        Relation = request.env['erpv6.tracking.relation'].sudo()
        partner_id = user.partner_id.id
        if not partner_id:
            return []
        my_nodes = Relation.search([('partner_id', '=', partner_id)])
        if not my_nodes:
            return []
        ids = set()
        for node in my_nodes:
            ids.add(node.id)
            if node.parent_id:
                parent = node.parent_id
                ids.add(parent.id)
                siblings = Relation.search([('parent_id', '=', parent.id)])
                ids.update(siblings.ids)
        return sorted(ids)

    def _can_access_email(self, user, log):
        """True se user puo' accedere a questa email."""
        if self._is_responsabile_o_admin(user):
            return True
        if hasattr(log, 'recipient_user_id') and log.recipient_user_id and log.recipient_user_id.id == user.id:
            return True
        visible_ids = self._get_visible_relation_ids(user) or []
        if hasattr(log, 'relation_id') and log.relation_id and log.relation_id.id in visible_ids:
            return True
        return False

    def _not_installed(self, path, start_time):
        self._log_api_call(path, 'GET', None, 501, start_time)
        return self._json_response({'error': 'erpv6_production non installato'}, 501)

    # ------------------------------------------------------------------
    # Tab "Progetti": erpv6.production.order/crm.lead del consulente
    # loggato (o di TUTTI se Responsabile/Admin passa ?all=1 - azione in
    # piu' riservata al suo ruolo, vedi compito 3).
    # ------------------------------------------------------------------
