from odoo import api, models


DEFAULT_STAGES = [
    ('Nuova', 10, False, False),
    ('Contattata', 20, False, False),
    ('In attesa risposta', 30, False, False),
    ('Ha risposto', 40, False, False),
    ('Interessata', 50, False, False),
    ('Non interessata', 60, False, True),
    ('Charter inviato', 70, False, False),
    ('Partner', 80, True, False),
]


class Erpv6TrackingRelationAcquisition(models.Model):
    _inherit = 'erpv6.tracking.relation'

    @api.model
    def action_start_acquisition(self, parent_id, name, email_alias=None):
        """Crea il progetto figlio 'acquisizione' con fasi default clonate.
        Chiamato dal pulsante Avvia Acquisizione (Denis, 14/09/2026)."""
        parent = self.browse(parent_id)
        if parent.parent_id:
            raise ValueError('Il progetto di acquisizione va creato su un progetto padre')
        child = self.create({
            'name': name,
            'parent_id': parent_id,
            'email_alias': email_alias or False,
        })
        Stage = self.env['erpv6.acquisition.stage']
        Stage.search([('relation_id', '=', child.id)]).unlink()
        for sname, seq, won, lost in DEFAULT_STAGES:
            Stage.create({
                'name': sname, 'sequence': seq,
                'relation_id': child.id,
                'is_won': won, 'is_lost': lost,
            })
        return {'child_id': child.id, 'name': child.name}
