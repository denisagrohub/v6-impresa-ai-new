from odoo import fields, models


class ResUsersDiscExt(models.Model):
    """Estende res.users -- il "dipendente" oggi in questo sistema (Denis,
    30/08/2026, Fase 0 del prompt #21: nessun modulo HR installato, nessun
    modello erpv6 dedicato trovato; res.users e' gia' la rappresentazione
    reale di una persona interna, vedi erpv6_production/models/res_users.py
    per il consulente -- estensione SEPARATA e indipendente, non tocca
    quel file). Campo scrivibile dal dipendente stesso, mai imposto da
    un amministratore (principio deciso in precedenza in questa
    conversazione) -- nessuna regola di sola-lettura qui, l'Output
    Binding scrive sul record dell'utente che ha lanciato l'intervista
    su se stesso (vedi disc_wizard.py)."""
    _inherit = 'res.users'

    disc_profile = fields.Selection([
        ('D', 'D — Dominante'),
        ('I', 'I — Influente'),
        ('S', 'S — Stabile'),
        ('C', 'C — Coscienzioso'),
    ], string='Profilo DISC', copy=False,
        help="Risultato dell'intervista DISC (Motore 'disc_interview_score'), scritto "
             "via Output Binding -- mai impostato a mano, sempre il risultato di "
             "un'esecuzione reale tracciata in erpv6.core.node.execution/gate.log.")
    disc_scores = fields.Json(
        string='Punteggi DISC (dettaglio)', copy=False,
        help="Conteggio per lettera dell'ultima intervista DISC completata -- stesso "
             "output_data del Motore, solo per trasparenza (mai ricalcolato qui).")
