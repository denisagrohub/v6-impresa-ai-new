# pylint: disable=import-error
"""Pitch pubblico progetto (23/09/2026): una pagina /p/<alias> rivolta
ad aziende esterne. Mostra settore, descrizione, KPI pubblici, form
candidatura. Riusa erpv6.partnership.candidacy.action_create_from_public_form
per non duplicare il modello. Tracking views su x_v6_pitch_views."""
import json
import logging

from odoo import http, fields
from odoo.http import request

from .main import APIBaseController

_logger = logging.getLogger(__name__)


class PublicProjectAPIController(APIBaseController):

    def _get_public_project(self, alias):
        if 'erpv6.tracking.relation' not in request.env.registry:
            return None
        Relation = request.env['erpv6.tracking.relation'].sudo()
        return Relation.search([
            ('email_alias', '=', alias),
            ('x_v6_pitch_enabled', '=', True),
            ('parent_id', '=', False),
        ], limit=1)

    @http.route('/api/v1/public/project/<string:alias>/pitch', type='http', auth='none', methods=['GET', 'OPTIONS'], csrf=False)
    def get_pitch(self, alias, **kwargs):
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        project = self._get_public_project(alias)
        if not project:
            return self._json_response({'error': 'Progetto non trovato o pitch disabilitato'}, 404)

        # incrementa contatore views
        try:
            project.write({
                'x_v6_pitch_views': (project.x_v6_pitch_views or 0) + 1,
                'x_v6_pitch_last_view': fields.Datetime.now(),
            })
        except Exception:
            _logger.exception("Incremento views pitch fallito")

        # charter (JSON)
        charter = None
        try:
            charter = json.loads(project.x_v6_charter or '{}') if project.x_v6_charter else None
        except Exception:
            charter = None
        # 23/09/2026: i campi (origin, pitchCosaCerchiamo, ...) vivono dentro
        # charter['data'], non al livello top (che contiene version/history).
        charter_data = (charter or {}).get('data') or {}

        # KPI pubblici: SOLO quelli esplicitamente pubblici (dal charter)
        kpi_pubblici = []
        if charter and isinstance(charter_data.get('kpi_pubblici'), list):
            kpi_pubblici = charter['kpi_pubblici']

        # 23/09/2026: parti rimosse dalla risposta pubblica (privacy).
        return self._json_response({
            'alias': alias,
            'name': project.name,
            'title': project.x_v6_pitch_title or project.name,
            'summary': project.x_v6_pitch_summary or (charter_data.get('descrizione') if charter else ''),
            'settore': project.x_v6_pitch_settore if hasattr(project, 'x_v6_pitch_settore') and project.x_v6_pitch_settore else (charter_data.get('pitchSettore') if charter else None) or (charter_data.get('settore') if charter else None),
            'obiettivo': charter_data.get('obiettivo') if charter else None,
            'cosa_cerchiamo': charter_data.get('pitchCosaCerchiamo') if charter else None,
            'tipologie_target': charter_data.get('pitchTipologieTarget') if charter else None,
            'cosa_offriamo': charter_data.get('pitchCosaOffriamo') if charter else None,
            'kpi_pubblici': kpi_pubblici,
            'views': project.x_v6_pitch_views or 0,
        })

    @http.route('/api/v1/public/project/<string:alias>/candidacy', type='http', auth='none', methods=['POST', 'OPTIONS'], csrf=False)
    def post_candidacy(self, alias, **kwargs):
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})

        project = self._get_public_project(alias)
        if not project:
            return self._json_response({'error': 'Progetto non trovato'}, 404)
        if 'erpv6.partnership.candidacy' not in request.env.registry:
            return self._json_response({'error': 'Servizio candidature non disponibile'}, 503)

        try:
            data = json.loads(request.httprequest.data or b'{}')
        except json.JSONDecodeError:
            return self._json_response({'error': 'JSON non valido'}, 400)

        name = (data.get('name') or '').strip()
        email = (data.get('email') or '').strip()
        if not name or not email:
            return self._json_response({'error': 'Nome ed email obbligatori'}, 400)

        env = request.env(user=request.env.ref('base.public_user'))
        proposal = (data.get('proposal') or '').strip()
        prefix = f"[{project.name}] "
        cid = env['erpv6.partnership.candidacy'].sudo().action_create_from_public_form(
            name=name,
            company_name=data.get('company_name') or data.get('company'),
            email=email,
            phone=data.get('phone'),
            proposal=(prefix + proposal) if proposal else prefix,
        )
        # 23/09/2026: registra il progetto di origine (se il campo esiste)
        try:
            cand = env['erpv6.partnership.candidacy'].sudo().browse(cid['id'])
            if 'source_project_alias' in cand._fields:
                cand.write({
                    'source_project_alias': project.email_alias or False,
                    'source_project_id': project.id,
                })
        except Exception:
            _logger.exception("Registrazione source_project candidacy fallita")
        return self._json_response({'success': True, 'id': cid.get('id')})
