from odoo import _, fields, models
from odoo.exceptions import UserError


class Erpv6AgentCreateWizard(models.TransientModel):
    """'Thor', versione semplice: crea un nuovo agente scegliendo tra i
    pattern gia' pronti (oggi solo 'text_proposal') e configurandolo da
    solo -- nessun codice Python da scrivere. Le categorie KB di istruzioni
    e contesto si scelgono tra quelle esistenti O SE NE CREA UNA NUOVA AL
    VOLO scrivendo un nome nuovo nel campo (comportamento nativo di Odoo sui
    campi Many2one, nessun sotto-wizard costruito apposta). La rotta AI
    (erpv6.omni.route.config) viene creata da sola se non esiste ancora,
    copiando primary/fallback provider dalla rotta di Kaizen (gia'
    collaudata stanotte: OpenRouter + fallback Groq/Gemini) -- altrimenti
    il nuovo agente resterebbe configurato ma senza nessun provider da
    chiamare, la stessa trappola in cui e' caduta la prima route di Kaizen.

    NON costruito ancora (deliberatamente, richiede piu' progettazione):
    la bozza automatica delle regole KB via AI quando la categoria di
    istruzioni e' nuova ("un wizard... le fa creare, Thor le verifica, io
    le approvo") -- per ora le regole si scrivono a mano nella categoria
    appena creata, prima di attivare l'agente."""
    _name = 'erpv6.agent.create_wizard'
    _description = 'Thor - Crea Nuovo Agente'

    name = fields.Char(string='Nome Agente', required=True)
    code = fields.Char(string='Codice', required=True, help="Slug tecnico stabile, es. 'sabrina'.")
    pattern_id = fields.Many2one(
        'erpv6.agent.pattern', string='Pattern', required=True,
        default=lambda self: self.env['erpv6.agent.pattern'].search([('code', '=', 'text_proposal')], limit=1),
    )
    instructions_category_id = fields.Many2one(
        'erpv6.kb.category', string='Categoria KB Istruzioni', required=True,
        help="Le regole/istruzioni che l'agente deve seguire. Scegline una esistente o scrivi un "
             "nome nuovo per crearla al volo.",
    )
    context_category_id = fields.Many2one(
        'erpv6.kb.category', string='Categoria KB Contesto/Fatti',
        help="I fatti/lo stato attuale su cui l'agente deve ragionare. Come sopra, puoi crearne una nuova.",
    )
    omni_task_type = fields.Char(
        string='Task Type AI', required=True,
        help="Identificatore tecnico della chiamata AI per questo agente, es. 'sabrina_propose'. "
             "Se non esiste ancora una rotta con questo nome, ne viene creata una copiando i "
             "provider gia' collaudati della rotta Kaizen.",
    )

    def action_confirm(self):
        self.ensure_one()
        if self.env['erpv6.agent.config'].search_count([('code', '=', self.code)]):
            raise UserError(_("Esiste gia' un agente con codice '%s'.") % self.code)

        route = self.env['erpv6.omni.route.config'].search([('task_type', '=', self.omni_task_type)], limit=1)
        if not route:
            kaizen_route = self.env['erpv6.omni.route.config'].search([('task_type', '=', 'kaizen_agent_propose')], limit=1)
            route = self.env['erpv6.omni.route.config'].create({
                'name': _("Agente %s") % self.name,
                'task_type': self.omni_task_type,
                'routing_strategy': 'priority',
                'primary_provider_id': kaizen_route.primary_provider_id.id if kaizen_route else False,
                'fallback_provider_ids': [(6, 0, kaizen_route.fallback_provider_ids.ids)] if kaizen_route else [],
                'description': _("Rotta creata automaticamente da Thor per l'agente '%s', provider copiati dalla rotta Kaizen gia' collaudata.") % self.name,
            })

        config = self.env['erpv6.agent.config'].create({
            'name': self.name,
            'code': self.code,
            'pattern_id': self.pattern_id.id,
            'instructions_category_id': self.instructions_category_id.id,
            'context_category_id': self.context_category_id.id,
            'omni_task_type': self.omni_task_type,
        })
        return {
            'type': 'ir.actions.act_window',
            'res_model': 'erpv6.agent.config',
            'res_id': config.id,
            'view_mode': 'form',
            'target': 'current',
        }
