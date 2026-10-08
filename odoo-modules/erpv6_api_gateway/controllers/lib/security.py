# pylint: disable=import-error
"""Helper record-level authorization (C-security-audit).

Deny-by-default. Non usa ir.rule (che è bypassato da .sudo():
qui il controllo è esplicito a livello di codice).

Regole (gerarchia):
  1. admin (base.group_system) -> accesso totale
  2. owner_user_id == user.id -> accesso totale
  3. chief_projects -> accesso se relation.access_user_ids contiene user
  4. consultant -> accesso SOLO se owner_user_id == user.id
  5. altrimenti NEGATO

Il campo `owner_user_id` deve esistere sul record. Se manca,
log warning e ritorna False (fail-closed).
"""
import logging

_logger = logging.getLogger(__name__)


# Modelli abilitati al check (deny esplicito altrove).
SUPPORTED_MODELS = (
    'erpv6.deal',
    'erpv6.credit.portfolio',
    'erpv6.credit.line',
    'erpv6.tracking.relation',
)


def check_record_access(user, record, mode='read'):
    """Ritorna True se l'utente può accedere al record.

    mode: 'read' | 'write' | 'delete'
    (Per ora: la stessa logica per tutti i mode; in futuro si
    potrebbero differenziare i permessi delete/write.)

    NON logga. Il chiamante deve fare log_access() separatamente.
    """
    if not user or not user.id or not record or not record.id:
        return False

    # 1) Admin
    if user.has_group('base.group_system'):
        return True

    # 2) Owner diretto
    # 2a) owner_user_id (deal, portfolio, credit.line, relation)
    owner = getattr(record, 'owner_user_id', None)
    if owner and owner.id == user.id:
        return True
    # 2b) fallback user_id (calendar.event Organizer - 08/10/2026
    #     C-security-audit-3icd Q1 a+)
    if 'user_id' in record._fields:
        r_user = getattr(record, 'user_id', None)
        if r_user and r_user.id == user.id:
            return True

    # 3) Chief projects: passa SEMPRE (decisione master Q2 07/10/2026).
    #
    # TODO (post-MVP, task separato "team scope"):
    #   Oggi chief = "quasi admin" per continuita' operativa (access_
    #   user_ids vuoto su 22/24 relazioni). In futuro: chief vede solo
    #   i progetti dei propri consulenti (via relation.access_user_ids
    #   o altro criterio di team).
    if user.has_group('erpv6_core.group_chief_projects'):
        return True

    # 4) access_user_ids sul record (se presente) o via relation
    #    (07/10/2026 C-security-audit 3b, decisione master D3):
    #    regola AUTONOMA dal ruolo. Se l'utente e' esplicitamente
    #    in access_user_ids -> accesso garantito.
    if _in_access_user_ids(user, record):
        return True

    # 5) calendar.event: attendee (partner_ids) -> SOLO read
    #    (08/10/2026 C-security-audit-3icd Q2+Q3: chi vede = chi modifica
    #     MA attendee può solo vedere, non modificare.)
    if mode == 'read' and 'partner_ids' in record._fields:
        pids = record.partner_ids.ids or []
        if pids and user.partner_id and user.partner_id.id in pids:
            return True

    # 6) Fallback: NEGATO
    return False


def _in_access_user_ids(user, record):
    """True se user e' in record.access_user_ids, o in
    record.relation_id.access_user_ids (fallback via parent).

    Copre:
      - erpv6.tracking.relation: ha access_user_ids diretto
      - erpv6.deal / erpv6.credit.portfolio: via relation_id
      - erpv6.credit.line: via portfolio_id.relation_id
    """
    # Diretto
    if 'access_user_ids' in record._fields:
        if user.id in (record.access_user_ids.ids or []):
            return True
    # Via relation_id
    if 'relation_id' in record._fields and record.relation_id:
        rel = record.relation_id
        if 'access_user_ids' in rel._fields:
            if user.id in (rel.access_user_ids.ids or []):
                return True
    # credit.line -> portfolio_id.relation_id
    if record._name == 'erpv6.credit.line':
        pf = getattr(record, 'portfolio_id', None)
        if pf and pf.relation_id:
            if user.id in (pf.relation_id.access_user_ids.ids or []):
                return True
    # calendar.event: via deal_id -> deal.owner_user_id / relation
    if 'deal_id' in record._fields and record.deal_id:
        deal = record.deal_id
        if deal.owner_user_id and deal.owner_user_id.id == user.id:
            return True
        if deal.relation_id and user.id in (deal.relation_id.access_user_ids.ids or []):
            return True
    return False


def _resolve_relation(record):
    """Trova l'erpv6.tracking.relation del record (se esiste).

    Ritorna il record relation o None. Multi-path per coprire
    i diversi modelli del perimetro.
    """
    # Campo diretto relation_id
    rel = getattr(record, 'relation_id', None)
    if rel and rel._name == 'erpv6.tracking.relation':
        return rel
    # credit.line -> portfolio_id.relation_id
    if record._name == 'erpv6.credit.line':
        portfolio = getattr(record, 'portfolio_id', None)
        if portfolio and portfolio.relation_id:
            return portfolio.relation_id
    return None
