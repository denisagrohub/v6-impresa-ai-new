{
    'name': 'ERP V6 - Tracking Relation',
    'version': '18.0.1.0.0',
    'category': 'Sales',
    'summary': 'Motore generico archi/gerarchia progetto-parte (erpv6.tracking.relation) e gate NDA su erpv6.contract',
    'depends': ['base', 'mail', 'erpv6_core', 'erpv6_contract'],
    'data': [
        'security/ir.model.access.csv',
        'data/security_project_managers_data.xml',
        'views/tracking_relation_views.xml',
    ],
    'installable': True,
    'application': False,
}
