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
    def action_create_subproject(self, parent_id, name,
                                 kind='sotto_progetto',
                                 email_alias=None,
                                 pipeline_template=None):
        """Crea un sotto-progetto figlio del nodo padre.
        Generalizzato da action_start_acquisition (17/09/2026).
        - 'kind' classifica il figlio (sotto_progetto / pipeline / parte)
        - 'pipeline_template' opzionale: se 'acquisition', clona le fasi
          default di acquisizione sul figlio appena creato.
        Solo su progetti RADICE: la gerarchia e' a 2 livelli.
        """
        parent = self.browse(parent_id)
        if not parent.exists():
            raise ValueError('Progetto padre non trovato')
        if parent.parent_id:
            raise ValueError(
                'Un sotto-progetto va creato solo su un progetto radice')

        child = self.create({
            'name': name,
            'parent_id': parent_id,
            'child_kind': kind,
            'email_alias': email_alias or False,
        })

        if pipeline_template == 'acquisition':
            Stage = self.env['erpv6.acquisition.stage']
            Stage.search([('relation_id', '=', child.id)]).unlink()
            for sname, seq, won, lost in DEFAULT_STAGES:
                Stage.create({
                    'name': sname, 'sequence': seq,
                    'relation_id': child.id,
                    'is_won': won, 'is_lost': lost,
                })

        return {'child_id': child.id, 'name': child.name, 'kind': kind}

    @api.model
    def action_start_acquisition(self, parent_id, name, email_alias=None):
        """Wrapper retrocompatibile (Denis, 14/09/2026).
        Chiamato dalla route /start-acquisition esistente.
        """
        return self.action_create_subproject(
            parent_id, name,
            kind='sotto_progetto',
            email_alias=email_alias,
            pipeline_template='acquisition',
        )
