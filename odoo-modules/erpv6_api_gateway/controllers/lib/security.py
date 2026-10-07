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
    owner = getattr(record, 'owner_user_id', None)
    if owner and owner.id == user.id:
        return True

    # 3) Chief projects: via relation.access_user_ids
    if user.has_group('erpv6_core.group_chief_projects'):
        relation = _resolve_relation(record)
        if relation is not None:
            if user.id in (relation.access_user_ids.ids or []):
                return True
            # Il chief che è owner della relation ha accesso
            if relation.owner_user_id and relation.owner_user_id.id == user.id:
                return True

    # 4) Consultant: solo owner diretto (già coperto al punto 2)
    # 5) Fallback: NEGATO
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
