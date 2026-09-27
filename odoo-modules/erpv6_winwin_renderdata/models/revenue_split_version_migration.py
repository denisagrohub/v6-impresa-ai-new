from odoo import api, fields, models
from odoo.exceptions import UserError
import json
import logging
import hashlib

_logger = logging.getLogger(__name__)


class RevenueSplitVersionMigration(models.Model):
    """Metodi di migrazione e utility per il versioning split.

    Step 2 (26/09/2026):
    - _migrate_all_splits(): crea v1 per ogni progetto con x_v6_revenue_split
      ma senza versioni esistenti
    - action_new_version(): crea nuova versione da bozza
    - action_freeze_version(): congela + invia a firma
    """
    _inherit = 'erpv6.revenue.split.version'

    @api.model
    def _migrate_all_splits(self):
        """Crea versione 1 per ogni progetto con split esistente ma senza versioni."""
        Relation = self.env['erpv6.tracking.relation'].sudo()
        Version = self.env['erpv6.revenue.split.version'].sudo()

        projects = Relation.search([
            ('x_v6_revenue_split', '!=', False),
            ('split_version_ids', '=', False),
        ])

        created = 0
        for proj in projects:
            try:
                # Determina stato iniziale dalla state dello split attuale
                state_map = {
                    'bozza': 'bozza',
                    'in_firma': 'in_firma',
                    'approvato': 'approvata',
                    'rifiutato': 'rifiutata',
                }
                v_state = state_map.get(proj.revenue_split_state or 'bozza', 'bozza')

                hash_value = hashlib.sha256(
                    (proj.x_v6_revenue_split or '').encode('utf-8')
                ).hexdigest()

                Version.create({
                    'relation_id': proj.id,
                    'version_number': 1,
                    'payload_json': proj.x_v6_revenue_split,
                    'hash': hash_value,
                    'blockchain_anchor': proj.revenue_split_hash or False,
                    'state': v_state,
                    'motivation': 'Migrazione iniziale — versione storica al 26/09/2026',
                    'created_by': self.env.user.id,
                })
                created += 1
            except Exception:
                _logger.exception('Migrazione fallita per progetto %s', proj.id)

        _logger.info('_migrate_all_splits: %s versioni create', created)
        return {'success': True, 'created': created}
