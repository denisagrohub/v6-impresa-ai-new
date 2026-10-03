# pylint: disable=import-error
"""Hook post-create su erpv6.kaizen.manual_report (C5-b).

03/10/2026: quando un utente crea una segnalazione manuale, crea
subito il signal corrispondente (Andon immediato) invece di
aspettare il cron ogni 15 min.
"""
import logging

from odoo import api, models

_logger = logging.getLogger(__name__)


class KaizenManualReport(models.Model):
    _inherit = 'erpv6.kaizen.manual_report'

    @api.model_create_multi
    def create(self, vals_list):
        reports = super().create(vals_list)
        try:
            Signal = self.env['erpv6.signal'].sudo()
            for r in reports:
                dedup = f"kaizen_manual:{r.id}"
                sev_map = {'near_miss': 'lieve', 'lieve': 'medio', 'grave': 'grave'}
                severity = sev_map.get(r.severity, 'lieve')
                related = r.related_record
                if related:
                    relation_id, deal_id = Signal._resolve_context(
                        related._name, related.id)
                else:
                    relation_id, deal_id = False, False
                Signal._upsert_signal(
                    dedup_key=dedup,
                    title=r.name or f"Segnalazione #{r.id}",
                    description=r.description or '',
                    source_type='kaizen_manual',
                    source_model=r._name,
                    source_id=r.id,
                    severity=severity,
                    category='system',
                    relation_id=relation_id,
                    deal_id=deal_id,
                    recipient_user_id=r.reporter_id.id if r.reporter_id else False,
                    evidence={
                        'severity_orig': r.severity,
                        'reporter': r.reporter_id.name if r.reporter_id else '',
                        'hook': 'post_create',
                    },
                )
        except Exception:  # pylint: disable=broad-except
            _logger.exception(
                "Hook signal post-create manual_report fallito (non bloccante)")
        return reports
