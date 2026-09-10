{
    'name': 'ERP V6 - Tracking Relation',
    'version': '18.0.1.0.0',
    'category': 'Sales',
    'summary': 'Motore generico archi/gerarchia progetto-parte (erpv6.tracking.relation) e gate NDA su erpv6.contract',
    # erpv6_library aggiunto 10/09/2026 (Denis: "manca sui progetti partner
    # la possibilità di upload documenti") - document_ids sotto
    # (tracking_relation.py) referenzia erpv6.library.document.
    'depends': ['base', 'mail', 'erpv6_core', 'erpv6_contract', 'erpv6_library'],
    'data': [
        'security/ir.model.access.csv',
        'data/security_project_managers_data.xml',
        'views/tracking_relation_views.xml',
    ],
    'installable': True,
    'application': False,
}
