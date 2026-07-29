{
    'name': 'ERP V6 - Booking',
    'version': '18.0.1.0.0',
    'category': 'V6 Impresa AI',
    'summary': 'Prenotazioni con token sicuri',
    'license': 'LGPL-3',
    'depends': ['base', 'mail', 'erpv6_core', 'erpv6_consulting'],
    'data': [
        'security/ir.model.access.csv',
        'data/cron_data.xml',
        'views/booking_views.xml',
    ],
    'installable': True,
    'application': False,
}
