import logging

from odoo import _, models
from odoo.exceptions import UserError

_logger = logging.getLogger(__name__)

# STESSI ir.config_parameter di erpv6.kaizen.neo4j.client (odoo-modules/
# erpv6_kaizen/models/kaizen_neo4j_client.py) - config globale al DB, nessun
# problema di dipendenza a rileggerli qui. Client separato (non un import
# diretto di quello di erpv6_kaizen) perche' erpv6_kaizen DIPENDE da
# erpv6_agent, non il contrario (vedi manifest) - erpv6_agent non puo'
# dipendere da erpv6_kaizen senza creare un ciclo. Se in futuro si vuole un
# unico client davvero condiviso, andrebbe spostato qui (erpv6_agent, piu'
# generico) e kaizen_neo4j_client.py riscritto per usare questo - non fatto
# ora per non toccare codice Kaizen gia' funzionante senza necessita' reale.
NEO4J_URI_PARAM = 'erpv6_kaizen.neo4j_uri'
NEO4J_USER_PARAM = 'erpv6_kaizen.neo4j_user'
NEO4J_PASSWORD_PARAM = 'erpv6_kaizen.neo4j_password'

# Prefisso "Agent_" deciso il 24/08/2026 (riconciliazione del piano
# Claudio+Argus con l'architettura esistente: niente tabella SQL parallela
# erpv6.tracking.relation per gli "archi di collegamento", si scrive nello
# stesso grafo Neo4j gia' in uso per Code_*/Kb_*).
PROPOSAL_LABEL = 'Agent_Proposal'
REPORT_LABEL = 'Agent_Report'
PATTERN_LABEL = 'Agent_Pattern'
CHAIN_REL = 'SEGUE_DA'
DOCUMENTA_REL = 'DOCUMENTA'
STESSO_PATTERN_REL = 'STESSO_PATTERN_DI'


class Erpv6AgentNeo4jClient(models.AbstractModel):
    """Motore di scrittura Neo4j per gli archi concettuali degli agenti
    (proposta -> relazione tecnica, proposta -> proposta precedente nella
    catena, segnale -> pattern trovato altrove) - stesso pattern di
    connessione/MERGE idempotente di erpv6.kaizen.neo4j.client, vedi
    docstring li' per i dettagli sull'installazione del driver 'neo4j' nel
    container Odoo."""
    _name = 'erpv6.agent.neo4j.client'
    _description = 'Client Neo4j condiviso per gli archi concettuali degli agenti'

    def _get_driver(self):
        try:
            from neo4j import GraphDatabase
        except ImportError as e:
            raise UserError(_(
                "Driver Python 'neo4j' non disponibile in questo ambiente. Vedi docstring di "
                "erpv6.kaizen.neo4j.client per come installarlo (pip --user nel container Odoo)."
            )) from e
        icp = self.env['ir.config_parameter'].sudo()
        uri = icp.get_param(NEO4J_URI_PARAM)
        user = icp.get_param(NEO4J_USER_PARAM)
        password = icp.get_param(NEO4J_PASSWORD_PARAM)
        if not (uri and user and password):
            raise UserError(_(
                "Configurazione Neo4j incompleta (ir.config_parameter %s / %s / %s) -- impostarla "
                "prima di usare questo client, mai inventare un default per la password."
            ) % (NEO4J_URI_PARAM, NEO4J_USER_PARAM, NEO4J_PASSWORD_PARAM))
        return GraphDatabase.driver(uri, auth=(user, password))

    def write_proposal_node(self, proposal_id, agent_code, title, status, parent_proposal_id=None,
                             technical_report_document_id=None):
        """MERGE del nodo Agent_Proposal per una erpv6.agent.proposal, con
        arco SEGUE_DA verso la proposta precedente nella catena (Kaizen ->
        Claudio -> Argus) se presente, e arco DOCUMENTA verso un
        Agent_Report se questa proposta ha un technical_report_id
        collegato. Mai inventa nodi che non esistono: se parent_proposal_id
        e' passato ma quel nodo non e' mai stato scritto, l'arco non si crea
        e il valore di ritorno lo segnala."""
        node_id = "proposal:%d" % proposal_id
        driver = self._get_driver()
        try:
            with driver.session() as session:
                session.run(
                    "MERGE (n:%s {id: $node_id}) "
                    "SET n.proposal_id = $proposal_id, n.agent_code = $agent_code, "
                    "n.title = $title, n.status = $status" % PROPOSAL_LABEL,
                    node_id=node_id, proposal_id=proposal_id, agent_code=agent_code,
                    title=title, status=status,
                )
                parent_linked = False
                if parent_proposal_id:
                    parent_node_id = "proposal:%d" % parent_proposal_id
                    found = session.run(
                        "MATCH (p:%s {id: $parent_id}) RETURN count(p) AS n" % PROPOSAL_LABEL,
                        parent_id=parent_node_id,
                    ).single()['n']
                    if found:
                        session.run(
                            "MATCH (n:%s {id: $node_id}) MATCH (p:%s {id: $parent_id}) "
                            "MERGE (n)-[:%s]->(p)" % (PROPOSAL_LABEL, PROPOSAL_LABEL, CHAIN_REL),
                            node_id=node_id, parent_id=parent_node_id,
                        )
                        parent_linked = True
                report_linked = False
                if technical_report_document_id:
                    report_node_id = "report:%d" % technical_report_document_id
                    session.run(
                        "MERGE (r:%s {id: $report_id}) SET r.document_id = $doc_id" % REPORT_LABEL,
                        report_id=report_node_id, doc_id=technical_report_document_id,
                    )
                    session.run(
                        "MATCH (n:%s {id: $node_id}) MATCH (r:%s {id: $report_id}) "
                        "MERGE (n)-[:%s]->(r)" % (PROPOSAL_LABEL, REPORT_LABEL, DOCUMENTA_REL),
                        node_id=node_id, report_id=report_node_id,
                    )
                    report_linked = True
                return {'node_id': node_id, 'parent_linked': parent_linked, 'report_linked': report_linked}
        finally:
            driver.close()

    def write_pattern_occurrence(self, pattern_key, description, res_model, res_id):
        """MERGE di un nodo Agent_Pattern (una occorrenza dello stesso
        problema/pattern trovata da Argus altrove nel repo) con un arco
        STESSO_PATTERN_DI verso le altre occorrenze gia' note dello stesso
        pattern_key - permette a Kaizen/Denis di vedere quante volte un
        pattern e' gia' ricorso senza dover rileggere ogni segnale."""
        node_id = "pattern:%s:%s:%s" % (pattern_key, res_model, res_id)
        driver = self._get_driver()
        try:
            with driver.session() as session:
                session.run(
                    "MERGE (n:%s {id: $node_id}) "
                    "SET n.pattern_key = $pattern_key, n.description = $description, "
                    "n.res_model = $res_model, n.res_id = $res_id" % PATTERN_LABEL,
                    node_id=node_id, pattern_key=pattern_key, description=description,
                    res_model=res_model, res_id=res_id,
                )
                session.run(
                    "MATCH (n:%s {id: $node_id}) "
                    "MATCH (other:%s {pattern_key: $pattern_key}) WHERE other.id <> $node_id "
                    "MERGE (n)-[:%s]->(other)" % (PATTERN_LABEL, PATTERN_LABEL, STESSO_PATTERN_REL),
                    node_id=node_id, pattern_key=pattern_key,
                )
                count = session.run(
                    "MATCH (n:%s {pattern_key: $pattern_key}) RETURN count(n) AS n" % PATTERN_LABEL,
                    pattern_key=pattern_key,
                ).single()['n']
                return {'node_id': node_id, 'total_occurrences': count}
        finally:
            driver.close()
