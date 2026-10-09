# pylint: disable=import-error
"""Aggregazione eventi timeline progetto (C-email-project-1).

Helper condiviso tra admin_relation_events_api e consultant_projects_api.
Ritorna lista mista: eventi erpv6.deal.event + email (winwin + project).
Approccio dinamico (B): query email.log al volo, no duplicazione.
"""
import logging

_logger = logging.getLogger(__name__)


# ─── Filtri esclusione email (Q4, C-email-project-1) ───
EMAIL_EXCLUDE_SENDER_PREFIX = (
    'noreply@', 'no-reply@', 'mailer-daemon@', 'postmaster@',
)
EMAIL_EXCLUDE_SENDER_CONTAINS = (
    'notification@', 'notifications@', 'kaizen', 'agent',
)
EMAIL_EXCLUDE_ALIASES = ('noreply', 'no-reply', 'notification')
EMAIL_EXCLUDE_USER_ID = 8  # V6 Auth bot


def email_is_relevant(log):
    """True se l'email va mostrata in timeline."""
    sender = (getattr(log, 'sender_email', '') or '').lower()
    if any(sender.startswith(p) for p in EMAIL_EXCLUDE_SENDER_PREFIX):
        return False
    if any(k in sender for k in EMAIL_EXCLUDE_SENDER_CONTAINS):
        return False
    alias = (getattr(log, 'matched_alias', '') or '').lower()
    if alias in EMAIL_EXCLUDE_ALIASES:
        return False
    rec = getattr(log, 'recipient_user_id', None)
    if rec and rec.id == EMAIL_EXCLUDE_USER_ID:
        return False
    return True


def _is_v6_addr(a):
    a = (a or '').lower()
    return '@v6impresa.it' in a or '@v6sviluppoimpresa.it' in a


def email_to_event_dict(log, source, iso_utc_fn):
    """Normalizza email.log in formato evento timeline.

    iso_utc_fn: funzione (datetime) -> str ISO. Passata dal chiamante
    per non duplicare la logica di APIBaseController._iso_utc.
    """
    sender = getattr(log, 'sender_email', '') or ''
    recipients = getattr(log, 'recipient_emails', '') or ''
    direction = getattr(log, 'direction', '') or ''
    if direction == 'ricevuta':
        counterpart = sender
    else:
        counterpart = recipients.split(',')[0].strip() if recipients else ''
    is_internal = _is_v6_addr(sender) and _is_v6_addr(recipients)
    date = getattr(log, 'create_date', None)
    return {
        'type': 'email',
        'id': 'email-%s-%s' % (source, log.id),
        'emailLogId': log.id,
        'source': source,
        'direction': direction,
        'subject': getattr(log, 'name', '') or '(nessun oggetto)',
        'sender': sender,
        'recipients': recipients,
        'counterpart': counterpart,
        'date': iso_utc_fn(date) if date else None,
        'isInternal': is_internal,
        'eventType': 'email_rilevante',
    }


def event_to_dict_relation(ev, iso_utc_fn):
    """Serializza erpv6.deal.event per timeline progetto."""
    return {
        'id': ev.id,
        'dealId': ev.deal_id.id if ev.deal_id else None,
        'relationId': ev.relation_id.id if ev.relation_id else None,
        'eventType': ev.event_type or '',
        'eventDate': iso_utc_fn(ev.event_date) if ev.event_date else None,
        'title': ev.title or '',
        'description': ev.description or '',
        'visibility': ev.visibility or 'consultant',
        'isAuto': bool(ev.is_auto),
        'createdBy': ev.created_by_id.name if ev.created_by_id else '',
        'createdAt': iso_utc_fn(ev.create_date) if ev.create_date else None,
        'attendees': [
            {'id': a.id, 'name': a.name or '', 'email': a.email or ''}
            for a in ev.attendees
        ],
        'sourceUrl': ev.source_url or '',
        'changesApplied': ev.changes_applied or {},
    }


def build_relation_events(env, relation, iso_utc_fn):
    """Ritorna lista eventi+email per una relation, sort desc per data.

    env: request.env (o env_su)
    relation: record erpv6.tracking.relation
    iso_utc_fn: funzione di formattazione ISO (da APIBaseController)
    """
    Event = env['erpv6.deal.event'].sudo()
    events = Event.search(
        [('relation_id', '=', relation.id)],
        order='event_date desc, id desc',
    )
    event_dicts = [event_to_dict_relation(e, iso_utc_fn) for e in events]

    email_dicts = []
    for model, source in (
        ('erpv6.winwin.email.log', 'winwin'),
        ('erpv6.project.email.log', 'project'),
    ):
        if model not in env:
            continue
        Log = env[model].sudo()
        logs = Log.search(
            [('relation_id', '=', relation.id)],
            order='create_date desc',
        )
        for log in logs:
            if not email_is_relevant(log):
                continue
            email_dicts.append(email_to_event_dict(log, source, iso_utc_fn))

    all_events = event_dicts + email_dicts
    all_events.sort(
        key=lambda x: x.get('eventDate') or x.get('date') or '',
        reverse=True,
    )
    return all_events, event_dicts, email_dicts
