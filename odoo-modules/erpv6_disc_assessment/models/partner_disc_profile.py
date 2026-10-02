# pylint: disable=import-error
"""Profilo DISC inferito per controparti B2B.

02/10/2026 (C1b-DISC): il modulo erpv6_disc_assessment aveva solo la
Fase A (intervista attiva su res.users = dipendenti). Qui si aggiunge
l'inferenza PASSIVA su controparti business (res.partner).

Guardrail G1-G7:
  G1 visibilità solo admin/chief (record rule)
  G2 nessuna decisione automatica (solo aiuto informativo)
  G3 evidence sempre citata
  G4 log completo (evidence + generated_by + generated_at)
  G5 versioning (is_current, superseded_by, version)
  G6 revoca (unlink tutte le versioni)
  G7 automatica solo per controparti B2B; persona fisica senza
     legame business → force esplicito

Riferimento regola: ADDENDUM.md S.3 ("DISC sempre output, MAI
client-facing").
"""
import json
import logging

from odoo import _, api, fields, models
from odoo.exceptions import UserError

_logger = logging.getLogger(__name__)

PROFILE_SELECTION = [
    ('D', 'D — Dominance'),
    ('I', 'I — Influence'),
    ('S', 'S — Steadiness'),
    ('C', 'C — Compliance'),
    ('misto', 'Misto'),
    ('incerto', 'Incerto'),
]


class Erpv6PartnerDiscProfile(models.Model):
    _name = 'erpv6.partner.disc_profile'
    _description = 'Profilo DISC inferito per controparte B2B'
    _order = 'partner_id, version desc'

    partner_id = fields.Many2one(
        'res.partner', string='Controparte', required=True,
        index=True, ondelete='cascade')
    profile_type = fields.Selection(
        PROFILE_SELECTION, string='Profilo', required=True,
        default='incerto')
    confidence = fields.Integer(string='Confidence (0-100)', default=0)
    evidence = fields.Text(string='Evidenza (JSON)')
    sources_count = fields.Integer(string='Numero fonti', default=0)
    sources_types = fields.Char(string='Tipi fonte (CSV)')
    generated_at = fields.Datetime(
        string='Generato il', default=fields.Datetime.now, readonly=True)
    generated_by = fields.Many2one(
        'res.users', string='Generato da',
        default=lambda self: self.env.user, readonly=True)
    version = fields.Integer(string='Versione', default=1, readonly=True)
    superseded_by = fields.Many2one(
        'erpv6.partner.disc_profile',
        string='Sostituito da', readonly=True)
    is_current = fields.Boolean(
        string='Corrente', default=True, index=True)
    revocable = fields.Boolean(string='Revocabile', default=True)

    _sql_constraints = [
        ('partner_version_uniq', 'unique(partner_id, version)',
         'Una sola versione per numero per partner.'),
    ]

    # ═══════════════════════════════════════════════════════════════
    # G7 — controparte B2B?
    # ═══════════════════════════════════════════════════════════════
    @api.model
    def _is_business_counterpart(self, partner):
        """True se partner ha un legame business strutturato.

        Un utente interno V6 (ha user_ids) è escluso: è un dipendente,
        non una controparte.
        """
        if partner.user_ids:
            return False
        # Firmatario su sign.request
        if self.env['erpv6.sign.request'].sudo().search_count([
            ('partner_id', '=', partner.id)
        ]) > 0:
            return True
        # Seller/buyer su deal
        if self.env['erpv6.deal'].sudo().search_count([
            '|',
            ('seller_id', '=', partner.id),
            ('buyer_id', '=', partner.id),
        ]) > 0:
            return True
        # Parte attiva su relation
        if self.env['erpv6.tracking.relation'].sudo().search_count([
            ('partner_id', '=', partner.id),
            ('child_kind', '=', 'parte'),
        ]) > 0:
            return True
        # Owner di una relation (via user partner)
        if self.env['erpv6.tracking.relation'].sudo().search_count([
            ('owner_user_id.partner_id', '=', partner.id)
        ]) > 0:
            return True
        return False

    # ═══════════════════════════════════════════════════════════════
    # CONTEXT AGGREGATOR
    # ═══════════════════════════════════════════════════════════════
    @api.model
    def _collect_context(self, partner):
        """Raccoglie contesto da email, deal.event, note, charter, scouting.

        Ritorna dict con liste di item {date, source, text}.
        """
        out = {
            'emails_in': [],
            'emails_out': [],
            'deal_events': [],
            'relation_notes': [],
            'charter_excerpts': [],
            'scouting_excerpts': [],
            'other': [],
        }
        if not partner.email:
            return out

        # 1) Email in/out
        Log = self.env['erpv6.project.email.log'].sudo()
        em_in = Log.search([
            ('sender_email', 'ilike', partner.email),
        ], order='create_date desc', limit=20)
        for e in em_in:
            out['emails_in'].append({
                'date': str(e.create_date or ''),
                'source': 'email_in',
                'text': f"Oggetto: {(e.name or '')[:120]} | From: {(e.sender_email or '')[:80]}",
            })

        em_out = Log.search([
            ('recipient_emails', 'ilike', partner.email),
        ], order='create_date desc', limit=10)
        for e in em_out:
            out['emails_out'].append({
                'date': str(e.create_date or ''),
                'source': 'email_out',
                'text': f"Oggetto: {(e.name or '')[:120]} | To: {(e.recipient_emails or '')[:80]}",
            })

        # 2) Deal.event via seller/buyer
        Deal = self.env['erpv6.deal'].sudo()
        my_deals = Deal.search([
            '|',
            ('seller_id', '=', partner.id),
            ('buyer_id', '=', partner.id),
        ])
        if my_deals:
            events = self.env['erpv6.deal.event'].sudo().search([
                ('deal_id', 'in', my_deals.ids),
            ], order='create_date desc', limit=15)
            for ev in events:
                out['deal_events'].append({
                    'date': str(ev.create_date or ''),
                    'source': 'deal_event',
                    'text': f"[{ev.event_type or '?'}] {(ev.title or '')[:120]} | "
                            f"{(ev.description or '')[:200]}",
                })

        # 3) Relation come parte attiva: charter/scouting
        Relation = self.env['erpv6.tracking.relation'].sudo()
        rels = Relation.search([
            ('partner_id', '=', partner.id),
        ], limit=10)
        for r in rels:
            if r.x_v6_charter:
                try:
                    ch = json.loads(r.x_v6_charter)
                    data = ch.get('data') or ch
                    pitch = data.get('pitchCosaCerchiamo') or data.get('pitchSettore') or ''
                    if pitch:
                        out['charter_excerpts'].append({
                            'date': '',
                            'source': 'charter',
                            'text': f"{r.name}: {str(pitch)[:300]}",
                        })
                except Exception:
                    pass
            if r.x_v6_scouting:
                try:
                    sc = json.loads(r.x_v6_scouting)
                    data = sc.get('data') or sc
                    out['scouting_excerpts'].append({
                        'date': '',
                        'source': 'scouting',
                        'text': f"{r.name}: {json.dumps(data)[:300]}",
                    })
                except Exception:
                    pass

        return out

    # ═══════════════════════════════════════════════════════════════
    # INFERENZA
    # ═══════════════════════════════════════════════════════════════
    @api.model
    def _infer_profile(self, partner, context=None, force_person=False):
        """Inferisce profilo DISC. Ritorna dict {profile_type, confidence,
        evidence, sources_count, sources_types}.

        G7: se non è company E non è business counterpart E force_person
        non è True → UserError.
        """
        if context is None:
            context = self._collect_context(partner)

        is_company = partner.is_company
        is_b2b = self._is_business_counterpart(partner)
        if not is_company and not is_b2b and not force_person:
            raise UserError(_(
                "Persona fisica senza legame di business documentato. "
                "Conferma esplicita richiesta (GDPR art. 22). "
                "Passa force_person=True per procedere."
            ))

        # Conteggio fonti
        sources_count = sum(len(v) for v in context.values() if isinstance(v, list))
        sources_types = ','.join(sorted({k for k, v in context.items()
                                        if isinstance(v, list) and v}))

        # Troppo poche fonti → incerto
        if sources_count < 3:
            return {
                'profile_type': 'incerto',
                'confidence': min(20, sources_count * 5),
                'evidence': json.dumps({
                    'sources_cited': [],
                    'rationale': f"Solo {sources_count} fonti — sotto la "
                                 f"soglia minima di 3.",
                }, ensure_ascii=False),
                'sources_count': sources_count,
                'sources_types': sources_types,
            }

        # Chiamata AI
        fallback = {
            'profile_type': 'incerto',
            'confidence': 0,
            'evidence': json.dumps({
                'sources_cited': [],
                'rationale': 'AI non disponibile o parsing fallito.',
            }, ensure_ascii=False),
            'sources_count': sources_count,
            'sources_types': sources_types,
        }

        # 02/10/2026: savepoint per proteggere la transazione da errori
        # provider AI (es. decrypt API key fallito in contesto JWT).
        # Senza, l'eccezione abortisce l'intera richiesta.
        try:
            self.env.cr.execute("SAVEPOINT disc_ai_call")
        except Exception:
            pass

        try:
            if 'erpv6.omni.bridge' not in self.env:
                return fallback
            bridge = self.env['erpv6.omni.bridge'].sudo()

            # Prepara contesto compatto
            compact = {}
            for key, items in context.items():
                if not isinstance(items, list) or not items:
                    continue
                compact[key] = [i['text'] for i in items[:5]]

            payload = {
                'messages': [
                    {'role': 'system', 'content': (
                        'Sei un analista comportamentale esperto. Leggi il contesto '
                        'su una persona e classifica il suo profilo DISC prevalente.\n\n'
                        'Profili:\n'
                        '  D — diretto, orientato al risultato, decisioni rapide\n'
                        '  I — socievole, entusiasta, relazionale\n'
                        '  S — paziente, cooperativo, stabile\n'
                        '  C — analitico, preciso, orientato ai dati\n'
                        '  misto — due profili co-dominanti con evidenza\n'
                        '  incerto — dati insufficienti o non comportamentali\n\n'
                        'Regole:\n'
                        '- Se le fonti sono < 3 o non contengono segnali '
                        'comportamentali, ritorna "incerto" con confidence < 40.\n'
                        '- Cita sempre 2-3 frasi specifiche del contesto.\n'
                        '- Non inventare.\n\n'
                        'Output JSON (nessun altro testo):\n'
                        '{"profile_type":"D|I|S|C|misto|incerto",'
                        '"confidence":0-100,'
                        '"evidence":{"sources_cited":["..."],'
                        '"rationale":"..."}}'
                    )},
                    {'role': 'user', 'content': (
                        f"Partner: {partner.name}\n"
                        f"Contesto:\n{json.dumps(compact, ensure_ascii=False, indent=1)}"
                    )},
                ],
                'model': 'gpt-4-turbo',
                'temperature': 0.2,
            }
            resp = bridge.execute_ai_task(
                'disc_profile_generation', payload=payload,
                context={'partner_id': partner.id},
            )
            text = ''
            if isinstance(resp, dict) and resp.get('success'):
                try:
                    choices = (resp.get('data') or {}).get('choices') or []
                    if choices:
                        text = (choices[0].get('message') or {}).get('content') or ''
                except Exception:
                    text = ''

            if not text:
                return fallback

            # Parse JSON (a volte il modello avvolge in ```json ... ```)
            txt = text.strip()
            if txt.startswith('```'):
                txt = txt.split('```')[1]
                if txt.startswith('json'):
                    txt = txt[4:]
            txt = txt.strip()
            try:
                parsed = json.loads(txt)
            except json.JSONDecodeError:
                _logger.warning('DISC parse JSON fallito: %s', txt[:200])
                return fallback

            profile_type = str(parsed.get('profile_type') or 'incerto').lower()
            if profile_type not in ('d', 'i', 's', 'c', 'misto', 'incerto'):
                profile_type = 'incerto'
            profile_type = profile_type.upper() if profile_type in ('d', 'i', 's', 'c') else profile_type

            confidence = int(parsed.get('confidence') or 0)
            confidence = max(0, min(100, confidence))

            evidence = parsed.get('evidence') or {}
            return {
                'profile_type': profile_type,
                'confidence': confidence,
                'evidence': json.dumps(evidence, ensure_ascii=False),
                'sources_count': sources_count,
                'sources_types': sources_types,
            }
        except Exception as e:
            # Rollback al savepoint: la transazione principale resta valida
            try:
                self.env.cr.execute("ROLLBACK TO SAVEPOINT disc_ai_call")
            except Exception:
                pass
            _logger.warning('DISC infer fallita per partner %s: %s', partner.id, e)
            return fallback
        finally:
            try:
                self.env.cr.execute("RELEASE SAVEPOINT disc_ai_call")
            except Exception:
                pass

    # ═══════════════════════════════════════════════════════════════
    # VERSIONING
    # ═══════════════════════════════════════════════════════════════
    @api.model
    def _save_new_version(self, partner, profile_data):
        """Crea nuova versione, supersede la corrente."""
        current = self.sudo().search([
            ('partner_id', '=', partner.id),
            ('is_current', '=', True),
        ])
        next_version = 1
        if current:
            next_version = (current[0].version or 0) + 1

        vals = dict(profile_data or {})
        # 02/10/2026: generated_by = utente corrente se valido, altrimenti admin
        gen_uid = self.env.uid if (self.env.uid and self.env.uid not in (0, 4)) else 2
        vals.update({
            'partner_id': partner.id,
            'version': next_version,
            'is_current': True,
            'generated_at': fields.Datetime.now(),
            'generated_by': gen_uid,
        })
        new = self.sudo().create(vals)
        if current:
            current.write({
                'is_current': False,
                'superseded_by': new.id,
            })
        return new

    @api.model
    def _regenerate_for_partner(self, partner, force_person=False):
        """Endpoint logico: collect + infer + save."""
        ctx = self._collect_context(partner)
        profile = self._infer_profile(partner, context=ctx, force_person=force_person)
        return self._save_new_version(partner, profile)

    @api.model
    def _cron_refresh_counterparts(self, max_partners=20):
        """Cron: rigenera profilo per controparti B2B con attività recente.

        G7: esclude persone fisiche senza legame business e utenti V6.
        """
        from datetime import timedelta as _td
        cutoff = fields.Datetime.now() - _td(days=30)

        recent_events = self.env['erpv6.deal.event'].sudo().search([
            ('create_date', '>=', cutoff),
            ('deal_id', '!=', False),
        ])
        partner_ids = set()
        for ev in recent_events:
            d = ev.deal_id
            if d.seller_id:
                partner_ids.add(d.seller_id.id)
            if d.buyer_id:
                partner_ids.add(d.buyer_id.id)

        Partner = self.env['res.partner'].sudo()
        count = 0
        for pid in list(partner_ids)[:max_partners]:
            partner = Partner.browse(pid)
            try:
                if partner.user_ids:
                    continue
                if not partner.is_company and not self._is_business_counterpart(partner):
                    continue
                self._regenerate_for_partner(partner)
                count += 1
            except Exception as e:
                _logger.warning('Cron DISC fallito su partner %s: %s', pid, e)
        _logger.info('Cron DISC: %s profili rigenerati', count)
        return count
