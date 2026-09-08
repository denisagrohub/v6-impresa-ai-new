from odoo import api, fields, models


class Erpv6TrackingRelation(models.Model):
    """Aggiunge il bottone 'Invia Email dal Progetto' a erpv6.tracking.relation
    (Denis, 05/09/2026, hub email di progetto) -- vive qui e non in
    aeosv6_relation perche' dipende dal wizard di invio definito in questo
    modulo, coerente con la direzione di dipendenza dichiarata nel manifest
    (aeosv6_project_relay -> aeosv6_relation, mai il contrario). Aggiunge
    anche email_alias_full: email_alias sulla base contiene solo la
    local-part (es. 'progetto-tee'), non abbastanza per dire a qualcuno
    "mettila in copia" -- serve l'indirizzo completo, visibile in chiaro
    sia sulla scheda del progetto sia nel wizard di invio."""
    _inherit = 'erpv6.tracking.relation'

    email_alias_full = fields.Char(
        string='Email Completa (da dare alle parti per il "in copia")',
        compute='_compute_email_alias_full',
    )

    @api.depends('email_alias')
    def _compute_email_alias_full(self):
        for rec in self:
            rec.email_alias_full = f"{rec.email_alias}@v6sviluppoimpresa.it" if rec.email_alias else False

    def action_open_send_email_wizard(self):
        self.ensure_one()
        root = self
        while root.parent_id:
            root = root.parent_id
        return {
            'type': 'ir.actions.act_window',
            'name': 'Invia Email dal Progetto',
            'res_model': 'erpv6.project.relay.send.email.wizard',
            'view_mode': 'form',
            'target': 'new',
            'context': {'default_project_id': root.id},
        }
