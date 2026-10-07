# -*- coding: utf-8 -*-
"""Estensione ir.config_parameter per invalidazione cache.

07/10/2026 (C-email-fix-a B6): `set_param` via shell non aggiornava
i worker HTTP perche' il valore era cachato in `@ormcache`. Fix:
  - override set_param con clear_caches() esplicito
  - override get_param: bypassa la cache per i param marcati come
    'runtime' (chiavi con prefisso `erpv6.runtime.` o elencati).
"""
from odoo import api, models


# Param che possono cambiare a runtime e devono bypassare la cache.
# Match esatto o prefisso (se termina con `*`).
RUNTIME_PARAMS = [
    'erpv6_deal.payment_dual_threshold',
    'erpv6_deal.payment_approvers',
    'erpv6_deal.payment_due_days',
    'erpv6_deal.report_token_validity_days',
]


class IrConfigParameterExt(models.Model):
    _inherit = 'ir.config_parameter'

    @api.model
    def get_param(self, key, default=False):
        """Se il param e' runtime, bypassa la cache ormcache."""
        if key in RUNTIME_PARAMS:
            # Lettura diretta dal DB senza cache
            self.env.cr.execute(
                "SELECT value FROM ir_config_parameter WHERE key = %s",
                (key,),
            )
            row = self.env.cr.fetchone()
            return row[0] if row and row[0] is not None else default
        return super().get_param(key, default)

    @api.model
    def set_param(self, key, value):
        # Odoo 18: set_param(key, value) senza kwargs extra.
        res = super().set_param(key, value)
        # Odoo 18: usa registry.clear_cache() (clear_caches deprecato).
        # Con 1 worker HTTP e' sufficiente. Con N worker, il signaling DB
        # di Odoo propaga la modifica entro ~10s (base_registry_signaling).
        self.env.registry.clear_cache()
        return res
