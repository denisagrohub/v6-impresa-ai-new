# pylint: disable=import-error
"""13/10/2026 (C-orchestrator-1): ricalcolo x_v6_project_id.

Dopo l'estensione del compute _compute_x_v6_project ai log legacy
(erpv6.winwin.email.log, erpv6.project.email.log), forza il ricalcolo
sui record esistenti. Senza questa migration, i record creati prima
del cambio compute restano con x_v6_project_id=False (Odoo non
ricalcola i computed stored se 'depends' non cambia sui record
esistenti).

Batch da 500 per non saturare la memoria: mail.message puo' contenere
migliaia di record (7514 al 13/10/2026).
"""
from odoo import api, SUPERUSER_ID


def migrate(cr, version):
    env = api.Environment(cr, SUPERUSER_ID, {})
    M = env['mail.message']
    msgs = M.search([('model', 'in', [
        'erpv6.tracking.relation',
        'erpv6.winwin.email.log',
        'erpv6.project.email.log',
    ])])
    BATCH = 500
    for i in range(0, len(msgs), BATCH):
        chunk = msgs[i:i + BATCH]
        env.add_to_compute(M._fields['x_v6_project_id'], chunk)
        env.flush_all()
    env.cr.commit()
