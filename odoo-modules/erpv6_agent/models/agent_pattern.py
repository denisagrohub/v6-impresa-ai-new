from odoo import fields, models


class Erpv6AgentPattern(models.Model):
    """Un pattern e' una FORMA di esecuzione gia' pronta e collaudata, non
    codice da scrivere per ogni nuovo agente. Oggi esiste un solo pattern
    reale ('text_proposal', generalizzato da Kaizen il 20/08/2026 su
    richiesta esplicita dell'utente: "Thor sceglie tra i pattern gia'
    pronti e li configura da solo"). Un agente 'text_proposal' non ha
    bisogno di NESSUN codice Python nuovo: legge istruzioni da una
    categoria KB, legge il contesto/fatti attuali da un'altra categoria KB,
    chiama l'AI, salva sempre in attesa di gate umano -- vedi
    erpv6.agent.config._run_generic_text_proposal. Un pattern che serve
    solo a dare una PERSONA a un flusso Odoo gia' esistente (es. Sabrina sul
    flusso kb_case_study) o un pattern che lancia un processo esterno vero
    (Claudio, Claude Code headless) sono forme radicalmente diverse, NON
    coperte da questo pattern -- da aggiungere come pattern separati quando
    si costruiscono davvero, mai forzati dentro questo."""
    _name = 'erpv6.agent.pattern'
    _description = 'Pattern di Esecuzione Agente'
    _order = 'name'

    name = fields.Char(required=True)
    code = fields.Char(required=True, help="Slug tecnico stabile, es. 'text_proposal'.")
    description = fields.Text()
    requires_context_category = fields.Boolean(
        default=True,
        help="Se vero, un agente con questo pattern ha bisogno anche di una categoria KB di "
             "contesto/fatti attuali, non solo di istruzioni.",
    )

    _sql_constraints = [
        ('uniq_code', 'UNIQUE(code)', "Esiste gia' un pattern con questo codice."),
    ]
