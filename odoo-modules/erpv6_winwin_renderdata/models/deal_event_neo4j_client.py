# pylint: disable=import-error
"""Client Neo4j per erpv6.deal.event — sync timeline al grafo.

30/09/2026 (F1 S4): ogni evento della timeline deal viene MERGE-ato nel
grafo Neo4j come nodo, con archi verso:
- (Persona) -[PARTECIPA_A]-> (Deal_Event)  ← attendees
- (Deal_Event) -[RIGUARDA]-> (Deal)         ← sempre
- (Deal_Event) -[HA_CAMBIATO {field,from,to}]-> (Deal) ← changes_applied

RIUSO: stessi ir.config_parameter del client erpv6_kaizen.neo4j.client
(erpv6_kaizen.neo4j_uri / _user / _password) — così la config è unica
per DB, nessun doppio posto dove mettere le credenziali.
Il driver Python 'neo4j' è importato in modo lazy: se non installato,
l'intero sync è no-op (best effort, non blocca mai l'utente).

NON importa erpv6_kaizen (nessuna dipendenza tra moduli): duplica solo
il pattern di connessione (25 righe), non la logica di business.
"""
import logging

from odoo import _, models
from odoo.exceptions import UserError

_logger = logging.getLogger(__name__)


NEO4J_URI_PARAM = 'erpv6_kaizen.neo4j_uri'
NEO4J_USER_PARAM = 'erpv6_kaizen.neo4j_user'
NEO4J_PASSWORD_PARAM = 'erpv6_kaizen.neo4j_password'

DEAL_EVENT_LABEL = 'Deal_Event'
PERSON_LABEL = 'Persona'
DEAL_LABEL = 'Deal'


class Erpv6DealEventNeo4jClient(models.AbstractModel):
    _name = 'erpv6.deal.event.neo4j.client'
    _description = 'Client Neo4j per deal.event'

    def _get_driver(self):
        try:
            from neo4j import GraphDatabase
        except ImportError:
            return None  # silenzioso: best effort

        icp = self.env['ir.config_parameter'].sudo()
        uri = icp.get_param(NEO4J_URI_PARAM)
        user = icp.get_param(NEO4J_USER_PARAM)
        password = icp.get_param(NEO4J_PASSWORD_PARAM)
        if not (uri and user and password):
            return None

        try:
            return GraphDatabase.driver(uri, auth=(user, password))
        except Exception as e:
            _logger.warning('Neo4j deal.event: connessione fallita: %s', e)
            return None

    def sync_event(self, event):
        """MERGE-а il nodo Deal_Event + archi. Best effort, no raise.

        Ritorna True se sincronizzato, False se skip (driver assente o
        Neo4j non configurato).
        """
        self.ensure_one()
        driver = self._get_driver()
        if not driver:
            return False

        try:
            with driver.session() as session:
                # 1. Nodo Deal_Event
                session.run(
                    f"MERGE (e:{DEAL_EVENT_LABEL} {{id: $id}}) "
                    f"SET e.event_type = $event_type, "
                    f"    e.title = $title, "
                    f"    e.event_date = $event_date, "
                    f"    e.visibility = $visibility, "
                    f"    e.deal_id = $deal_id",
                    id=f"deal_event:{event.id}",
                    event_type=event.event_type or '',
                    title=event.title or '',
                    event_date=event.event_date.isoformat() if event.event_date else '',
                    visibility=event.visibility or 'consultant',
                    deal_id=event.deal_id.id if event.deal_id else None,
                )

                # 2. Arco verso Deal
                if event.deal_id:
                    session.run(
                        f"MERGE (d:{DEAL_LABEL} {{id: $deal_id}}) "
                        f"SET d.name = $deal_name, d.state = $deal_state",
                        deal_id=f"deal:{event.deal_id.id}",
                        deal_name=event.deal_id.name or '',
                        deal_state=event.deal_id.state or '',
                    )
                    session.run(
                        f"MATCH (e:{DEAL_EVENT_LABEL} {{id: $eid}}), (d:{DEAL_LABEL} {{id: $did}}) "
                        f"MERGE (e)-[:RIGUARDA]->(d)",
                        eid=f"deal_event:{event.id}",
                        did=f"deal:{event.deal_id.id}",
                    )

                # 3. Archi verso Persone (attendees)
                for att in event.attendees:
                    session.run(
                        f"MERGE (p:{PERSON_LABEL} {{id: $pid}}) "
                        f"SET p.name = $name",
                        pid=f"partner:{att.id}",
                        name=att.name or '',
                    )
                    session.run(
                        f"MATCH (e:{DEAL_EVENT_LABEL} {{id: $eid}}), (p:{PERSON_LABEL} {{id: $pid}}) "
                        f"MERGE (p)-[:PARTECIPA_A]->(e)",
                        eid=f"deal_event:{event.id}",
                        pid=f"partner:{att.id}",
                    )

                # 4. Archi di cambiamento (da changes_applied)
                changes = event.changes_applied or {}
                if isinstance(changes, dict) and event.deal_id:
                    for field_name, change in changes.items():
                        from_v = change.get('from') if isinstance(change, dict) else None
                        to_v = change.get('to') if isinstance(change, dict) else change
                        session.run(
                            f"MATCH (e:{DEAL_EVENT_LABEL} {{id: $eid}}), (d:{DEAL_LABEL} {{id: $did}}) "
                            f"MERGE (e)-[r:HA_CAMBIATO {{field: $field}}]->(d) "
                            f"SET r.from_value = $from_v, r.to_value = $to_v",
                            eid=f"deal_event:{event.id}",
                            did=f"deal:{event.deal_id.id}",
                            field=field_name,
                            from_v=str(from_v) if from_v is not None else '',
                            to_v=str(to_v) if to_v is not None else '',
                        )

            return True
        except Exception as e:
            _logger.warning('Neo4j sync deal.event %s fallito: %s', event.id, e)
            return False
        finally:
            try:
                driver.close()
            except Exception:
                pass
