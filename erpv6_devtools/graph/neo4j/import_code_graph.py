#!/usr/bin/env python3
"""Import del grafo codice (Fase 1A) in Neo4j Community Edition.

Legge erpv6_devtools/graph/orm_graph_2026-08-21.json (853 nodi, 4765 archi,
gia' estratto ed esistente -- questo script NON estrae nulla di nuovo, solo
importa) e lo carica nell'istanza Neo4j locale (container erpv6_kg_neo4j,
127.0.0.1:7687) usando la convenzione di naming decisa in
docs/PLAN_knowledge_graph_phase1.md sezione 1D (Opzione A: un solo database,
namespace via prefisso label "Code_" -- riservato a "Kb_" per un futuro
grafo business, oggi non ancora esistente e NON toccato da questo script).

Label nodi:
    kind == "module" -> Code_Modulo
    kind == "model"  -> Code_Modello

Tipi arco:
    type == "depends_on" -> :DEPENDS_ON  (modulo -> modulo, 1 arco per coppia)
    type == "relates_to" -> :RELATES_TO  (modello -> modello, PIU' archi per
        coppia sono possibili quando due modelli sono collegati da piu' campi
        ORM diversi -- verificato sui dati reali: 963 coppie su 2999 hanno
        piu' di un arco relates_to, es. account.account -> res.currency via
        sia "company_currency_id" sia "currency_id". Per questo la chiave di
        MERGE della relazione include via_field, non solo (source, target) --
        altrimenti un rerun idempotente collasserebbe silenziosamente questi
        archi distinti in uno solo, perdendo dati reali.)

Idempotenza: tutto MERGE (mai CREATE), rieseguire lo script non deve
duplicare nulla -- verificato in questo stesso task eseguendo l'import due
volte e confrontando i conteggi.

Password: letta SOLO da erpv6_devtools/graph/neo4j/.env (locale, gitignored),
mai stampata in output/log.
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

from neo4j import GraphDatabase

HERE = Path(__file__).resolve().parent
ENV_FILE = HERE / ".env"
JSON_FILE = HERE.parent / "orm_graph_2026-08-21.json"

NEO4J_URI = "bolt://127.0.0.1:7687"
NEO4J_USER = "neo4j"

BATCH_SIZE = 500


def load_env_password() -> str:
    if not ENV_FILE.exists():
        sys.exit(f"File .env non trovato: {ENV_FILE}")
    for line in ENV_FILE.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("NEO4J_PASSWORD="):
            value = line.split("=", 1)[1].strip()
            if not value or value == "CHANGE_ME_BEFORE_FIRST_START":
                sys.exit("NEO4J_PASSWORD non impostata correttamente in .env")
            return value
    sys.exit("NEO4J_PASSWORD non trovata in .env")


def load_graph(path: Path) -> dict:
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def label_for_kind(kind: str) -> str:
    if kind == "module":
        return "Code_Modulo"
    if kind == "model":
        return "Code_Modello"
    raise ValueError(f"kind sconosciuto, non nella convenzione 1D: {kind!r}")


def rel_type_for_edge_type(edge_type: str) -> str:
    if edge_type == "depends_on":
        return "DEPENDS_ON"
    if edge_type == "relates_to":
        return "RELATES_TO"
    raise ValueError(f"tipo arco sconosciuto, non nella convenzione 1D: {edge_type!r}")


def chunked(seq, size):
    for i in range(0, len(seq), size):
        yield seq[i : i + size]


def ensure_constraints(session):
    # Constraint di unicita' su id per ciascuna label -- garantisce idempotenza
    # del MERGE nodi e da' un indice per i MATCH usati nella creazione archi.
    session.run(
        "CREATE CONSTRAINT code_modulo_id_unique IF NOT EXISTS "
        "FOR (n:Code_Modulo) REQUIRE n.id IS UNIQUE"
    )
    session.run(
        "CREATE CONSTRAINT code_modello_id_unique IF NOT EXISTS "
        "FOR (n:Code_Modello) REQUIRE n.id IS UNIQUE"
    )


def import_nodes(session, nodes: list[dict]) -> dict:
    counts = {"Code_Modulo": 0, "Code_Modello": 0}
    by_label: dict[str, list[dict]] = {"Code_Modulo": [], "Code_Modello": []}
    for n in nodes:
        label = label_for_kind(n["kind"])
        props = {k: v for k, v in n.items() if k != "kind"}
        by_label[label].append(props)

    for label, rows in by_label.items():
        if not rows:
            continue
        for batch in chunked(rows, BATCH_SIZE):
            session.run(
                f"""
                UNWIND $rows AS row
                MERGE (n:{label} {{id: row.id}})
                SET n += row
                """,
                rows=batch,
            )
        counts[label] = len(rows)
    return counts


def import_edges(session, edges: list[dict]) -> dict:
    depends_on_rows = []
    relates_to_rows = []
    for e in edges:
        if e["type"] == "depends_on":
            depends_on_rows.append(
                {"source": e["source"], "target": e["target"], "type": e["type"]}
            )
        elif e["type"] == "relates_to":
            relates_to_rows.append(
                {
                    "source": e["source"],
                    "target": e["target"],
                    "type": e["type"],
                    "via_field": e.get("via_field"),
                    "field_type": e.get("field_type"),
                }
            )
        else:
            raise ValueError(f"tipo arco sconosciuto: {e['type']!r}")

    for batch in chunked(depends_on_rows, BATCH_SIZE):
        session.run(
            """
            UNWIND $rows AS row
            MATCH (a {id: row.source})
            MATCH (b {id: row.target})
            MERGE (a)-[r:DEPENDS_ON]->(b)
            SET r.type = row.type
            """,
            rows=batch,
        )

    # Chiave di MERGE include via_field: coppie (source,target) con piu'
    # campi ORM distinti devono restare archi distinti (vedi docstring).
    for batch in chunked(relates_to_rows, BATCH_SIZE):
        session.run(
            """
            UNWIND $rows AS row
            MATCH (a {id: row.source})
            MATCH (b {id: row.target})
            MERGE (a)-[r:RELATES_TO {via_field: row.via_field}]->(b)
            SET r.type = row.type, r.field_type = row.field_type
            """,
            rows=batch,
        )

    return {"DEPENDS_ON": len(depends_on_rows), "RELATES_TO": len(relates_to_rows)}


def verify(session) -> None:
    print("\n=== Verifica reale post-import (query Cypher) ===")

    print("\n-- conteggio nodi per label --")
    for rec in session.run(
        "MATCH (n) RETURN labels(n) AS labels, count(n) AS n ORDER BY n DESC"
    ):
        print(f"  {rec['labels']}: {rec['n']}")

    print("\n-- conteggio archi per tipo --")
    for rec in session.run(
        "MATCH ()-[r]->() RETURN type(r) AS rel_type, count(r) AS n ORDER BY n DESC"
    ):
        print(f"  {rec['rel_type']}: {rec['n']}")

    print("\n-- esempio: quali moduli dipendono da erpv6_kb --")
    rows = list(
        session.run(
            """
            MATCH (m:Code_Modulo)-[:DEPENDS_ON]->(t:Code_Modulo {id: 'module:erpv6_kb'})
            RETURN m.id AS modulo ORDER BY modulo
            """
        )
    )
    print(f"  totale: {len(rows)}")
    for r in rows:
        print(f"    {r['modulo']}")

    print("\n-- esempio: quanti modelli ha erpv6_production (owning_module) --")
    rec = session.run(
        """
        MATCH (n:Code_Modello {owning_module: 'erpv6_production'})
        RETURN count(n) AS n
        """
    ).single()
    print(f"  totale modelli: {rec['n']}")


def main():
    password = load_env_password()
    data = load_graph(JSON_FILE)
    nodes = data["nodes"]
    edges = data["edges"]
    print(f"Grafo caricato da file: {len(nodes)} nodi, {len(edges)} archi "
          f"(generated_at={data.get('generated_at')})")

    driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, password))
    try:
        driver.verify_connectivity()
        with driver.session() as session:
            ensure_constraints(session)
            node_counts = import_nodes(session, nodes)
            edge_counts = import_edges(session, edges)
            print("\n=== Import completato ===")
            print("Nodi scritti (MERGE):", node_counts)
            print("Archi scritti (MERGE):", edge_counts)
            verify(session)
    finally:
        driver.close()


if __name__ == "__main__":
    main()
