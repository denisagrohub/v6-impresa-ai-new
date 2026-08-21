"""Estrattore grafo ORM erpv6 (Fase 1A, 20-21/08/2026).

Tooling interno, NON un modulo Odoo da installare in produzione (vive fuori
da odoo-modules/ per questo motivo). Va eseguito dentro il contesto di
`odoo shell` (ha bisogno della variabile `env` gia' presente in quel
contesto), sola lettura sul database -- nessuna scrittura.

Uso:
    docker exec odoo bash -c "cat /path/to/extract_orm_graph.py | odoo shell -d erpv6 --no-http"

Produce un grafo con NetworkX (richiesto esplicitamente dall'utente al posto
di Neo4j per questa fase) e lo esporta in JSON compatibile con
react-force-graph: nodi con almeno {id, label, origin, status, kind}, archi
con {source, target, type} (+ attributi extra tipo via_field per i
relates_to).

Nodi di due tipi diversi nello stesso grafo:
- modulo (kind='module'): un nodo per ogni erpv6.module.module installed,
  arco depends_on verso ogni sua dipendenza.
- modello (kind='model'): un nodo per ogni ir.model, arco relates_to verso
  il modello di destinazione di ogni campo relazionale (many2one/one2many/
  many2many), con via_field=nome del campo.

status='planned' NON viene assegnato a nessun nodo qui: la lista dei "7
moduli futuri" citata nel prompt originale non e' mai stata fornita in
questa sessione, e inventare nomi di moduli che non esistono violerebbe la
regola anti-allucinazione del progetto. Tutti i nodi modulo qui sono
status='production' (esistono davvero e sono installed). Se/quando la lista
dei moduli pianificati sara' data esplicitamente, va aggiunta come nodi
placeholder a parte, non dedotta.
"""
import json
from datetime import date

import networkx as nx


def classify_origin(module_name):
    if module_name.startswith('erpv6_'):
        return 'erpv6'
    if module_name.startswith('fenice_'):
        return 'fenice'
    return 'odoo_core'


def is_wrong_instance(origin):
    # I moduli fenice_* installati su erpv6 sono destinati a un altro
    # database (fattorie_della_fenice) -- installati per errore/in attesa
    # di essere sistemati su QUESTA istanza, non residui morti. Chiarito
    # esplicitamente dall'utente il 21/08/2026, dopo aver verificato che
    # fattorie_della_fenice e' un database Postgres reale e separato (mai
    # interrogato da questo script -- solo 'erpv6' via `odoo shell -d erpv6`).
    return origin == 'fenice'


def main(env):
    graph = nx.MultiDiGraph()

    # --- Nodi modulo + archi depends_on ---
    modules = env['ir.module.module'].search([('state', '=', 'installed')])
    for module in modules:
        origin = classify_origin(module.name)
        graph.add_node(
            'module:%s' % module.name,
            label=module.name,
            kind='module',
            origin=origin,
            status='production',
            installed_on_wrong_instance=is_wrong_instance(origin),
        )
    for module in modules:
        for dep in module.dependencies_id:
            dep_name = dep.name
            if graph.has_node('module:%s' % dep_name):
                graph.add_edge('module:%s' % module.name, 'module:%s' % dep_name, type='depends_on')

    # --- Nodi modello + archi relates_to (solo modelli di moduli installed) ---
    installed_names = set(modules.mapped('name'))
    models = env['ir.model'].search([])
    model_by_name = {}
    for model in models:
        module_names = set(m.strip() for m in model.modules.split(',')) if model.modules else set()
        # Un modello puo' essere dichiarato/esteso da piu' moduli
        # (modules e' una stringa CSV su ir.model) -- prendo il primo
        # modulo INSTALLED tra quelli elencati come "proprietario" per
        # l'origin, altrimenti il modello e' orfano di un modulo attivo e lo
        # salto (puo' capitare per modelli di moduli non installati che
        # restano comunque in ir.model in alcune versioni Odoo).
        owning = next((m for m in module_names if m in installed_names), None)
        if not owning:
            continue
        origin = classify_origin(owning)
        graph.add_node(
            'model:%s' % model.model,
            label=model.model,
            kind='model',
            origin=origin,
            status='production',
            owning_module=owning,
            installed_on_wrong_instance=is_wrong_instance(origin),
        )
        model_by_name[model.model] = owning

    rel_fields = env['ir.model.fields'].search([
        ('ttype', 'in', ['many2one', 'one2many', 'many2many']),
        ('relation', '!=', False),
    ])
    edges_skipped_target_missing = 0
    for field in rel_fields:
        source_key = 'model:%s' % field.model
        target_key = 'model:%s' % field.relation
        if not graph.has_node(source_key) or not graph.has_node(target_key):
            edges_skipped_target_missing += 1
            continue
        graph.add_edge(source_key, target_key, type='relates_to', via_field=field.name, field_type=field.ttype)

    # --- Export JSON compatibile react-force-graph ---
    nodes_out = [dict(id=n, **data) for n, data in graph.nodes(data=True)]
    edges_out = [dict(source=u, target=v, **data) for u, v, data in graph.edges(data=True)]
    output = {
        'generated_at': str(date.today()),
        'stats': {
            'module_nodes': sum(1 for n, d in graph.nodes(data=True) if d.get('kind') == 'module'),
            'model_nodes': sum(1 for n, d in graph.nodes(data=True) if d.get('kind') == 'model'),
            'depends_on_edges': sum(1 for u, v, d in graph.edges(data=True) if d.get('type') == 'depends_on'),
            'relates_to_edges': sum(1 for u, v, d in graph.edges(data=True) if d.get('type') == 'relates_to'),
            'relates_to_edges_skipped_target_not_in_graph': edges_skipped_target_missing,
            'total_nodes': graph.number_of_nodes(),
            'total_edges': graph.number_of_edges(),
        },
        'nodes': nodes_out,
        'edges': edges_out,
    }
    return output


result = main(env)
out_path = '/tmp/orm_graph_%s.json' % result['generated_at']
with open(out_path, 'w') as f:
    json.dump(result, f, indent=2)
print("Scritto:", out_path)
print("Stats:", json.dumps(result['stats'], indent=2))
