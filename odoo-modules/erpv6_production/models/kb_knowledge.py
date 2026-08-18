from odoo import models


class Erpv6KnowledgeBase(models.Model):
    """Estende erpv6.kb (definito in erpv6_kb, motore generico che NON deve
    sapere nulla di supervisori/secondo gate) con la sola risoluzione del
    supervisore KB -- riusata da validation_session.py/action_supervisor_approve."""
    _name = 'erpv6.kb'
    _inherit = 'erpv6.kb'

    def _resolve_kb_supervisor(self):
        """Utente supervisore responsabile del secondo gate di approvazione
        (vedi validation_session.py/action_supervisor_approve): sempre il
        referente KB globale (user_id del lead fisso 'Amministrazione KB',
        vedi data/kb_admin_lead_data.xml), non il commerciale del cliente --
        stesso referente sia per le voci da documenti piccoli/wizard
        manuale (nessun progetto dedicato) sia per quelle da documenti
        grandi con un project.project proprio (vedi
        library_document.py/_ensure_kb_project). Ritorna un recordset
        res.users vuoto (falsy) se il lead non esiste ancora (modulo non
        aggiornato) invece di sollevare un errore -- il chiamante decide
        come trattare l'assenza di un supervisore configurato."""
        self.ensure_one()
        kb_admin_lead = self.env.ref('erpv6_production.crm_lead_kb_admin', raise_if_not_found=False)
        return kb_admin_lead.user_id if kb_admin_lead else self.env['res.users']
