{
    'name': 'ERP V6 - Methodology Engines',
    'version': '18.0.1.0.0',
    'category': 'V6 Impresa AI',
    'summary': 'Motori generici del Metodo V6 (Pareto, Kairós, Matrix 5S, Heinrich)',
    'author': 'V6 Impresa AI',
    'license': 'LGPL-3',
    # erpv6_kb + erpv6_omni_bridge aggiunti 10/09/2026 (Denis: "dare in
    # pasto a metodology tutta la lavagna e avere un responso") -
    # analyze_board() sotto (erpv6.project.note) usa lo stesso schema
    # KB+AI di ogni altro "metodo" del sistema (istruzione erpv6.kb +
    # erpv6.omni.route.config dedicata, mai un motore nuovo): prima non
    # servivano perche' questo modulo faceva solo calcoli deterministici
    # (Pareto/Kairós/5S/Heinrich), nessuna chiamata AI.
    'depends': ['base', 'mail', 'erpv6_core', 'erpv6_kb', 'erpv6_omni_bridge'],
    'data': [
        'security/ir.model.access.csv',
        'views/methodology_views.xml',
        'data/kb_metodo_analisi_lavagna_data.xml',
    ],
    'installable': True,
    'application': True,
}
