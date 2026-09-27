# pylint: disable=import-error
"""Admin Split Versions API — versioning split V6.

Espone:
- GET  /api/v1/admin/splits/<relation_id>/versions           lista
- POST /api/v1/admin/splits/<relation_id>/versions           nuova versione
- POST /api/v1/admin/splits/<relation_id>/versions/<vid>/freeze  congela + invia
- POST /api/v1/admin/splits/<relation_id>/versions/<vid>/supersede  marca superata
"""
import hashlib
import json
import logging
import time

from odoo import http
from odoo.http import request

from .consultant_api import ConsultantAPIController

_logger = logging.getLogger(__name__)


class AdminSplitVersionsAPIController(ConsultantAPIController):

    def _require_admin(self):
        user, error_response = self._authenticate(require_auth=True)
        if error_response:
            return None, error_response
        if not user.has_group('base.group_system'):
            return None, self._json_response({'error': 'Riservato agli amministratori'}, 403)
        return user, None

    def _version_to_dict(self, v, include_payload=False):
        d = {
            'id': v.id,
            'versionNumber': v.version_number,
            'state': v.state,
            'motivation': v.motivation or '',
            'hash': v.hash,
            'blockchainAnchor': v.blockchain_anchor,
            'createdAt': v.create_date.isoformat() if v.create_date else None,
            'createdBy': v.created_by.name if v.created_by else None,
            'supersededById': v.superseded_by_id.id if v.superseded_by_id else None,
            'signRequestIds': v.sign_request_ids.ids,
            'signRequestsCount': len(v.sign_request_ids),
            # 27/09/2026: firma incrementale
            'predecessorId': v.predecessor_id.id if v.predecessor_id else None,
            'signersRequired': v.signers_required or [],
            'diff': None,
        }
        try:
            if v.diff_json:
                d['diff'] = json.loads(v.diff_json)
        except Exception:
            d['diff'] = None
        if include_payload:
            try:
                d['payload'] = json.loads(v.payload_json or '{}')
            except Exception:
                d['payload'] = {}
        return d

    @http.route('/api/v1/admin/splits/<int:relation_id>/versions',
                type='http', auth='none', methods=['GET', 'OPTIONS'], csrf=False)
    def list_versions(self, relation_id, **kwargs):
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        user, err = self._require_admin()
        if err:
            return err

        env = request.env
        if 'erpv6.revenue.split.version' not in env:
            return self._json_response({'error': 'modello non disponibile'}, 501)

        Relation = env['erpv6.tracking.relation'].sudo().browse(relation_id)
        if not Relation.exists():
            return self._json_response({'error': 'Progetto non trovato'}, 404)

        include = request.httprequest.args.get('includePayload', '') in ('1', 'true')
        versions = env['erpv6.revenue.split.version'].sudo().search(
            [('relation_id', '=', relation_id)],
            order='version_number desc',
        )

        return self._json_response({
            'success': True,
            'versions': [self._version_to_dict(v, include_payload=include) for v in versions],
            'total': len(versions),
            'activeVersionId': Relation.active_split_version_id.id if Relation.active_split_version_id else None,
        })

    @http.route('/api/v1/admin/splits/<int:relation_id>/versions',
                type='http', auth='none', methods=['POST', 'OPTIONS'], csrf=False)
    def create_version(self, relation_id, **kwargs):
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        user, err = self._require_admin()
        if err:
            return err

        env = request.env
        Relation = env['erpv6.tracking.relation'].sudo().browse(relation_id)
        if not Relation.exists():
            return self._json_response({'error': 'Progetto non trovato'}, 404)

        try:
            body = json.loads(request.httprequest.get_data(as_text=True) or '{}')
        except json.JSONDecodeError:
            return self._json_response({'error': 'JSON non valido'}, 400)

        payload = body.get('payload') or {}
        motivation = (body.get('motivation') or '').strip()
        if not motivation:
            return self._json_response({'error': 'Motivazione obbligatoria'}, 400)

        # Calcola next version_number
        Version = env['erpv6.revenue.split.version'].sudo()
        last = Version.search([('relation_id', '=', relation_id)], order='version_number desc', limit=1)
        next_number = (last.version_number + 1) if last else 1

        # Hash payload
        payload_json = json.dumps(payload, ensure_ascii=False)
        hash_value = hashlib.sha256(payload_json.encode('utf-8')).hexdigest()

        # 27/09/2026: calcola diff vs versione precedente (firma incrementale)
        if last:
            diff = Version._compute_diff(last.payload_json, payload_json)
        else:
            # Prima versione: tutti i consulenti devono firmare
            all_signers = [
                b['res_partner_id']
                for b in (payload.get('beneficiari') or [])
                if b.get('tipo') == 'consulente' and b.get('res_partner_id')
            ]
            diff = {
                'added': all_signers, 'removed': [], 'changed': [],
                'unchanged': [], 'signers_required': all_signers,
            }

        # Crea versione con diff + signers_required
        new_version = Version.create({
            'relation_id': relation_id,
            'version_number': next_number,
            'payload_json': payload_json,
            'hash': hash_value,
            'state': 'bozza',
            'motivation': motivation,
            'created_by': user.id,
            'predecessor_id': last.id if last else False,
            'diff_json': json.dumps(diff),
            'signers_required': diff['signers_required'],
        })

        # Supersede la precedente se era approvata/in_firma
        if last and last.state in ('approvata', 'in_firma'):
            last.write({
                'state': 'superata',
                'superseded_by_id': new_version.id,
            })

        # Aggiorna anche il campo JSON del relation (compatibilità)
        Relation.write({
            'x_v6_revenue_split': payload_json,
            'revenue_split_state': 'bozza',
            'revenue_split_approved': False,
            'revenue_split_approved_at': False,
            'revenue_split_hash': False,
            'revenue_split_notified_at': False,
            'revenue_split_accepted_at': False,
            'revenue_split_accepted_by': False,
        })

        return self._json_response({
            'success': True,
            'version': self._version_to_dict(new_version, include_payload=True),
        })

    @http.route('/api/v1/admin/splits/<int:relation_id>/versions/<int:vid>/freeze',
                type='http', auth='none', methods=['POST', 'OPTIONS'], csrf=False)
    def freeze_version(self, relation_id, vid, **kwargs):
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        user, err = self._require_admin()
        if err:
            return err

        env = request.env
        Version = env['erpv6.revenue.split.version'].sudo()
        v = Version.browse(vid)
        if not v.exists() or v.relation_id.id != relation_id:
            return self._json_response({'error': 'Versione non trovata'}, 404)
        if v.state != 'bozza':
            return self._json_response({'error': f'Versione in stato {v.state}, non congelabile'}, 400)

        # 27/09/2026: auth='none' -> env.user vuoto, forziamo l'utente autenticato
        Relation = v.relation_id.with_user(user.id).sudo()
        try:
            import json as _json
            import hashlib
            from odoo import fields

            # 1. Aggiorna Relation con payload + hash della versione
            Relation.write({
                'x_v6_revenue_split': v.payload_json,
                'revenue_split_hash': v.hash,
                'revenue_split_state': 'in_firma',
                'revenue_split_approved_at': fields.Datetime.now(),
                'revenue_split_approved_by': user.id,
            })

            # 2. Firma incrementale: solo signers_required (added + changed)
            signers = v.signers_required or []
            split_data = _json.loads(v.payload_json or '{}')

            # Cancella eventuali sign request orfani
            SignReq = env['erpv6.sign.request'].with_user(user.id).sudo()
            orphans = SignReq.search([
                ('split_project_id', '=', relation_id),
                ('status', 'in', ['draft', 'sent', 'viewed']),
            ])
            for o in orphans:
                try:
                    o.action_cancel()
                except Exception:
                    o.write({'status': 'cancelled'})

            sent = []
            skipped = []
            removed = []

            if not signers:
                # Nessun firmatario richiesto: auto-approva
                v.write({'state': 'approvata'})
                Relation.write({
                    'revenue_split_state': 'approvato',
                    'revenue_split_approved': True,
                })
                return self._json_response({
                    'success': True,
                    'version': self._version_to_dict(v),
                    'message': 'Nessun firmatario richiesto: approvato automaticamente',
                    'sent': [], 'skipped': [], 'removed': [],
                })

            # Crea sign request solo per signers_required
            Partner = env['res.partner'].with_user(user.id).sudo()
            for pid in signers:
                partner = Partner.browse(pid)
                if not partner.exists():
                    continue
                benef = next(
                    (b for b in (split_data.get('beneficiari') or [])
                     if b.get('res_partner_id') == pid),
                    None,
                )
                if not benef:
                    continue
                try:
                    result = Relation._generate_split_sign_request(partner, benef, split_data)
                    if result.get('sign_request_id'):
                        sent.append({
                            'partner_id': pid,
                            'partner_name': partner.name,
                            'sign_request_id': result['sign_request_id'],
                        })
                    # Marca il sign request con la versione
                    if result.get('sign_request_id'):
                        SignReq.browse(result['sign_request_id']).write({
                            'split_version_id': v.id,
                        })
                except Exception:
                    _logger.exception('Invio firma fallito per partner %s', pid)

            # Traccia skipped (unchanged) e removed
            try:
                diff = _json.loads(v.diff_json or '{}')
                skipped = diff.get('unchanged', [])
                removed = diff.get('removed', [])
            except Exception:
                pass

            v.write({'state': 'in_firma'})

            return self._json_response({
                'success': True,
                'version': self._version_to_dict(v),
                'message': f'Congelata e inviata a {len(sent)} firmatari (skipped {len(skipped)}, removed {len(removed)})',
                'sent': sent,
                'skipped': skipped,
                'removed': removed,
            })
        except Exception as e:
            _logger.exception('Freeze fallito')
            return self._json_response({'error': str(e)}, 500)
