#!/usr/bin/env python3
"""Contesto minimo per Claudio, preso dal grafo Neo4j invece che da un
elenco fisso di file (24/08/2026, richiesto esplicitamente da Denis: "non
possiamo dare tutto in pasto sempre... dobbiamo usare il grafo per dare in
pasto sempre il minimo e quello che serve, con tutto il raw e il grafo che
abbiamo strutturato apposta per questo").

Dato il testo di una proposta (che di solito menziona un percorso file
odoo-modules/<modulo>/...), interroga DAVVERO il grafo (via HTTP, porta
7474 - niente driver bolt da installare in piu' nel venv di Claudio,
stesso database gia' popolato da erpv6_devtools/graph/neo4j/import_code_graph.py)
per: da quali moduli dipende quel modulo (DEPENDS_ON), e quali modelli
business vivono davvero li' (Code_Modello.owning_module). Ritorna un
blocco di testo breve e mirato, o stringa vuota se il grafo non ha nulla
di utile per quel modulo (mai un errore che blocca il resto - il contesto
minimo e' un aiuto in piu', non un requisito)."""
import json
import os
import re

import requests

NEO4J_HTTP_URL = "http://127.0.0.1:7474/db/neo4j/tx/commit"


def _load_neo4j_password():
    """Stessa fonte di verita' gia' in uso (erpv6_devtools/graph/neo4j/.env,
    mai duplicata in chiaro altrove)."""
    env_file = os.path.join(os.path.dirname(__file__), "..", "graph", "neo4j", ".env")
    env_file = os.path.abspath(env_file)
    if not os.path.exists(env_file):
        return None
    with open(env_file) as f:
        for line in f:
            if line.startswith("NEO4J_PASSWORD="):
                return line.strip().split("=", 1)[1]
    return None


def _run_cypher(statement, parameters=None, password=None):
    if not password:
        return None
    try:
        resp = requests.post(
            NEO4J_HTTP_URL, auth=("neo4j", password), timeout=10,
            json={"statements": [{"statement": statement, "parameters": parameters or {}}]},
        )
        resp.raise_for_status()
        data = resp.json()
        if data.get("errors"):
            return None
        rows = data["results"][0]["data"]
        return [r["row"] for r in rows]
    except Exception:
        return None


def extract_target_module(proposal_text):
    match = re.search(r'odoo-modules/([\w-]+)/', proposal_text)
    return match.group(1) if match else None


def build_context_block(proposal_text):
    """Ritorna una stringa (eventualmente vuota) da anteporre al messaggio
    per Aider - MAI solleva un'eccezione al chiamante, un grafo
    irraggiungibile o senza dati per quel modulo non deve mai bloccare il
    lavoro di Claudio, solo privarlo di un aiuto in piu'."""
    module = extract_target_module(proposal_text)
    if not module:
        return ""
    password = _load_neo4j_password()
    if not password:
        return ""

    deps = _run_cypher(
        "MATCH (m:Code_Modulo {id: $id})-[:DEPENDS_ON]->(t) RETURN t.id AS dep",
        {"id": "module:%s" % module}, password,
    )
    models = _run_cypher(
        "MATCH (n:Code_Modello {owning_module: $mod}) RETURN n.id AS mid",
        {"mod": module}, password,
    )
    if not deps and not models:
        return ""

    lines = ["--- Contesto dal grafo di conoscenza (solo per %s, non tutto il repo) ---" % module]
    if deps:
        dep_names = [d[0].replace("module:", "") for d in deps]
        lines.append("Dipende da: %s" % ", ".join(dep_names))
    if models:
        model_names = [m[0].replace("model:", "") for m in models]
        lines.append("Modelli business definiti qui: %s" % ", ".join(model_names))
    lines.append("--- fine contesto dal grafo ---\n")
    return "\n".join(lines)
