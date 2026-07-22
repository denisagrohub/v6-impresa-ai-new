{
    'name': 'ERPv6 Consulting - Gestione Consulenti Multibrand',
    'version': '18.0.1.0.0',
    'category': 'Consulting',
    'summary': 'Gestione consulenti e referral per multiple brand',
    'description': """
        Modulo per gestire consulenti e referral con supporto multibrand:
        - Estende res.partner con campi consulente
        - Supporto multiple brand (Progetto Impresa, Zero Sprechi, Manuale Rapido)
        - Configurazione tariffe, provvigioni, sconti massimi
        - Specializzazioni per settore
    """,
    'author': 'ERPv6',
    'website': 'https://erpv6.it',
    'license': 'LGPL-3',
    'depends': [
        'base',
        'contacts',
        'erpv6_tracking',
    ],
    'data': [
        'security/ir.model.access.csv',
        'data/default_brands.xml',
        'views/consulting_brand_views.xml',
        'views/res_partner_views.xml',
        'views/menu_views.xml',
    ],
    'installable': True,
    'application': True,
    'auto_install': False,
}
