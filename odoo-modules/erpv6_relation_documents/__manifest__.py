{
    'name': 'ERP V6 - Relation Documents',
    'version': '18.0.1.0.0',
    'category': 'V6 Impresa AI',
    'summary': 'Generazione NDA/Contratto/NCND + richiesta firma per erpv6.tracking.relation (Progetti Partner)',
    'author': 'V6 Impresa AI',
    'license': 'LGPL-3',
    # 10/09/2026 (Denis: "manca sui progetti partner... anche la
    # generazione documenti") - MODULO NUOVO E FOGLIA (nessun altro modulo
    # dipende da questo) apposta: il pomeriggio del 10/09/2026 aggiungere
    # una dipendenza a un modulo GIA' installato e largamente dipeso
    # (aeosv6_relation, erpv6_contract, ...) ha innescato ore di stati
    # "to upgrade" inconsistenti sul server per un problema di ambiente
    # (pacchetti pip non persistenti nei container `docker compose run`
    # freschi) - mai più risolto del tutto in giornata. Un modulo foglia
    # nuovo evita di toccare quel grafo: la sua installazione (-i, non -u
    # su moduli già installati) non può innescare lo stesso problema.
    'depends': ['base', 'aeosv6_relation', 'erpv6_typst', 'erpv6_contract', 'erpv6_sign'],
    # Nessun modello nuovo qui (solo nuovi metodi su erpv6.tracking.relation,
    # già esistente) - nessuna riga ACL da aggiungere.
    'data': [],
    'installable': True,
    'application': False,
}
