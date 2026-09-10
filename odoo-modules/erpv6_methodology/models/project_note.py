from odoo import api, fields, models


class Erpv6ProjectNote(models.Model):
    """Lavagna di lavoro per un progetto (10/09/2026, Denis: 'una cosa
    che ho notato che manca in tutti i progetti una lavagna di lavoro
    sia per appuntare i brief e debrief ma anche note e informazioni').

    res_model/res_id polimorfico (stesso pattern gia' in uso da
    erpv6.kairos.matrix ed erpv6.heinrich.indicator in questo stesso
    modulo) - una lavagna unica riusabile sia per erpv6.tracking.relation
    (Progetti Partner, es. Progetto TEE) sia per erpv6.production.order
    (Progetti), invece di due modelli quasi identici.

    Non e' un chatter/mail.thread: quello logga anche i cambi di campo
    automatici (rumore), qui invece solo cio' che una persona ha
    deciso di scrivere - un brief, un debrief, una nota libera."""
    _name = 'erpv6.project.note'
    _description = 'Nota/Brief/Debrief di progetto'
    # 10/09/2026 (Denis: "posso modificare l'ordine prendendoli con il
    # mouse"): sequence prima di create_date - senza un ordine manuale
    # esplicito, il drag&drop lato frontend non avrebbe nessun campo
    # reale su cui salvare la nuova posizione (create_date da solo non
    # e' riordinabile a mano).
    _order = 'sequence, create_date desc'

    res_model = fields.Char(string='Modello Collegato', required=True, index=True)
    res_id = fields.Integer(string='ID Record', required=True, index=True)

    note_type = fields.Selection([
        ('brief', 'Brief'),
        ('debrief', 'Debrief'),
        ('nota', 'Nota'),
    ], string='Tipo', required=True, default='nota')

    title = fields.Char(string='Titolo')
    body = fields.Text(string='Contenuto', required=True)
    author_id = fields.Many2one('res.users', string='Autore', default=lambda self: self.env.user, required=True)
    sequence = fields.Integer(default=10)

    @api.model
    def get_board(self, res_model, res_id):
        notes = self.search([('res_model', '=', res_model), ('res_id', '=', res_id)])
        return [{
            'id': n.id,
            'note_type': n.note_type,
            'title': n.title or '',
            'body': n.body,
            'author': n.author_id.name,
            'create_date': n.create_date.isoformat() if n.create_date else False,
            'sequence': n.sequence,
        } for n in notes]

    @api.model
    def reorder(self, ordered_ids):
        """Riscrive sequence in base al nuovo ordine passato dal drag&drop
        lato frontend - un multiplo di 10 per lasciare spazio a
        inserimenti futuri senza dover risequenziare tutto ogni volta."""
        for position, note_id in enumerate(ordered_ids):
            self.browse(note_id).sudo().write({'sequence': (position + 1) * 10})
        return True
