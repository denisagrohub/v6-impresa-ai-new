# -*- coding: utf-8 -*-
from odoo import models, fields, api, _
import logging
import json

_logger = logging.getLogger(__name__)

class ERPv6ActionMixin(models.AbstractModel):
    _name = 'erpv6.action.mixin'
    _description = 'EOSv6 KL - Action Provider Mixin'

    @api.model
    def get_actions(self):
        """
        Struttura standard che ogni modulo deve sovrascrivere.
        Esempio di azione autodescrittiva:
        """
        return []

    @api.model
    def export_actions_catalog(self):
        """
        Scansiona i modelli installati ed esporta il catalogo completo delle capacità in JSON.
        """
        catalog = {}
        for model_name, model_obj in self.env.items():
            if hasattr(model_obj, 'get_actions') and callable(getattr(model_obj, 'get_actions')):
                try:
                    actions = model_obj.get_actions()
                    if actions:
                        catalog[model_name] = actions
                except Exception as e:
                    _logger.error(f"Errore nell'estrazione delle azioni per {model_name}: {str(e)}")
        return catalog

    @api.model
    def raise_knowledge_gap(self, title, description, missing_key=None):
        _logger.warning(f"[KAIZEN GAP DETECTED] {title}: {description}")
        
        if 'biz.knowledge.gap' in self.env:
            gap = self.env['biz.knowledge.gap'].create({
                'name': title,
                'description': description,
                'missing_key': missing_key or 'unknown',
                'state': 'open',
            })
            return gap
        
        _logger.error("Modello biz.knowledge.gap non registrato nell'ambiente Odoo.")
        return False
