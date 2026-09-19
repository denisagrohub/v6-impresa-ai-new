{
    'name': 'ERP V6 - Referral Commerciali',
    'version': '18.0.1.0.0',
    'category': 'Sales',
    'summary': 'Segnalazioni commerciali tracciate + accordo + blockchain',
    'depends': ['aeosv6_relation', 'erpv6_blockchain'],
    'data': [
        'security/ir.model.access.csv',
        'views/referral_views.xml',
    ],
    'installable': True,
    'application': False,
}
