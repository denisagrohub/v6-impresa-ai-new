import json

from odoo import _, api, fields, models
from odoo.exceptions import UserError


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
        # 10/09/2026 (Denis: "dare in pasto a metodology tutta la lavagna
        # e avere un responso") - post-it generato da analyze_board()
        # sotto, mai scritto da una persona: colore/badge dedicato lato
        # frontend per distinguerlo a colpo d'occhio dagli altri.
        ('analisi', 'Analisi Metodologica'),
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
    def analyze_board(self, res_model, res_id):
        """Motore generico (Denis, 10/09/2026: "dare in pasto a metodology
        tutta la lavagna e avere un responso") - legge tutte le note
        scritte finora su UN progetto e chiede un'analisi attraverso
        Kairós/Pareto/5S (istruzioni reali in
        kb_metodo_analisi_lavagna_data.xml, stesso schema KB+AI di ogni
        altro "metodo" del sistema), poi APPENDE il risultato come un
        nuovo post-it (note_type='analisi') - resta parte della lavagna
        stessa, mai un documento separato da cercare altrove."""
        notes = self.search([('res_model', '=', res_model), ('res_id', '=', res_id)], order='sequence, create_date desc')
        source_notes = notes.filtered(lambda n: n.note_type != 'analisi')
        if not source_notes:
            raise UserError(_("La lavagna è vuota: scrivi almeno una nota, un brief o un debrief prima di chiedere un'analisi."))

        board_text = "\n\n".join(
            "[%s] %s\n%s\n(%s, %s)" % (
                n.note_type, n.title or '(senza titolo)', n.body, n.author_id.name,
                n.create_date.strftime('%d/%m/%Y %H:%M') if n.create_date else '')
            for n in source_notes
        )

        context_bits = []
        kairos = self.env['erpv6.kairos.matrix'].search(
            [('res_model', '=', res_model), ('res_id', '=', res_id)], limit=1, order='id desc')
        if kairos:
            context_bits.append("Kairós: quadrante %s, prontezza %s, impatto %s" % (
                kairos.quadrante, kairos.prontezza_level, kairos.impatto_level))
        # Soft-optional (erpv6_methodology non dipende da erpv6_production):
        # stesso pattern gia' in uso in erpv6_agent.agent_config._compute_live_briefing.
        if res_model == 'erpv6.production.order' and res_model in self.env:
            order = self.env[res_model].browse(res_id)
            if order.exists():
                for fname, label in [
                    ('interview_tipo_progetto', 'Tipo progetto'), ('interview_budget', 'Budget'),
                    ('interview_tempistiche', 'Tempistiche'), ('interview_destinatario', 'Destinatario'),
                ]:
                    val = getattr(order, fname, False)
                    if val:
                        context_bits.append("%s: %s" % (label, val))
        context_text = "\n".join(context_bits) if context_bits else '(nessun dato aggiuntivo disponibile)'

        bridge = self.env['erpv6.omni.bridge']
        kb = self.env.ref('erpv6_methodology.kb_metodo_analisi_lavagna', raise_if_not_found=False)
        instructions = kb.content if kb else ''
        result = bridge.execute_ai_task(
            task_type='methodology_board_analysis',
            payload={
                'temperature': 0.3,
                'messages': [
                    {'role': 'system', 'content': instructions},
                    {'role': 'user', 'content': "CONTESTO:\n%s\n\nLAVAGNA DI LAVORO:\n%s" % (context_text, board_text)},
                ],
            },
            context={'source': 'erpv6_methodology:analyze_board', 'res_model': res_model, 'res_id': res_id},
        )
        if not result.get('success'):
            raise UserError(_("Analisi non riuscita: %s") % (result.get('error') or _('errore sconosciuto')))
        try:
            content = result['data']['choices'][0]['message']['content']
            parsed = json.loads(content)
        except (KeyError, IndexError, TypeError, json.JSONDecodeError) as e:
            raise UserError(_("Risposta dell'analisi in formato inatteso: %s") % e)

        lines = []
        punti = parsed.get('punti_chiave_pareto') or []
        if punti:
            lines.append(_("PUNTI CHIAVE (Pareto):\n") + "\n".join("- %s" % p for p in punti))
        if parsed.get('coerenza_kairos'):
            lines.append(_("COERENZA KAIRÓS:\n%s") % parsed['coerenza_kairos'])
        rischi = parsed.get('rischi_o_blocchi') or []
        if rischi:
            lines.append(_("RISCHI/BLOCCHI:\n") + "\n".join("- %s" % r for r in rischi))
        if parsed.get('prossimo_passo_consigliato'):
            lines.append(_("PROSSIMO PASSO CONSIGLIATO:\n%s") % parsed['prossimo_passo_consigliato'])
        if parsed.get('flagged_missing_data'):
            lines.append(_("DATI MANCANTI:\n%s") % parsed['flagged_missing_data'])
        body = "\n\n".join(lines) or _("Analisi completata, nessun dettaglio disponibile.")

        self.create({
            'res_model': res_model, 'res_id': res_id, 'note_type': 'analisi',
            'title': _("Analisi Metodologica"), 'body': body,
        })
        return self.get_board(res_model, res_id)

    @api.model
    def reorder(self, ordered_ids):
        """Riscrive sequence in base al nuovo ordine passato dal drag&drop
        lato frontend - un multiplo di 10 per lasciare spazio a
        inserimenti futuri senza dover risequenziare tutto ogni volta."""
        for position, note_id in enumerate(ordered_ids):
            self.browse(note_id).sudo().write({'sequence': (position + 1) * 10})
        return True
