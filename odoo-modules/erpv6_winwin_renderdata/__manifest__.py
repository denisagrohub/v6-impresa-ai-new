{
    'name': 'ERP V6 - Circuito Win-Win RenderData (AEOSV6)',
    'version': '18.0.1.0.0',
    'category': 'V6 Impresa AI',
    'summary': 'Circuito AEOSv6: da intervista completata a render_data validato per il PDF Win-Win',
    'description': """
        Costruisce il Circuito erpv6_winwin_renderdata.

        Fase 1 (Conoscenza): soglie metriche finanziarie (DSCR, leva) come
        dato KB, non hardcoded, collegate al nodo AEOSv6 del circuito via
        erpv6.core.kb_link (stesso pattern di erpv6_disc_assessment).

        Sblocco Fase 2 (raccolta dati bilancio): l'intervista reale non
        raccoglieva dati di bilancio (oneri finanziari, EBITDA, debito
        finanziario, data ultima visura, contenzioso, bando target) - questo
        modulo li aggiunge in due percorsi: Percorso B (primario) upload di
        un bilancio/visura PDF con estrazione automatica via lo stesso
        motore AI generico gia' usato da erpv6_production (_run_metodo_ai),
        Percorso A (fallback) domande dirette in euro solo per i campi che
        l'estrazione non ha trovato. Vedi
        CIRCUITO_WINWIN_RENDERDATA_REPORT_FINALE.md nel repo per il report
        completo di tutte le fasi.
    """,
    'author': 'V6 Impresa AI',
    'license': 'LGPL-3',
    'depends': [
        'mail', 'erpv6_core', 'erpv6_core_dispatch', 'erpv6_core_engine', 'erpv6_kb',
        'erpv6_production', 'erpv6_omni_bridge', 'erpv6_validation', 'erpv6_agent',
        'aeosv6_booking', 'aeosv6_relation', 'aeosv6_project_relay',
    ],
    'data': [
        'security/ir.model.access.csv',
        'data/kb_winwin_thresholds_data.xml',
        'data/kb_roadmap_raccomandazione_data.xml',
        'data/kb_bilancio_extraction_data.xml',
        'data/interview_question_bilancio_data.xml',
        'data/cron_report_token_data.xml',
        'views/winwin_dashboard_views.xml',
    ],
    'assets': {
        'web.assets_backend': [
            'erpv6_winwin_renderdata/static/src/scss/winwin_dashboard.scss',
            'erpv6_winwin_renderdata/static/src/js/winwin_dashboard.js',
            'erpv6_winwin_renderdata/static/src/xml/winwin_dashboard.xml',
        ],
    },
    'installable': True,
    'application': False,
}
