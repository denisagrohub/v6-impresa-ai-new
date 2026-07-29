{
    'name': 'Fenice Lead Automation',
    'version': '18.0.1.0.0',
    'category': 'Marketing/Email Marketing',
    'summary': 'Automazione funnel email per lead Fenice AI con report PDF',
    'description': """
        Modulo per l'automazione del funnel email dei lead generati da Fenice AI.
        - Creazione automatica lead CRM da API esterna
        - Sequenza email programmata (5 step)
        - Generazione report PDF Fenice Score
        - Dashboard monitoraggio conversioni
    """,
    'author': 'Fattorie Venexiane',
    'website': 'https://www.fattorievenexiane.it',
    'license': 'LGPL-3',
    'depends': ['crm', 'mail'],
    'data': [
        'data/mail_template_data.xml',
        'data/cron_data.xml',
        'data/funnel_default_data.xml',
        'views/crm_lead_views.xml',
        'views/funnel_config_views.xml',
        'views/menu_views.xml',
        'report/fenice_report_template.xml',
    ],
    'installable': True,
    'application': True,
    'auto_install': False,
}
