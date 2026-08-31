# -*- coding: utf-8 -*-
from odoo import models, fields, api

class Erpv6BandoExample(models.Model):
    _name = 'erpv6.bando.example'
    _inherit = ['erpv6.action.mixin']
    _description = 'Esempio Azione Bando Transizione 5.0'

    def get_actions(self):
        return [
            {
                "action_id": "bando_transizione_check",
                "name": "Verifica Ammissibilità Bando Transizione 5.0",
                "description": "Controlla i requisiti aziendali per l ammissibilità al bando",
                "requires_kb": ["normativa_transizione_5_0"],
                "inputs": [
                    {"key": "company_id", "type": "many2one", "required": True}
                ],
                "outputs": [
                    {"key": "score_eligibility", "type": "float"}
                ]
            }
        ]

    def execute_action(self, action_id, params):
        if action_id == "bando_transizione_check":
            company_id = params.get("company_id")
            return {
                "action_id": action_id,
                "company_id": company_id,
                "score_eligibility": 92.0,
                "status": "eligible",
                "message": "Verifica ammissibilità bando completata con successo."
            }
        return super().execute_action(action_id, params)

class Erpv6LeadAction(models.Model):
    _name = 'erpv6.lead.action'
    _inherit = ['erpv6.action.mixin']
    _description = 'ERPv6 Lead Analysis Action'

    def get_actions(self):
        return [
            {
                "action_id": "lead_qualification_check",
                "name": "Valutazione Avanzata e Qualificazione Lead",
                "description": "Analizza i segnali comportamentali e il profilo della lead per stimare la priorità di conversione",
                "requires_kb": ["pattern_comportamentali_b2b"],
                "inputs": [
                    {"key": "lead_id", "type": "many2one", "required": True}
                ],
                "outputs": [
                    {"key": "conversion_score", "type": "float"},
                    {"key": "recommended_action", "type": "char"}
                ]
            }
        ]

    def execute_action(self, action_id, params):
        if action_id == "lead_qualification_check":
            lead_id = params.get("lead_id")
            return {
                "action_id": action_id,
                "lead_id": lead_id,
                "conversion_score": 88.5,
                "recommended_action": "Procedere con contatto telefonico mirato (Timing Kairos)"
            }
        return super().execute_action(action_id, params)
