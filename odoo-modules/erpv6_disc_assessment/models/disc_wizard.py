import json

from odoo import fields, models

# Denis, 30/08/2026, prompt #21: banco domande campione (8, non il
# questionario definitivo -- quello e' lavoro successivo). Le opzioni di
# ogni domanda del wizard DEVONO combaciare esattamente con le chiavi
# dichiarate nella KB (data/kb_disc_assessment_data.xml) -- stesso
# contenuto, non duplicato per caso: se cambia la KB, questo elenco va
# aggiornato insieme (nessun meccanismo automatico di sync in questo
# prompt, e' un wizard minimo per il test, non l'interfaccia definitiva).
QUESTIONS = [
    ('q1', "Quando affronto un nuovo progetto di lavoro, la mia prima reazione è:", [
        ('a', "Definire subito obiettivi e tempistiche chiare"),
        ('b', "Condividere l'idea con i colleghi per generare entusiasmo"),
        ('c', "Capire come si inserisce nelle attività già in corso"),
        ('d', "Raccogliere tutte le informazioni prima di iniziare"),
    ]),
    ('q2', "In una discussione di gruppo dove ci sono opinioni diverse:", [
        ('a', "Prendo posizione e spingo per una decisione rapida"),
        ('b', "Cerco di alleggerire il clima e trovare un terreno comune"),
        ('c', "Aspetto che tutti si esprimano prima di dire la mia"),
        ('d', "Valuto i pro e i contro di ogni proposta con attenzione"),
    ]),
    ('q3', "Di fronte a un imprevisto urgente sul lavoro:", [
        ('a', "Agisco subito, decido e correggo strada facendo"),
        ('b', "Coinvolgo altri per trovare insieme una soluzione"),
        ('c', "Mantengo la calma e procedo con ordine, un passo alla volta"),
        ('d', "Analizzo la causa prima di intervenire"),
    ]),
    ('q4', "Il mio stile di comunicazione preferito è:", [
        ('a', "Diretto ed essenziale"),
        ('b', "Espressivo e coinvolgente"),
        ('c', "Paziente e disponibile all'ascolto"),
        ('d', "Preciso e basato sui dati"),
    ]),
    ('q5', "Quando ricevo una critica sul mio lavoro:", [
        ('a', "La accolgo se porta a risultati migliori, senza troppi giri"),
        ('b', "Preferisco parlarne di persona per chiarire subito"),
        ('c', "Ci penso con calma prima di rispondere"),
        ('d', "Chiedo dettagli specifici per capire esattamente cosa correggere"),
    ]),
    ('q6', "Nella pianificazione del mio lavoro settimanale:", [
        ('a', "Punto ai risultati principali, i dettagli si sistemano dopo"),
        ('b', "Lascio spazio a imprevisti e opportunità che emergono"),
        ('c', "Seguo una routine stabile che conosco bene"),
        ('d', "Pianifico ogni fase in anticipo con precisione"),
    ]),
    ('q7', "Cosa mi motiva di più in un ambiente di lavoro:", [
        ('a', "Vincere sfide e raggiungere obiettivi ambiziosi"),
        ('b', "Il riconoscimento e le relazioni positive con i colleghi"),
        ('c', "Stabilità e un clima di squadra sereno"),
        ('d', "Fare le cose nel modo corretto, senza errori"),
    ]),
    ('q8', "Se un collega non rispetta una scadenza condivisa:", [
        ('a', "Lo affronto direttamente e chiedo spiegazioni immediate"),
        ('b', "Ne parlo con un tono positivo, cercando di capire cosa è successo"),
        ('c', "Aspetto un momento opportuno per parlargliene con calma"),
        ('d', "Verifico prima i fatti e la documentazione prima di dire qualcosa"),
    ]),
]


class Erpv6DiscAssessmentWizard(models.TransientModel):
    _name = 'erpv6.disc.assessment.wizard'
    _description = "Intervista DISC (Fase A -- autovalutazione, prompt #21)"

    q1 = fields.Selection(QUESTIONS[0][2], string=QUESTIONS[0][1], required=True)
    q2 = fields.Selection(QUESTIONS[1][2], string=QUESTIONS[1][1], required=True)
    q3 = fields.Selection(QUESTIONS[2][2], string=QUESTIONS[2][1], required=True)
    q4 = fields.Selection(QUESTIONS[3][2], string=QUESTIONS[3][1], required=True)
    q5 = fields.Selection(QUESTIONS[4][2], string=QUESTIONS[4][1], required=True)
    q6 = fields.Selection(QUESTIONS[5][2], string=QUESTIONS[5][1], required=True)
    q7 = fields.Selection(QUESTIONS[6][2], string=QUESTIONS[6][1], required=True)
    q8 = fields.Selection(QUESTIONS[7][2], string=QUESTIONS[7][1], required=True)

    result_disc = fields.Selection([
        ('D', 'D — Dominante'), ('I', 'I — Influente'),
        ('S', 'S — Stabile'), ('C', 'C — Coscienzioso'),
    ], readonly=True, copy=False)
    result_scores_display = fields.Char(readonly=True, copy=False, string='Punteggi')

    def action_submit(self):
        """Chiama DAVVERO il nodo AEOSv6 (run_process()), stesso principio
        gia' verificato su erpv6_color/erpv6_tracking: il wizard non
        calcola nulla da solo, passa le risposte al Motore e legge il
        risultato. binding_record_id=self.env.user.id: il dipendente
        scrive il proprio risultato su se stesso (nessun admin lo impone,
        principio deciso in precedenza in questa conversazione).
        disc_profile viene scritto dall'Output Binding del nodo (non da
        qui); disc_scores resta un secondo campo esplicito (stesso motivo
        gia' verificato in erpv6_tracking, prompt #17: l'Output Binding
        scrive un solo campo scalare per costruzione, non due)."""
        self.ensure_one()
        answers = {qid: getattr(self, qid) for qid, _label, _opts in QUESTIONS}
        node = self.env.ref('erpv6_disc_assessment.node_disc_interview_score')
        execution = node.run_process({'answers': answers, 'binding_record_id': self.env.user.id})
        self.env.user.write({'disc_scores': execution.output_data['scores']})
        self.write({
            'result_disc': execution.output_data['disc'],
            'result_scores_display': json.dumps(execution.output_data['scores']),
        })
        return {
            'type': 'ir.actions.act_window',
            'res_model': 'erpv6.disc.assessment.wizard',
            'res_id': self.id,
            'view_mode': 'form',
            'target': 'new',
        }
