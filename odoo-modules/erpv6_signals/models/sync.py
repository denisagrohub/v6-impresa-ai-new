# pylint: disable=import-error
"""Sync signal da 4 sorgenti (C5-b).

03/10/2026: erpv6.signal è una facciata. Questo file popola la
facciata proiettando 4 sorgenti:
- erpv6.kaizen.detected_signal (13 sensori tecnici)
- erpv6.kaizen.manual_report (segnalazioni utenti)
- erpv6.heinrich.indicator (contatori sopra soglia)
- erpv6.suggestion (solo rule urgent, state new/shown)

Sync idempotente: dedup_key univoco, update invece di create.
"""
import json
import logging
from datetime import timedelta

from odoo import api, fields, models

_logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════
# Mapping statici (compilati dalla R del C5-b)
# ═══════════════════════════════════════════════════════════════
SEVERITY_OVERRIDE = {
    'validation_escalation_stuck': 'grave',
    'kb_extraction_stuck': 'grave',
    'frontend_error': 'medio',
    'typst_document_failed': 'medio',
    'claudio_argus_proposal_stuck': 'medio',
    'case_study_stalled_suggested_new': 'medio',
}

CATEGORY_BY_KEY = {
    'validation_escalation_stuck': 'system',
    'kb_extraction_stuck': 'system',
    'case_study_stalled_suggested_new': 'risk_timing',
    'typst_draft_not_compiling': 'system',
    'typst_document_failed': 'system',
    'claudio_argus_proposal_stuck': 'system',
    'frontend_error': 'system',
    'kg_coverage_missing_kaizen_button': 'system',
    'kg_coverage_typst_template_unmapped': 'system',
}

MANUAL_SEV_MAP = {
    'near_miss': 'lieve',
    'lieve': 'medio',
    'grave': 'grave',
}

SUGG_SEV_MAP = {
    'high': 'grave',
    'normal': 'medio',
    'low': 'lieve',
}

# Escludi i recovery (buone notizie, non problemi)
EXCLUDED_SIGNAL_KEYS = {
    'validation_recovered_5',
    'validation_recovered_1',
    'validation_recovered_after_retry',
}

# Aggrega questi signal_key per (signal_key, relation_id)
AGGREGATED_KEYS = {
    'validation_escalation_stuck',
}

# Finestra temporale per sync detected_signal
SYNC_DAYS_WINDOW = 30

# Soglie Heinrich
HEINRICH_GRAVI_THRESHOLD = 3
HEINRICH_LIEVI_THRESHOLD = 5
HEINRICH_NEAR_MISS_THRESHOLD = 10


class Erpv6SignalSync(models.Model):
    _inherit = 'erpv6.signal'

    # ───────────────────────────────────────────────────────────
    # Helpers
    # ───────────────────────────────────────────────────────────
    @api.model
    def _resolve_context(self, res_model, res_id):
        """Mappa (res_model, res_id) → (relation_id, deal_id)."""
        if not res_model or not res_id:
            return False, False
        if res_model == 'erpv6.deal':
            deal = self.env['erpv6.deal'].sudo().browse(res_id)
            if deal.exists():
                return (
                    deal.relation_id.id if deal.relation_id else False,
                    deal.id,
                )
        if res_model == 'erpv6.tracking.relation':
            rel = self.env['erpv6.tracking.relation'].sudo().browse(res_id)
            if rel.exists():
                return rel.id, False
        return False, False

    @api.model
    def _upsert_signal(self, dedup_key, **vals):
        """Create o update per dedup_key. Idempotente.

        Se esiste ed è in ('new', 'acknowledged') → aggiorna.
        Se esiste ed è ('resolved', 'ignored', 'expired') → non tocca.
        """
        evidence = vals.pop('evidence', {})
        vals['evidence'] = json.dumps(evidence, ensure_ascii=False)
        existing = self.search([('dedup_key', '=', dedup_key)], limit=1)
        if existing:
            if existing.state in ('new', 'acknowledged'):
                existing.write(vals)
            return existing
        vals['dedup_key'] = dedup_key
        vals.setdefault('state', 'new')
        return self.create(vals)

    @api.model
    def _title_from_signal(self, s):
        return (s.signal_key or '').replace('_', ' ').capitalize()

    # ───────────────────────────────────────────────────────────
    # Sync Kaizen detected_signal (individuali + aggregati)
    # ───────────────────────────────────────────────────────────
    @api.model
    def _sync_kaizen_detected(self):
        cutoff = fields.Datetime.now() - timedelta(days=SYNC_DAYS_WINDOW)
        signals = self.env['erpv6.kaizen.detected_signal'].sudo().search([
            ('detected_at', '>=', cutoff),
            ('signal_key', 'not in', list(EXCLUDED_SIGNAL_KEYS)),
        ])

        aggregated = signals.filtered(lambda s: s.signal_key in AGGREGATED_KEYS)
        individual = signals - aggregated

        count = 0

        # ── Individuali: 1 signal per record ──
        for s in individual:
            dedup = f"kaizen_detected:{s.signal_key}:{s.res_model}:{s.res_id}"
            severity = SEVERITY_OVERRIDE.get(s.signal_key, 'lieve')
            category = CATEGORY_BY_KEY.get(s.signal_key, 'system')
            relation_id, deal_id = self._resolve_context(s.res_model, s.res_id)

            self._upsert_signal(
                dedup_key=dedup,
                title=self._title_from_signal(s),
                description=f"Rilevato {s.signal_key} su {s.res_model} #{s.res_id}",
                source_type='kaizen_detected',
                source_model=s._name,
                source_id=s.id,
                severity=severity,
                category=category,
                relation_id=relation_id,
                deal_id=deal_id,
                evidence={
                    'res_model': s.res_model,
                    'res_id': s.res_id,
                    'signal_key': s.signal_key,
                    'detected_at': str(s.detected_at or ''),
                    'origin': s.origin,
                },
            )
            count += 1

        # ── Aggregati: 1 signal per (signal_key, relation_id) ──
        grouped = {}
        for s in aggregated:
            relation_id, _ = self._resolve_context(s.res_model, s.res_id)
            key = (s.signal_key, relation_id or 0)
            grouped.setdefault(key, []).append(s)

        for (signal_key, relation_id), records in grouped.items():
            dedup = f"kaizen_detected_agg:{signal_key}:{relation_id or 'none'}"
            severity = SEVERITY_OVERRIDE.get(signal_key, 'lieve')
            category = CATEGORY_BY_KEY.get(signal_key, 'system')

            rel_name = 'generico'
            if relation_id:
                rel = self.env['erpv6.tracking.relation'].sudo().browse(relation_id)
                if rel.exists():
                    rel_name = rel.name

            title = (f"{self._title_from_signal(records[0])} — "
                     f"{len(records)} su {rel_name}")

            detected_dates = [r.detected_at for r in records if r.detected_at]

            self._upsert_signal(
                dedup_key=dedup,
                title=title,
                description=f"{len(records)} occorrenze di {signal_key}",
                source_type='kaizen_detected',
                source_model='erpv6.kaizen.detected_signal',
                source_id=records[0].id,
                severity=severity,
                category=category,
                relation_id=relation_id or False,
                deal_id=False,
                evidence={
                    'signal_key': signal_key,
                    'count': len(records),
                    'record_ids': [r.id for r in records[:20]],
                    'first_at': str(min(detected_dates)) if detected_dates else '',
                    'last_at': str(max(detected_dates)) if detected_dates else '',
                },
            )
            count += 1

        return count

    # ───────────────────────────────────────────────────────────
    # Sync Kaizen manual_report
    # ───────────────────────────────────────────────────────────
    @api.model
    def _sync_kaizen_manual(self):
        reports = self.env['erpv6.kaizen.manual_report'].sudo().search([])
        count = 0
        for r in reports:
            dedup = f"kaizen_manual:{r.id}"
            severity = MANUAL_SEV_MAP.get(r.severity, 'lieve')

            related = r.related_record
            if related:
                relation_id, deal_id = self._resolve_context(
                    related._name, related.id)
            else:
                relation_id, deal_id = False, False

            self._upsert_signal(
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
                    'related': f"{related._name},{related.id}" if related else '',
                },
            )
            count += 1
        return count

    # ───────────────────────────────────────────────────────────
    # Sync Heinrich indicator (sopra soglia)
    # ───────────────────────────────────────────────────────────
    @api.model
    def _sync_heinrich_alerts(self):
        H = self.env['erpv6.heinrich.indicator'].sudo()
        thresholds = H.search([
            '|', '|',
            ('eventi_gravi', '>=', HEINRICH_GRAVI_THRESHOLD),
            ('problemi_lievi', '>=', HEINRICH_LIEVI_THRESHOLD),
            ('near_miss_segnalati', '>=', HEINRICH_NEAR_MISS_THRESHOLD),
        ])
        count = 0
        for h in thresholds:
            if h.eventi_gravi >= HEINRICH_GRAVI_THRESHOLD:
                severity = 'grave'
            elif h.problemi_lievi >= HEINRICH_LIEVI_THRESHOLD:
                severity = 'medio'
            else:
                severity = 'lieve'

            dedup = f"heinrich:{h.res_model}:{h.res_id}"
            relation_id, deal_id = self._resolve_context(h.res_model, h.res_id)

            title = f"Alert Heinrich: {h.res_model} #{h.res_id}"
            self._upsert_signal(
                dedup_key=dedup,
                title=title,
                description=(f"gravi={h.eventi_gravi}, "
                             f"lievi={h.problemi_lievi}, "
                             f"near_miss={h.near_miss_segnalati}"),
                source_type='heinrich_alert',
                source_model=h._name,
                source_id=h.id,
                severity=severity,
                category='system',
                relation_id=relation_id,
                deal_id=deal_id,
                evidence={
                    'near_miss': h.near_miss_segnalati,
                    'lievi': h.problemi_lievi,
                    'gravi': h.eventi_gravi,
                },
            )
            count += 1
        return count

    # ───────────────────────────────────────────────────────────
    # Sync Suggestion urgent
    # ───────────────────────────────────────────────────────────
    @api.model
    def _sync_suggestion_urgent(self):
        R = self.env['erpv6.suggestion.rule'].sudo()
        urgent_codes = R.search([
            ('communication_type', '=', 'urgent')
        ]).mapped('code')
        if not urgent_codes:
            return 0

        suggestions = self.env['erpv6.suggestion'].sudo().search([
            ('rule_code', 'in', urgent_codes),
            ('state', 'in', ['new', 'shown']),
        ])
        count = 0
        for s in suggestions:
            dedup = f"suggestion:{s.id}"
            severity = SUGG_SEV_MAP.get(s.priority, 'lieve')

            self._upsert_signal(
                dedup_key=dedup,
                title=s.title or f"Suggestion #{s.id}",
                description=s.body or '',
                source_type='suggestion_urgent',
                source_model=s._name,
                source_id=s.id,
                severity=severity,
                category='system',
                relation_id=s.relation_id.id if s.relation_id else False,
                deal_id=s.deal_id.id if s.deal_id else False,
                recipient_user_id=s.user_id.id if s.user_id else False,
                evidence={'rule_code': s.rule_code, 'priority': s.priority},
            )
            count += 1
        return count

    # ───────────────────────────────────────────────────────────
    # Expire orfani (suggestion cancellate)
    # ───────────────────────────────────────────────────────────
    @api.model
    def _expire_orphans(self):
        signals = self.search([
            ('source_type', '=', 'suggestion_urgent'),
            ('state', 'in', ['new', 'acknowledged']),
        ])
        for s in signals:
            if not s.source_model or not s.source_id:
                continue
            try:
                src = self.env[s.source_model].sudo().browse(s.source_id)
                if not src.exists():
                    s.state = 'expired'
            except Exception:  # pylint: disable=broad-except
                _logger.warning("Expire check fallito per signal %s", s.id)

    # ───────────────────────────────────────────────────────────
    # Cron principale
    # ───────────────────────────────────────────────────────────
    @api.model
    def _cron_sync_signals(self):
        n1 = self._sync_kaizen_detected()
        n2 = self._sync_kaizen_manual()
        n3 = self._sync_heinrich_alerts()
        n4 = self._sync_suggestion_urgent()
        self._expire_orphans()
        _logger.info(
            "Signal sync: kaizen=%s, manual=%s, heinrich=%s, suggestion=%s",
            n1, n2, n3, n4,
        )
        return n1 + n2 + n3 + n4
