# pylint: disable=import-error
"""Admin Andon API (C5-h).

04/10/2026: endpoint per il FAB Andon. Riceve una segnalazione
manuale dal frontend (admin/consulente), crea un
erpv6.kaizen.manual_report con related_record + source_url, e il
ciclo Kaizen parte automaticamente (hook create esistente:
_log_to_heinrich + _create_detected_signal).

Il segnale manuale dell'utente e' il punto d'ingresso del ciclo
Ford->Toyota.
"""
import json
import logging

from odoo import http
from odoo.http import request

from .consultant_api import ConsultantAPIController

_logger = logging.getLogger(__name__)

VALID_SEVERITIES = ('near_miss', 'lieve', 'grave')


class AdminAndonAPIController(ConsultantAPIController):

    @http.route(
        '/api/v1/admin/andon/report',
        type='http', auth='none', methods=['POST', 'OPTIONS'], csrf=False,
    )
    def andon_report(self, **kwargs):  # pylint: disable=unused-argument
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        user, err = self._authenticate(require_auth=True)
        if err:
            return err
        # 04/10/2026 (C5-h): propaga user JWT nell'env. Necessario per
        # erpv6.crypto_audit (user_id NOT NULL) che scatta durante
        # create manual_report → execute_ai_task (Hook Kaizen).
        request.update_env(user=user.id)

        try:
            body = json.loads(request.httprequest.data or b'{}')
        except (ValueError, TypeError):
            return self._json_response({'error': 'JSON non valido'}, 400)

        title = (body.get('title') or '').strip()[:120]
        description = (body.get('description') or '').strip()
        severity = (body.get('severity') or 'lieve').strip()
        source_url = (body.get('source_url') or '').strip()[:255]
        relation_id = body.get('relation_id')
        deal_id = body.get('deal_id')

        if not title:
            return self._json_response(
                {'error': 'Titolo obbligatorio'}, 400)
        if severity not in VALID_SEVERITIES:
            return self._json_response(
                {'error': 'Gravita non valida'}, 400)

        # 04/10/2026 (C5-h): related_record sempre valorizzato per il
        # ciclo Kaizen. Se relation_id/deal_id mancano, fallback al nodo
        # "Andon — segnalazioni interne" (id noto).
        ANDON_FALLBACK_ID = 94
        related_record = False
        if relation_id:
            rel = request.env['erpv6.tracking.relation'].sudo().browse(
                int(relation_id))
            if rel.exists():
                related_record = 'erpv6.tracking.relation,%d' % rel.id
        elif deal_id:
            deal = request.env['erpv6.deal'].sudo().browse(int(deal_id))
            if deal.exists():
                related_record = 'erpv6.deal,%d' % deal.id

        if not related_record:
            rel = request.env['erpv6.tracking.relation'].sudo().browse(
                ANDON_FALLBACK_ID)
            if rel.exists():
                related_record = 'erpv6.tracking.relation,%d' % rel.id
            else:
                _logger.warning(
                    "Andon fallback nodo %d non trovato", ANDON_FALLBACK_ID)
                return self._json_response({
                    'error': 'Nodo Andon fallback non configurato',
                }, 500)

        try:
            report = request.env['erpv6.kaizen.manual_report'].sudo().create({
                'name': title,
                'description': description or title,
                'severity': severity,
                'related_record': related_record,
                'reporter_id': user.id,
                'source_url': source_url,
            })
            request.env.cr.commit()
        except Exception as ex:
            _logger.exception('Andon report create failed')
            return self._json_response({'error': str(ex)[:200]}, 400)

        return self._json_response({
            'success': True,
            'id': report.id,
            'severity': report.severity,
            'detected_signal_id': (
                report.detected_signal_id.id
                if report.detected_signal_id else None),
        })
