{
    'name': 'V6 Impresa — Attribuzione portatori',
    'version': '18.0.1.0.0',
    'category': 'V6 Impresa',
    'summary': 'Portatore + co-segnalatori su portfolio crediti',
    'author': 'V6 Impresa AI',
    'license': 'LGPL-3',
    'depends': [
        'base', 'mail',
        'aeosv6_relation',
        'erpv6_crediti',
        'erpv6_referral',
    ],
    'data': [
        'security/ir.model.access.csv',
        'data/ir_config_parameter.xml',
        'views/credit_portfolio_views.xml',
        'views/res_partner_views.xml',
        'views/attribution_wizard_views.xml',
    ],
    'installable': True,
    'application': False,
    'description': """
Attribuzione del portatore su un portfolio crediti.
Modello reale V6 (non standard):
  - 1 portatore (interno o esterno) - es. Denis porta Chimera,
    Enzo porta Eterna
  - N consulenti operativi (>= 1, tipicamente 2-4) - es.
    Christian, Martina
  - V6 struttura (la societa')
  - Co-segnalatori opzionali (chi ha solo "passato il nome")

Split CONTRATTUALE caso per caso. I config params
credit.split.default_* sono PLACEHOLDER per il wizard (1b),
NON regole fisse.

Esempio tipico:
  Portatore Denis 40% (ha portato la controparte)
  Operativo Christian 20% (ci lavora)
  Operativo Martina 20% (supporta)
  V6 struttura 20%
  ---
  Totale 100%
""",
}
