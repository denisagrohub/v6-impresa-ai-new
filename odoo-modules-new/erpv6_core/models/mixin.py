from odoo import api, fields, models


class Erpv6VersionMixin(models.AbstractModel):
    _name = 'erpv6.version.mixin'
    _description = 'Mixin per versionamento documenti'

    version = fields.Integer(default=1, readonly=True, copy=False)
    change_notes = fields.Text(string='Note Modifica')
    author_id = fields.Many2one(
        'res.users', string='Autore',
        default=lambda self: self.env.user, readonly=True,
    )
    version_history = fields.Text(string='Storico Versioni', readonly=True)

    def _increment_version(self, notes=None):
        for rec in self:
            new_version = rec.version + 1
            history = rec.version_history or ''
            if notes:
                history += f"v{new_version}: {notes}\n"
            rec.write({
                'version': new_version,
                'change_notes': notes,
                'version_history': history,
            })
