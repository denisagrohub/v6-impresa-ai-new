from odoo import fields, models


class ResCompanyCoreEngineExt(models.Model):
    """Denis, 29/08/2026, decomposizione erpv6_tracking: 'company_code' (sigla
    a 3 lettere) non esisteva da nessuna parte nel sistema -- erpv6.tracking.
    config lo duplicava come Char libero, digitato a mano, scollegato da
    res.company. Regola seguita: EAOSv6, come orchestratore (stesso ruolo di
    erpv6_opportunity tra kaizen/bandi nel CLAUDE.md), e' il posto giusto
    per aggiungerlo -- MAI un modulo verticale che si inventa una copia
    locale di un dato che dovrebbe essere centrale. Risolvibile sempre via
    self.env.company.company_code, nessuna dipendenza da erpv6_whitelabel
    (opzionale, non installato ovunque) ne' da alcun altro modulo verticale."""
    _inherit = 'res.company'

    company_code = fields.Char(
        string='Sigla Azienda (EAOSv6)',
        size=3,
        help="Sigla di 3 lettere che identifica questa azienda nei codici generati "
             "dai Motori (es. tracciabilita' lotti) -- unica fonte, mai duplicata "
             "nei singoli moduli verticali.",
    )
