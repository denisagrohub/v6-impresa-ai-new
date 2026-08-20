from odoo import fields, models


class Erpv6AgentProposalAcceptWizard(models.TransientModel):
    """Popup aperto da erpv6.agent.proposal.action_accept: separa "chi
    accetta" (fa il gate umano, sempre l'utente corrente) da "chi esegue"
    (assegnatario scelto qui, puo' essere chiunque altro) -- segnalato dal
    vivo dall'utente il 20/08/2026."""
    _name = 'erpv6.agent.proposal.accept_wizard'
    _description = 'Assegna ed Accetta Proposta Agente'

    proposal_id = fields.Many2one('erpv6.agent.proposal', required=True)
    proposal_text = fields.Text(related='proposal_id.proposal_text', readonly=True)
    assignee_id = fields.Many2one(
        'res.users', string='Assegna il lavoro a', required=True,
        default=lambda self: self.env.user,
        help="Chi deve davvero attuare la proposta. Puo' essere diverso da chi la accetta ora.",
    )

    def action_confirm(self):
        self.ensure_one()
        self.proposal_id._do_accept(self.assignee_id)
        return {'type': 'ir.actions.act_window_close'}
