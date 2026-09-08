from odoo import _, fields, models
from odoo.exceptions import UserError

_RUOLO = [
    ('gestore', 'Gestore'),
    ('parte_attiva', 'Parte Attiva'),
    ('osservatore', 'Osservatore'),
]
_POSTA_IN_GIOCO = [
    ('standard', 'Standard'),
    ('alta', 'Alta'),
]
_MANDATO = [
    ('pieno', 'Pieno'),
    ('parziale', 'Parziale'),
    ('nessuno', 'Nessuno'),
    ('non_applicabile', 'Non Applicabile'),
]


class Erpv6ProjectRelayNewProjectLine(models.TransientModel):
    _name = 'erpv6.project.relay.new.project.line'
    _description = 'Riga Parte Collegata (wizard Nuovo Progetto)'

    wizard_id = fields.Many2one('erpv6.project.relay.new.project.wizard', required=True, ondelete='cascade')
    name = fields.Char(required=True, string='Nome Nodo')
    partner_id = fields.Many2one('res.partner', string='Parte Collegata')
    email_alias = fields.Char(required=True, string='Alias Email (local-part)')
    ruolo = fields.Selection(_RUOLO, string='Ruolo')
    posta_in_gioco = fields.Selection(_POSTA_IN_GIOCO, string='Posta in Gioco', default='standard')
    mandato = fields.Selection(_MANDATO, string='Mandato')
    richiede_nda = fields.Boolean(string='Richiede NDA prima di attivazione')


class Erpv6ProjectRelayNewProjectWizard(models.TransientModel):
    """Il "pulsante nuovo progetto" (Denis, 04/09/2026): crea il nodo padre
    + una parte collegata per ciascuna riga, chiamando il Motore IPO
    'create_project_node' (aeosv6_dispatch.py) via run_process() -- il
    wizard e' solo l'interfaccia, la creazione vera passa dal grafo AEOSV6
    ed e' quindi riusabile anche fuori da questo form (API, altro
    circuito)."""
    _name = 'erpv6.project.relay.new.project.wizard'
    _description = 'Nuovo Progetto (crea nodo padre + parti collegate)'

    project_name = fields.Char(required=True, string='Nome Progetto')
    line_ids = fields.One2many(
        'erpv6.project.relay.new.project.line', 'wizard_id', string='Parti Collegate',
    )

    def action_confirm(self):
        self.ensure_one()
        if not self.line_ids:
            raise UserError(_("Aggiungi almeno una parte collegata prima di confermare."))

        node = self.env.ref('aeosv6_project_relay.node_create_project_node')

        parent_execution = node.run_process({'name': self.project_name})
        parent_id = parent_execution.output_data['relation_id']

        for line in self.line_ids:
            input_data = {
                'name': line.name,
                'parent_id': parent_id,
                'email_alias': line.email_alias,
                'richiede_nda': line.richiede_nda,
            }
            if line.partner_id:
                input_data['partner_id'] = line.partner_id.id
            if line.ruolo:
                input_data['ruolo'] = line.ruolo
            if line.posta_in_gioco:
                input_data['posta_in_gioco'] = line.posta_in_gioco
            if line.mandato:
                input_data['mandato'] = line.mandato
            node.run_process(input_data)

        return {
            'type': 'ir.actions.act_window',
            'res_model': 'erpv6.tracking.relation',
            'res_id': parent_id,
            'view_mode': 'form',
            'target': 'current',
        }
