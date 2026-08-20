from odoo import _, models
from odoo.exceptions import UserError


class Erpv6KnowledgeBase(models.Model):
    """Estende erpv6.kb (definito in erpv6_kb, motore generico che NON deve
    sapere nulla di supervisori/secondo gate) con la risoluzione del
    supervisore KB e con la validazione in blocco dalla lista Knowledge Base
    -- riusata da validation_session.py/action_supervisor_approve."""
    _name = 'erpv6.kb'
    _inherit = 'erpv6.kb'

    def action_validate_selected(self):
        """Bottone in blocco dalla lista Knowledge Base (menu 'Knowledge
        Base -> Articoli', dove l'utente naviga davvero le voci KB) per
        validarne piu' insieme -- segnalato dal vivo dall'utente il
        20/08/2026: il bottone 'Valida' esisteva gia' solo sulla sessione di
        validazione (menu tecnico separato 'Validazione (6 Giudici) ->
        Sessioni'), poco naturale da qui. Risale alla sessione di
        validazione piu' recente di ciascuna KB selezionata e le valida
        tutte insieme con action_validate_kb (stesso bottone unico gia'
        costruito sulla sessione, stessi controlli/gate)."""
        Session = self.env['erpv6.validation.session']
        sessions = Session
        for kb in self:
            session = Session.search([
                ('res_model', '=', 'erpv6.kb'), ('res_id', '=', kb.id),
                ('status', 'in', ('converged', 'escalated_to_human', 'human_reviewed')),
            ], order='id desc', limit=1)
            if session:
                sessions |= session
        if not sessions:
            raise UserError(_(
                "Nessuna delle voci selezionate ha una sessione di validazione pronta "
                "(serve stato 'Convergenza Raggiunta', 'Escalation Umana' o 'Revisionato')."
            ))
        sessions.action_validate_kb()

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
