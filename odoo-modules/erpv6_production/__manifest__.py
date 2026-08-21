{
    'name': 'ERP V6 - Production Engine',
    'version': '18.0.1.0.0',
    'category': 'V6 Impresa AI',
    'summary': 'Motore generico di produzione a fasi dinamiche (lead -> relazione -> documento)',
    'description': """
        Motore a-settoriale che collega un crm.lead a N produzioni indipendenti
        (relazione, business plan, ...), ciascuna con fasi dinamiche avanzate da
        eventi (interazioni consulente o cron), non da click manuali.

        Fase 1: scaffold dei modelli e dell'hook di creazione automatica sul
        lead. La logica di avanzamento fase (erpv6.kb.engine, 6 Giudici via
        erpv6_validation, generazione documento via erpv6_typst) arriva nelle
        fasi successive.
    """,
    'author': 'V6 Impresa AI',
    'license': 'LGPL-3',
    'depends': [
        'base',
        'mail',
        'crm',
        'resource',
        'project',
        'erpv6_core',
        'erpv6_methodology',
        'erpv6_kb',
        'erpv6_package',
        'erpv6_omni_bridge',
        'erpv6_library',
        'erpv6_validation',
        'erpv6_contract',
        'erpv6_typst',
    ],
    'data': [
        'security/ir.model.access.csv',
        'data/production_cron.xml',
        'data/production_phase_data.xml',
        'data/kb_admin_lead_data.xml',
        'data/kb_prompt_data.xml',
        'data/validation_session_bulk_actions.xml',
        'data/kb_bulk_actions.xml',
        'views/production_views.xml',
        'views/production_schedule_views.xml',
        'views/kb_import_wizard_views.xml',
        'views/library_document_views.xml',
        'views/validation_session_views.xml',
        'views/typst_template_views.xml',
    ],
    'installable': True,
    'application': True,
}
