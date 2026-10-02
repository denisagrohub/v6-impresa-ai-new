# pylint: disable=import-error
"""Modello erpv6.suggestion — suggerimenti automatici per utente.

02/10/2026 (C1b-1): ogni suggestion nasce da una regola (rules.py) e
vive max 5/giorno/utente. Ciclo di vita breve:
  new → shown → accepted | ignored | expired

NON è una "proposta agente" (erpv6.agent.proposal): quella ha un ciclo
lungo e innesca la catena verso Claudio. Qui è azione suggerita
effimera, per-utente.
"""
import logging

from odoo import _, api, fields, models
from odoo.exceptions import UserError

from . import matcher_engine

_logger = logging.getLogger(__name__)

DAILY_CAP = 5
EXPIRE_DAYS = 3


class Erpv6Suggestion(models.Model):
    _name = 'erpv6.suggestion'
    _description = 'Suggerimento automatico per utente'
    _order = 'priority desc, create_date desc'

    user_id = fields.Many2one(
        'res.users', string='Utente', required=True,
        index=True, ondelete='cascade',
        default=lambda self: self.env.user,
    )
    rule_code = fields.Char(string='Regola', required=True, index=True)
    source_model = fields.Char(string='Modello sorgente', required=True)
    source_id = fields.Integer(string='ID sorgente', required=True)
    relation_id = fields.Many2one(
        'erpv6.tracking.relation', string='Progetto',
        index=True, ondelete='cascade',
    )
    deal_id = fields.Many2one(
        'erpv6.deal', string='Deal', index=True, ondelete='cascade',
    )
    title = fields.Char(string='Titolo', required=True)
    body = fields.Text(string='Testo')
    priority = fields.Selection([
        ('low', 'Bassa'),
        ('normal', 'Normale'),
        ('high', 'Alta'),
    ], string='Priorità', default='normal', required=True)
    state = fields.Selection([
        ('new', 'Nuovo'),
        ('shown', 'Mostrato'),
        ('accepted', 'Accettato'),
        ('ignored', 'Ignorato'),
        ('expired', 'Scaduto'),
    ], string='Stato', default='new', required=True, index=True)
    shown_at = fields.Datetime(string='Mostrato il')
    decided_at = fields.Datetime(string='Deciso il')
    ignore_count = fields.Integer(string='Volte ignorato', default=0)

    _sql_constraints = [
        ('rule_source_user_uniq',
         'unique(rule_code, source_model, source_id, user_id)',
         'Un utente può avere una sola suggestion per (regola, record).'),
    ]

    # ═══════════════════════════════════════════════════════════════
    # SCANSIONE + GENERAZIONE
    # ═══════════════════════════════════════════════════════════════
    @api.model
    def _scan_and_generate(self, user_id=None):
        """Esegue tutte le regole attive, crea le suggestion mancanti.

        :param user_id: se specificato, scansiona solo per quell'utente
                        (utile per test). Altrimenti per tutti.
        :return: numero di suggestion create
        """
        # 02/10/2026 (refactor): regole da DB (erpv6.suggestion.rule)
        # invece di hardcoded in rules.py
        created = 0
        Rule = self.env['erpv6.suggestion.rule'].sudo()
        for rule in Rule._get_active_rules():
            try:
                matches = matcher_engine.run_rule(self.env, rule)
            except Exception:
                _logger.exception(
                    'Regola %s fallita nella scansione', rule.code)
                continue

            for match in matches:
                try:
                    created += self._create_from_match(rule, match, user_id)
                except Exception:
                    _logger.exception(
                        'Creazione suggestion fallita per %s su %s',
                        rule.code, match.get('source_id'))
        _logger.info('Suggestion: create %s nuove', created)
        return created

    @api.model
    def _create_from_match(self, rule, match, filter_user_id=None):
        """Crea una suggestion da un match di regola, se manca.

        Ritorna 1 se creata, 0 se già esistente o skip per cap.
        """
        user_id = match.get('user_id')
        if not user_id:
            return 0
        if filter_user_id and user_id != filter_user_id:
            return 0

        source_model = match['source_model']
        source_id = match['source_id']

        existing = self.search([
            ('rule_code', '=', rule.code),
            ('source_model', '=', source_model),
            ('source_id', '=', source_id),
            ('user_id', '=', user_id),
            ('state', '!=', 'expired'),
        ], limit=1)
        if existing:
            return 0

        today_start = fields.Datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        today_count = self.search_count([
            ('user_id', '=', user_id),
            ('create_date', '>=', today_start),
            ('state', 'in', ('new', 'shown')),
        ])
        if today_count >= DAILY_CAP:
            return 0

        body = self._generate_body(rule, match)
        try:
            title = rule.title_template.format(**match)
        except KeyError as e:
            _logger.warning('title_template %s: chiave mancante %s', rule.code, e)
            title = rule.title_template

        vals = {
            'user_id': user_id,
            'rule_code': rule.code,
            'source_model': source_model,
            'source_id': source_id,
            'relation_id': match.get('relation_id'),
            'deal_id': match.get('deal_id'),
            'title': title,
            'body': body,
            'priority': rule.priority,
        }
        self.create(vals)
        return 1

    @api.model
    def _generate_body(self, rule, match):
        """Genera il testo utente via execute_ai_task.

        Se il bridge fallisce, ritorna il fallback testuale della regola.
        """
        try:
            fallback = rule.body_fallback.format(**match) if rule.body_fallback else ''
        except (KeyError, IndexError):
            fallback = rule.body_fallback or ''
        try:
            if 'erpv6.omni.bridge' not in self.env:
                return fallback
            bridge = self.env['erpv6.omni.bridge'].sudo()
            extra = ('\nIstruzioni: ' + rule.prompt_hint) if rule.prompt_hint else ''
            payload = {
                'messages': [
                    {'role': 'system', 'content': (
                        'Sei un assistente operativo per V6 Impresa. '
                        'Genera UN suggerimento di 1-2 frasi per un consulente. '
                        'Tono asciutto, no emoji, no "Caro", no formalità. '
                        'Concreto: cosa fare + perché (numero giorni, stato). '
                        'Non inventare nomi o numeri. Massimo 40 parole.'
                        + extra
                    )},
                    {'role': 'user', 'content': (
                        'Regola: {rule}\nContesto: {ctx}\n'
                        'Scrivi il suggerimento in italiano.'
                    ).format(
                        rule=rule.code,
                        ctx=', '.join(
                            f'{k}={v}' for k, v in match.items()
                            if k not in ('user_id', 'source_model', 'source_id')
                        ),
                    )},
                ],
                'model': 'gpt-4-turbo',
                'temperature': 0.3,
            }
            resp = bridge.execute_ai_task(
                'suggestion_text', payload=payload,
                context={'rule': rule.code},
            )
            if isinstance(resp, dict) and resp.get('success'):
                # 02/10/2026: il bridge ritorna {success, data:{choices:[
                #   {message:{content:...}}]}, provider_used, cost_usd, ...}
                text = ''
                try:
                    choices = (resp.get('data') or {}).get('choices') or []
                    if choices:
                        text = (choices[0].get('message') or {}).get('content') or ''
                except Exception:
                    text = ''
                # fallback legacy se un giorno il bridge cambia formato
                if not text:
                    text = (resp.get('content') or resp.get('text') or '')
                text = (text or '').strip()
                if text:
                    return text
                _logger.info('AI text vuoto per %s, uso fallback', rule.code)
        except Exception as e:
            _logger.warning('AI text fallito (%s): %s', rule.code, e)
        return fallback

    # ═══════════════════════════════════════════════════════════════
    # AZIONI UTENTE
    # ═══════════════════════════════════════════════════════════════
    def action_show(self):
        self.filtered(lambda s: s.state == 'new').write({
            'state': 'shown',
            'shown_at': fields.Datetime.now(),
        })

    def action_accept(self):
        self.write({
            'state': 'accepted',
            'decided_at': fields.Datetime.now(),
        })

    def action_ignore(self):
        for s in self:
            s.write({
                'state': 'ignored',
                'decided_at': fields.Datetime.now(),
                'ignore_count': s.ignore_count + 1,
            })

    @api.model
    def _expire_old(self):
        """Marca come expired le suggestion new/shown più vecchie di N giorni."""
        from datetime import timedelta
        cutoff = fields.Datetime.now() - timedelta(days=EXPIRE_DAYS)
        old = self.search([
            ('state', 'in', ('new', 'shown')),
            ('create_date', '<', cutoff),
        ])
        old.write({'state': 'expired', 'decided_at': fields.Datetime.now()})
        return len(old)
