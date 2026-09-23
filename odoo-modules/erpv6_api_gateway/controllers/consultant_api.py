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
