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

from odoo import http, fields, SUPERUSER_ID
from markupsafe import Markup
from odoo.exceptions import UserError
from odoo.http import request

from .main import APIBaseController

_logger = logging.getLogger(__name__)


from .consultant_api import ConsultantAPIController


class ConsultantMeAPIController(ConsultantAPIController):

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
            data = json.loads(request.httprequest.get_data() or b'{}')
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

