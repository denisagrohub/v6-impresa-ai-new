# pylint: disable=import-error
"""Stato lettura per-utente di un'email di progetto.

02/10/2026 (C2-rd): erpv6.project.email.log non ha `is_read` (è un log
grezzo condiviso). Ogni utente che ha accesso alla casella progetto-*
vede la stessa lista email ma con stato di lettura personale.

Modello: join table email × utente. Lazy: nessuna riga al ricevimento,
una riga nasce al primo mark-read. "Non letta per utente U" = non esiste
riga (email, U).
"""
from odoo import api, fields, models


class Erpv6EmailReadState(models.Model):
    _name = 'erpv6.email.read.state'
    _description = 'Stato lettura email di progetto per utente'
    _order = 'read_at desc'

    project_email_id = fields.Many2one(
        'erpv6.project.email.log',
        string='Email',
        required=True,
        ondelete='cascade',
        index=True,
    )
    user_id = fields.Many2one(
        'res.users',
        string='Utente',
        required=True,
        ondelete='cascade',
        index=True,
        default=lambda self: self.env.user,
    )
    read_at = fields.Datetime(
        string='Letta il',
        required=True,
        default=fields.Datetime.now,
    )

    _sql_constraints = [
        ('email_user_uniq',
         'unique(project_email_id, user_id)',
         'Un utente può avere una sola lettura per email.'),
    ]
