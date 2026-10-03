{
    'name': 'V6 Impresa - Calendar Extension',
    'version': '18.0.1.0.0',
    'category': 'V6 Impresa',
    'summary': 'Estende calendar.event con contesto business V6',
    'author': 'V6 Impresa AI',
    'license': 'LGPL-3',
    'depends': [
        'calendar',
        'erpv6_winwin_renderdata',
        'aeosv6_relation',
        'erpv6_agent',  # 03/10/2026 (B): per erpv6.agent.telegram.config
    ],
    'data': [
        'views/calendar_event_views.xml',
        'data/mail_template_internal_invite.xml',
    ],
    'installable': True,
    'application': False,
}
