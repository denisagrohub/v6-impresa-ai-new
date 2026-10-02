# pylint: disable=import-error
"""Motore di match generico (6 tipi).

Esegue un match su un modello usando i parametri della regola
(erpv6.suggestion.rule). Ritorna lista di dict pronti per la creazione
di suggestion.

Ogni dict contiene:
  source_model, source_id, user_id
  + chiavi per il title_template ({deal_name}, {days_stale}, ...)
"""
import ast
import logging
from datetime import datetime, timedelta

from odoo import fields

_logger = logging.getLogger(__name__)

NON_HUMANS = {1, 4, 8}  # OdooBot, Public, V6impresaAPI


def _days_since(dt):
    if not dt:
        return 9999
    if isinstance(dt, str):
        dt = datetime.fromisoformat(dt.replace(' ', 'T'))
    return (datetime.now() - dt).days


def _parse_domain(txt):
    if not txt or not txt.strip():
        return []
    try:
        d = ast.literal_eval(txt)
        return d if isinstance(d, list) else []
    except Exception as e:
        _logger.warning('domain non parsabile: %s — %s', txt, e)
        return []


def _csv_set(txt):
    if not txt:
        return set()
    return {x.strip() for x in txt.split(',') if x.strip()}


def _resolve_user(env, record, resolver_path):
    """Segue un percorso tipo 'relation_id.owner_user_id' sul record."""
    if not resolver_path:
        resolver_path = 'relation_id.owner_user_id'
    obj = record
    for part in resolver_path.split('.'):
        obj = getattr(obj, part, None)
        if not obj:
            return None
    # obj è res.users?
    if hasattr(obj, '_name') and obj._name == 'res.users':
        return obj.id if obj.id not in NON_HUMANS else None
    return None


def _build_context(record, model):
    """Estrae chiavi standard dal record per il template."""
    ctx = {
        'source_model': model,
        'source_id': record.id,
    }
    # nome / titolo generico
    for f in ('name', 'title', 'subject'):
        if f in record._fields and getattr(record, f, None):
            ctx['name'] = getattr(record, f)
            break
    # date
    for f in ('create_date', 'write_date'):
        if f in record._fields and getattr(record, f, None):
            ctx['days_since_create'] = _days_since(record.create_date) \
                if f == 'create_date' else ctx.get('days_since_create', 0)
            ctx['days_since_write'] = _days_since(record.write_date) \
                if f == 'write_date' else ctx.get('days_since_write', 0)
    return ctx


# ═══════════════════════════════════════════════════════════════════
# MATCHER
# ═══════════════════════════════════════════════════════════════════

def match_entity_stale(env, rule):
    """Entità in stato X da più di N giorni (basato su stale_field)."""
    out = []
    Model = env[rule.target_model].sudo()
    domain = _parse_domain(rule.filter_domain)
    states = _csv_set(rule.stale_states)
    if states:
        domain.append(('state', 'in', list(states)))
    for rec in Model.search(domain, limit=50):
        ref = getattr(rec, rule.stale_field or 'write_date', None)
        days = _days_since(ref)
        if days <= rule.stale_days:
            continue
        uid = _resolve_user(env, rec, rule.user_resolver)
        if not uid:
            continue
        ctx = _build_context(rec, rule.target_model)
        ctx.update({
            'user_id': uid,
            'days_stale': days,
            'days_open': _days_since(rec.create_date),
            'days_frozen': days,
        })
        # deal_id / relation_id se applicabili
        if 'deal_id' in rec._fields:
            ctx['deal_id'] = rec.deal_id.id if rec.deal_id else None
        if 'relation_id' in rec._fields and rec.relation_id:
            ctx['relation_id'] = rec.relation_id.id
        elif hasattr(rec, '_name') and rec._name == 'erpv6.tracking.relation':
            ctx['relation_id'] = rec.id
        out.append(ctx)
    return out


def match_entity_no_events(env, rule):
    """Entità senza deal.event recenti (ultimo < N giorni)."""
    out = []
    Model = env[rule.target_model].sudo()
    domain = _parse_domain(rule.filter_domain)
    for rec in Model.search(domain, limit=50):
        # risolvi gli id correlati su cui cercare eventi
        rel_ids = []
        if hasattr(rec, '_name'):
            if rec._name == 'erpv6.deal':
                if rec.relation_id:
                    rel_ids.append(rec.relation_id.id)
            elif rec._name == 'erpv6.tracking.relation':
                rel_ids.append(rec.id)
                # includi figli (child_ids)
                rel_ids += rec.child_ids.ids

        if rel_ids:
            last_ev = env['erpv6.deal.event'].sudo().search([
                ('relation_id', 'in', rel_ids),
            ], order='create_date desc', limit=1)
        else:
            last_ev = None
        ref = last_ev.create_date if last_ev else rec.create_date
        days = _days_since(ref)
        if days <= rule.stale_days:
            continue
        uid = _resolve_user(env, rec, rule.user_resolver)
        if not uid:
            continue
        ctx = _build_context(rec, rule.target_model)
        ctx.update({
            'user_id': uid,
            'days_stale': days,
            'days_silent': days,
        })
        if hasattr(rec, '_name') and rec._name == 'erpv6.tracking.relation':
            ctx['relation_id'] = rec.id
            ctx['project_name'] = rec.name
        if 'deal_id' in rec._fields or (hasattr(rec, '_name') and rec._name == 'erpv6.deal'):
            ctx['deal_id'] = rec.id
            ctx['deal_name'] = rec.name
            if rec.relation_id:
                ctx['relation_id'] = rec.relation_id.id
        out.append(ctx)
    return out


def match_entity_missing_field(env, rule):
    """Entità senza campo valorizzato (es. next_step_id)."""
    out = []
    Model = env[rule.target_model].sudo()
    domain = _parse_domain(rule.filter_domain)
    field = rule.watch_field
    if not field:
        return out
    # esclude il campo se non esiste
    for rec in Model.search(domain, limit=50):
        if field not in rec._fields:
            continue
        if getattr(rec, field, None):
            continue
        uid = _resolve_user(env, rec, rule.user_resolver)
        if not uid:
            continue
        ctx = _build_context(rec, rule.target_model)
        ctx['user_id'] = uid
        if 'deal_id' in rec._fields or rec._name == 'erpv6.deal':
            ctx['deal_id'] = rec.id
            ctx['deal_name'] = rec.name
        if 'relation_id' in rec._fields and rec.relation_id:
            ctx['relation_id'] = rec.relation_id.id
        out.append(ctx)
    return out


def match_sign_pending(env, rule):
    """Firma in stato X da più di N giorni (sent_at/viewed_at)."""
    out = []
    Sign = env['erpv6.sign.request'].sudo()
    states = _csv_set(rule.sign_states) or {'sent', 'viewed'}
    date_field = rule.sign_date_field or 'sent_at'
    Signs = Sign.search([('status', 'in', list(states))], limit=100)
    for s in Signs:
        ref = getattr(s, date_field, None) or s.sent_at
        days = _days_since(ref)
        if days <= rule.stale_days:
            continue
        uid = None
        if s.split_project_id:
            uid = _resolve_user(env, s.split_project_id, rule.user_resolver)
        if not uid:
            continue
        out.append({
            'source_model': 'erpv6.sign.request',
            'source_id': s.id,
            'user_id': uid,
            'relation_id': s.split_project_id.id if s.split_project_id else None,
            'sign_name': s.name or '',
            'counterpart': s.partner_id.name if s.partner_id else '—',
            'days_pending': days,
            'days_viewed': days,
        })
    return out


def match_email_unread(env, rule):
    """Email di progetto non letta da più di N giorni."""
    out = []
    if 'erpv6.email.read.state' not in env:
        return out
    cutoff = fields.Datetime.now() - timedelta(days=rule.stale_days)
    Emails = env['erpv6.project.email.log'].sudo().search([
        ('direction', '=', 'ricevuta'),
        ('create_date', '<', cutoff),
        ('relation_id', '!=', False),
    ], limit=100)
    for e in Emails:
        uid = _resolve_user(env, e.relation_id, rule.user_resolver)
        if not uid:
            continue
        read = env['erpv6.email.read.state'].sudo().search([
            ('project_email_id', '=', e.id),
            ('user_id', '=', uid),
        ], limit=1)
        if read:
            continue
        out.append({
            'source_model': 'erpv6.project.email.log',
            'source_id': e.id,
            'user_id': uid,
            'relation_id': e.relation_id.id,
            'email_subject': (e.name or '(nessun oggetto)')[:60],
            'sender': (e.sender_email or '—')[:40],
            'days_unread': _days_since(e.create_date),
        })
    return out


def match_event_debrief_missing(env, rule):
    """Evento tavolo/call senza debrief dopo N ore."""
    out = []
    if 'erpv6.deal.event' not in env:
        return out
    cutoff = fields.Datetime.now() - timedelta(hours=rule.debrief_hours)
    types = _csv_set(rule.event_types) or {'tavolo_incontro', 'call'}
    Events = env['erpv6.deal.event'].sudo().search([
        ('event_type', 'in', list(types)),
        ('create_date', '<', cutoff),
    ], order='create_date desc', limit=50)
    for ev in Events:
        # debrief = figlio
        child = env['erpv6.deal.event'].sudo().search([
            ('parent_event_id', '=', ev.id),
        ], limit=1)
        if child:
            continue
        if ev.description and len(ev.description.strip()) > 50:
            continue
        uid = None
        if ev.deal_id:
            uid = _resolve_user(env, ev.deal_id.relation_id, rule.user_resolver)
        if not uid and ev.relation_id:
            uid = _resolve_user(env, ev.relation_id, rule.user_resolver)
        if not uid:
            continue
        out.append({
            'source_model': 'erpv6.deal.event',
            'source_id': ev.id,
            'user_id': uid,
            'deal_id': ev.deal_id.id if ev.deal_id else None,
            'relation_id': ev.relation_id.id if ev.relation_id else None,
            'event_title': (ev.title or '')[:60],
            'event_date': ev.create_date.strftime('%d/%m'),
            'days_late': _days_since(ev.create_date),
        })
    return out


MATCHERS = {
    'entity_stale': match_entity_stale,
    'entity_no_events': match_entity_no_events,
    'entity_missing_field': match_entity_missing_field,
    'sign_pending': match_sign_pending,
    'email_unread': match_email_unread,
    'event_debrief_missing': match_event_debrief_missing,
}


def run_rule(env, rule):
    """Esegue una regola e ritorna la lista di match."""
    matcher = MATCHERS.get(rule.matcher_type)
    if not matcher:
        _logger.warning('Matcher sconosciuto: %s', rule.matcher_type)
        return []
    return matcher(env, rule)
