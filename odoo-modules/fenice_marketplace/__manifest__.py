{
    'name': 'Fenice Marketplace',
    'version': '18.0.1.0.0',
    'category': 'Sales/E-Commerce',
    'summary': 'Piattaforma e-commerce multi-vendor per Fattorie Venexiane',
    'depends': ['base', 'sale_management', 'website_sale', 'account'],
    'data': [
        'views/fenice_vendor_views.xml',
        'views/fenice_product_views.xml',
        'views/fenice_commission_views.xml',
    ],
    'installable': True,
    'application': True,
}
