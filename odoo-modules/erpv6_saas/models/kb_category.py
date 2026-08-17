from odoo import _, api, models
from odoo.exceptions import ValidationError


class Erpv6KbCategory(models.Model):
    _inherit = 'erpv6.kb.category'

    @api.constrains('verticale')
    def _check_verticale_in_catalog(self):
        """Impedisce che una categoria KB usi un verticale inventato: deve
        esistere in erpv6.vertical.catalog, la stessa fonte usata dal form
        pubblico /api/v1/verticals (vedi saas_vertical_api.py). Se il
        catalogo e' ancora vuoto (non ancora popolato) non blocca nulla -
        e' un vincolo di coerenza, non un prerequisito rigido."""
        catalog = self.env['erpv6.vertical.catalog'].sudo().search([('is_active', '=', True)])
        if not catalog:
            return
        valid_codes = set(catalog.mapped('verticale'))
        for rec in self:
            if rec.verticale and rec.verticale not in valid_codes:
                raise ValidationError(
                    _("Il verticale '%s' non esiste nel catalogo verticali (Impostazioni SaaS > Verticali). "
                      "Aggiungilo li' prima di usarlo qui, cosi' resta coerente con l'intervista pubblica.") % rec.verticale
                )
