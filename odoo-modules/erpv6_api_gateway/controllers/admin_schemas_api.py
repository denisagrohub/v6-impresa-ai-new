# pylint: disable=import-error
"""Admin API — schemi deal + suggest-schema automatico.

30/09/2026 (F2 B5): lista schemi con applicability_rules + step con firme,
e suggerimento automatico dato un set di parametri (vertical, revenue_model,
volume).
"""
import logging
import time

from odoo import http
from odoo.http import request

from .admin_deals_api import AdminDealsAPIController

_logger = logging.getLogger(__name__)


class AdminSchemasAPIController(AdminDealsAPIController):

    def _step_to_dict(self, st):
        return {
            'id': st.id,
            'sequence': st.sequence,
            'code': st.code or '',
            'label': st.label or '',
            'completionType': st.completion_type or '',
            'blocksDealState': bool(st.blocks_deal_state),
            'requiresCodes': st.requires_codes or '',
            'templateDocumentCode': st.template_document_code or '',
            'signerRoles': st.signer_roles or '',
            'signatureProvider': st.signature_provider or 'auto',
            'signatureLevel': st.signature_level or 'AES',
        }

    def _schema_to_dict(self, s, include_steps=False):
        d = {
            'id': s.id,
            'code': s.code or '',
            'name': s.name or '',
            'dealType': s.deal_type or '',
            'version': s.version,
            'active': bool(s.active),
            'applicabilityRules': s.applicability_rules or {},
            'description': s.description or '',
        }
        if include_steps:
            d['steps'] = [self._step_to_dict(st) for st in
                          s.step_ids.sorted('sequence')]
        return d

    # ─────────────────────────────────────────────────────────────
    # GET /api/v1/admin/schemas
    # ─────────────────────────────────────────────────────────────
    @http.route('/api/v1/admin/schemas', type='http',
                auth='none', methods=['GET', 'OPTIONS'], csrf=False)
    def list_schemas(self, **kw):
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        user, err = self._check_admin_perm()
        if err:
            return err

        Schema = request.env['erpv6.deal.schema'].sudo()
        schemas = Schema.search([('active', '=', True)], order='code, version desc')
        return self._json_response({
            'success': True,
            'schemas': [self._schema_to_dict(s) for s in schemas],
            'total': len(schemas),
        })

    # ─────────────────────────────────────────────────────────────
    # GET /api/v1/admin/schemas/<id>  (con step dettagliati)
    # ─────────────────────────────────────────────────────────────
    @http.route('/api/v1/admin/schemas/<int:schema_id>', type='http',
                auth='none', methods=['GET', 'OPTIONS'], csrf=False)
    def get_schema(self, schema_id, **kw):
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        user, err = self._check_admin_perm()
        if err:
            return err
        s = request.env['erpv6.deal.schema'].sudo().browse(schema_id)
        if not s.exists():
            return self._json_response({'error': 'Schema non trovato'}, 404)
        return self._json_response({
            'success': True,
            'schema': self._schema_to_dict(s, include_steps=True),
        })

    # ─────────────────────────────────────────────────────────────
    # GET /api/v1/admin/relations/<id>/suggest-schema
    #   ?vertical=...&revenue_model=...&volume=...
    # ─────────────────────────────────────────────────────────────
    @http.route('/api/v1/admin/relations/<int:relation_id>/suggest-schema',
                type='http', auth='none', methods=['GET', 'OPTIONS'], csrf=False)
    def suggest_schema(self, relation_id, **kw):
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        user, err = self._check_admin_perm()
        if err:
            return err

        Relation = request.env['erpv6.tracking.relation'].sudo()
        rel = Relation.browse(relation_id)
        if not rel.exists():
            return self._json_response({'error': 'Relation non trovata'}, 404)

        # Prendi parametri da query string o dal relation
        vertical = request.httprequest.args.get('vertical') or rel.vertical or ''
        revenue_model = request.httprequest.args.get('revenue_model') or rel.revenue_model_default or ''
        volume = request.httprequest.args.get('volume')
        try:
            volume = float(volume) if volume else None
        except (TypeError, ValueError):
            volume = None

        schema = rel._select_schema_for_relation({
            'vertical': vertical,
            'revenue_model': revenue_model,
            'relation_type': 'root' if not rel.parent_id else 'child',
            'volume': volume,
        })

        if not schema:
            return self._json_response({
                'success': True,
                'suggested': None,
                'reason': 'Nessuno schema applicabile per questi parametri',
            })

        return self._json_response({
            'success': True,
            'suggested': self._schema_to_dict(schema, include_steps=True),
        })
