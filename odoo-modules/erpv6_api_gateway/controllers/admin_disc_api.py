# pylint: disable=import-error
"""Admin DISC API — C1b-DISC.

Endpoint:
- POST /api/v1/admin/disc-profile/<partner_id>/regenerate
- GET  /api/v1/admin/disc-profile/<partner_id>
- GET  /api/v1/admin/disc-profile/<partner_id>/history
- DELETE /api/v1/admin/disc-profile/<partner_id>

Guardrail G1: solo admin + chief_projects.
G7: persona fisica senza legame business richiede ?force=true.
"""
import logging

from odoo import http
from odoo.exceptions import UserError
from odoo.http import request

from .consultant_api import ConsultantAPIController

_logger = logging.getLogger(__name__)


class AdminDiscAPIController(ConsultantAPIController):

    def _check_admin_chief(self):
        user, err = self._authenticate(require_auth=True)
        if err:
            return None, err
        if not (user.has_group('base.group_system')
                or user.has_group('erpv6_core.group_chief_projects')):
            return None, self._json_response(
                {'error': 'Riservato a admin/chief'}, 403)
        return user, None

    def _profile_to_dict(self, p):
        return {
            'id': p.id,
            'partner_id': p.partner_id.id,
            'partner_name': p.partner_id.name,
            'profile_type': p.profile_type,
            'confidence': p.confidence,
            'evidence': p.evidence,
            'sources_count': p.sources_count,
            'sources_types': p.sources_types,
            'version': p.version,
            'is_current': p.is_current,
            'generated_at': self._iso_utc(p.generated_at) if p.generated_at else None,
            'generated_by': p.generated_by.name if p.generated_by else None,
            'superseded_by': p.superseded_by.id if p.superseded_by else None,
        }

    # ═══════════════════════════════════════════════════════════════
    # POST /<partner_id>/regenerate
    # ═══════════════════════════════════════════════════════════════
    @http.route('/api/v1/admin/disc-profile/<int:partner_id>/regenerate',
                type='http', auth='none', methods=['POST', 'OPTIONS'], csrf=False)
    def regenerate(self, partner_id, **kwargs):  # pylint: disable=unused-argument
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        user, err = self._check_admin_chief()
        if err:
            return err

        force = (request.httprequest.args.get('force') or '').lower() in ('1', 'true', 'yes')

        Partner = request.env['res.partner'].sudo()
        partner = Partner.browse(partner_id)
        if not partner.exists():
            return self._json_response({'error': 'Partner non trovato'}, 404)

        # 02/10/2026: usa env legato all'utente autenticato. In auth='none'
        # + JWT, env.user è 0/False e fa fallire NOT NULL su crypto_audit.
        env_user = request.env(user=user.id)
        Profile = env_user['erpv6.partner.disc_profile'].sudo()
        try:
            new = Profile._regenerate_for_partner(partner, force_person=force)
            request.env.cr.commit()
            return self._json_response(self._profile_to_dict(new))
        except UserError as e:
            return self._json_response({
                'error': str(e),
                'requires_force': True,
            }, 400)
        except Exception as e:
            _logger.exception('DISC regenerate fallito')
            return self._json_response({'error': str(e)}, 500)

    # ═══════════════════════════════════════════════════════════════
    # GET /<partner_id>
    # ═══════════════════════════════════════════════════════════════
    @http.route('/api/v1/admin/disc-profile/<int:partner_id>',
                type='http', auth='none', methods=['GET', 'OPTIONS'], csrf=False)
    def get_current(self, partner_id, **kwargs):  # pylint: disable=unused-argument
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        user, err = self._check_admin_chief()
        if err:
            return err

        Profile = request.env['erpv6.partner.disc_profile'].sudo()
        p = Profile.search([
            ('partner_id', '=', partner_id),
            ('is_current', '=', True),
        ], limit=1)
        if not p:
            return self._json_response({'error': 'Nessun profilo'}, 404)
        return self._json_response(self._profile_to_dict(p))

    # ═══════════════════════════════════════════════════════════════
    # GET /<partner_id>/history
    # ═══════════════════════════════════════════════════════════════
    @http.route('/api/v1/admin/disc-profile/<int:partner_id>/history',
                type='http', auth='none', methods=['GET', 'OPTIONS'], csrf=False)
    def get_history(self, partner_id, **kwargs):  # pylint: disable=unused-argument
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        user, err = self._check_admin_chief()
        if err:
            return err

        Profile = request.env['erpv6.partner.disc_profile'].sudo()
        versions = Profile.search([('partner_id', '=', partner_id)],
                                  order='version desc')
        return self._json_response({
            'versions': [self._profile_to_dict(v) for v in versions],
            'total': len(versions),
        })

    # ═══════════════════════════════════════════════════════════════
    # DELETE /<partner_id> — admin only (G6 revoca)
    # ═══════════════════════════════════════════════════════════════
    @http.route('/api/v1/admin/disc-profile/<int:partner_id>',
                type='http', auth='none', methods=['DELETE', 'OPTIONS'], csrf=False)
    def revoke(self, partner_id, **kwargs):  # pylint: disable=unused-argument
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        user, err = self._authenticate(require_auth=True)
        if err:
            return err
        if not user.has_group('base.group_system'):
            return self._json_response({'error': 'Solo admin'}, 403)

        Profile = request.env['erpv6.partner.disc_profile'].sudo()
        profiles = Profile.search([('partner_id', '=', partner_id)])
        n = len(profiles)
        profiles.unlink()
        request.env.cr.commit()
        return self._json_response({'success': True, 'deleted': n})
