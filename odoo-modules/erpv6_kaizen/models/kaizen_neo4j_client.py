import logging

from odoo import _, models
from odoo.exceptions import UserError

_logger = logging.getLogger(__name__)

# ir.config_parameter, non i file .env di erpv6_devtools/graph/neo4j/: questo
# codice gira DENTRO il container Odoo, che non monta ~/erpv6-src (solo
# /opt/erpv6/{config,custom-addons,addons,bin/typst} + il volume dati Odoo,
# verificato il 22/08/2026 con `docker inspect odoo`). La password e' stata
# letta UNA VOLTA sola dal .env locale (mai stampata) e scritta qui via
# `env['ir.config_parameter'].sudo().set_param(...)` da odoo shell -- stesso
# livello di protezione (solo sudo/admin) gia' usato per altri segreti simili
# in questo progetto (es. crypto.master_password in erpv6_crypto). Non e'
# stato aggiunto erpv6_crypto come dipendenza solo per cifrare ulteriormente
# questo valore: sarebbe una dipendenza nuova non strettamente necessaria per
# il compito richiesto (vedi vincolo esplicito "promuovi solo erpv6_kaizen ed
# eventuali dipendenze dirette se strettamente necessario").
NEO4J_URI_PARAM = 'erpv6_kaizen.neo4j_uri'
NEO4J_USER_PARAM = 'erpv6_kaizen.neo4j_user'
NEO4J_PASSWORD_PARAM = 'erpv6_kaizen.neo4j_password'

# Convenzione di naming decisa in docs/PLAN_knowledge_graph_phase1.md (1D +
# sezione "Estensione - Motore Kaizen 'copertura grafo'"): layer codice
# (Fase 1A, gia' importato da erpv6_devtools/graph/neo4j/import_code_graph.py)
# usa il prefisso "Code_", layer business/changelog usa "Kb_". Il nodo Fix di
# 1B (Errore/Fix/Modulo) vive quindi come label "Kb_Fix" qui.
FIX_LABEL = 'Kb_Fix'
CODE_MODEL_LABEL = 'Code_Modello'
TOCCA_REL = 'TOCCA'


class Erpv6KaizenNeo4jClient(models.AbstractModel):
    """Motore di interrogazione/scrittura Neo4j CONDIVISO per Kaizen -- primo
    caso d'uso reale per "il motore di interrogazione condiviso" menzionato
    in docs/PLAN_knowledge_graph_phase1.md (sezione "Estensione"). Un solo
    punto che apre il driver e lo chiude sempre, cosi' l'Indicatore 5 di
    Kairos (query reale: quali Fix toccano gia' lo stesso modello/modulo) e
    la scrittura del nodo Fix (Regola 9, standardizzazione) non duplicano la
    stessa gestione connessione in piu' punti.

    Driver `neo4j`: installato SOLO nel volume utente persistente del
    container Odoo (`pip install --user --break-system-packages neo4j==6.2.0`
    dentro il container, 22/08/2026 -- vedi
    docs/PLAN_knowledge_graph_phase1.md sezione 1D per il precedente identico
    gia' seguito per lo script di import da devtools). Il Python di sistema
    del container NON viene toccato (niente --break-system-packages senza
    --user): l'installazione vive in /var/lib/odoo/.local/lib/python3.12/
    site-packages, che e' un VOLUME DOCKER NOMINATO (non il filesystem
    effimero del container), verificato via `docker inspect odoo` --
    sopravvive a restart/recreate del container, si perde solo se quel
    volume viene rimosso esplicitamente (`docker compose down -v`)."""
    _name = 'erpv6.kaizen.neo4j.client'
    _description = 'Client Neo4j condiviso (Kaizen -> grafo di conoscenza)'

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

    def count_fixes_touching_model(self, res_model):
        """Indicatore 5 di Kairos (Regola 11, KB #309): "esperienza pregressa
        nel risolvere problemi simili su questo stack" -- va risposto con una
        QUERY REALE sul grafo (quanti nodi Kb_Fix sono gia' collegati, via
        TOCCA, allo stesso Code_Modello), mai con una supposizione o una
        ricerca testuale. Ritorna un intero (0 se nessuno, mai None: 0 e'
        un'informazione reale, non un dato mancante)."""
        driver = self._get_driver()
        try:
            with driver.session() as session:
                rec = session.run(
                    "MATCH (f:%s)-[:%s]->(m:%s {id: $model_id}) RETURN count(f) AS n" % (
                        FIX_LABEL, TOCCA_REL, CODE_MODEL_LABEL),
                    model_id="model:%s" % res_model,
                ).single()
                return rec['n'] if rec else 0
        finally:
            driver.close()

    def write_fix_node(self, fix_id, sources, descrizione, data, res_model):
        """MERGE (mai CREATE) del nodo Kb_Fix (schema 1B: fix_id composito
        "{source_model}:{record_id}", sources=lista fonti reali, descrizione,
        data) + arco TOCCA verso il Code_Modello ESISTENTE che corrisponde a
        res_model. Se quel nodo codice non esiste nel grafo (mai importato,
        o res_model non corretto), l'arco NON viene creato e il valore di
        ritorno lo segnala esplicitamente -- mai un nodo Code_Modello
        inventato al volo per far quadrare l'arco (stesso principio "mai
        inventare" gia' applicato alla deduplicazione dei nodi Fix in
        docs/PLAN_knowledge_graph_phase1.md sezione 1B)."""
        driver = self._get_driver()
        try:
            with driver.session() as session:
                session.run(
                    "MERGE (n:%s {fix_id: $fix_id}) "
                    "SET n.sources = $sources, n.descrizione = $descrizione, n.data = $data" % FIX_LABEL,
                    fix_id=fix_id, sources=sources, descrizione=descrizione, data=data,
                )
                model_id = "model:%s" % res_model
                found = session.run(
                    "MATCH (m:%s {id: $model_id}) RETURN count(m) AS n" % CODE_MODEL_LABEL,
                    model_id=model_id,
                ).single()['n']
                edge_created = False
                if found:
                    session.run(
                        "MATCH (f:%s {fix_id: $fix_id}) "
                        "MATCH (m:%s {id: $model_id}) "
                        "MERGE (f)-[:%s]->(m)" % (FIX_LABEL, CODE_MODEL_LABEL, TOCCA_REL),
                        fix_id=fix_id, model_id=model_id,
                    )
                    edge_created = True
                else:
                    _logger.warning(
                        "erpv6.kaizen.neo4j.client: nessun nodo %s con id='%s' trovato nel grafo -- "
                        "nodo Fix '%s' scritto, ma SENZA arco TOCCA (mai inventato).",
                        CODE_MODEL_LABEL, model_id, fix_id)
                return {'fix_id': fix_id, 'code_model_found': bool(found), 'edge_created': edge_created,
                        'code_model_id': model_id}
        finally:
            driver.close()
