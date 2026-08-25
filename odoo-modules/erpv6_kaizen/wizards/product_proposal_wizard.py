from odoo import _, fields, models


class Erpv6KaizenProductProposalWizard(models.TransientModel):
    """Bottone 'Proponi Nuovo Prodotto' per un Consulente (Compito
    "wizard-prodotto-consulenza", 25/08/2026): un Consulente NON crea mai
    un erpv6.prodotto.consulenza direttamente (solo Admin/Responsabile,
    vedi RESPONSABILE_GROUPS in
    erpv6_production/models/consulente_assignment.py) - puo' solo
    PROPORRE l'idea, riusando il meccanismo di segnalazione manuale gia'
    esistente (erpv6.kaizen.manual_report), esattamente come richiesto
    esplicitamente da Denis: "non costruirne uno parallelo".

    Nota di design (da confermare con Denis, vedi report finale): il
    campo 'severity' di erpv6.kaizen.manual_report e' pensato per la
    gravita' di un PROBLEMA (near_miss/lieve/grave), non per un'idea di
    prodotto - qui e' usato solo come placeholder ('lieve', il valore
    meno allarmante) per rispettare il campo required senza inventare un
    significato che non c'e'. Se in futuro serve una categoria propria
    per le proposte (opportunita', non problema), andrebbe aggiunta come
    valore Selection dedicato, non forzata dentro la scala di gravita'
    esistente."""
    _name = 'erpv6.kaizen.product.proposal.wizard'
    _description = 'Proponi Nuovo Prodotto (Consulente)'

    production_order_id = fields.Many2one(
        'erpv6.production.order', string='Produzione di riferimento', required=True,
        help="La produzione su cui il Consulente stava lavorando quando ha avuto l'idea - "
             "erpv6.kaizen.manual_report richiede sempre un record reale collegato (regola Kaizen "
             "#4, 'mai una nota libera scollegata').")
    name = fields.Char(string='Nome prodotto proposto', required=True)
    description = fields.Text(string='Descrizione idea', required=True)

    def action_confirm(self):
        self.ensure_one()
        report = self.env['erpv6.kaizen.manual_report'].create({
            'name': _("Proposta nuovo prodotto: %s") % self.name,
            'description': self.description,
            'severity': 'lieve',
            'related_record': '%s,%d' % (self.production_order_id._name, self.production_order_id.id),
        })
        return {
            'type': 'ir.actions.act_window',
            'res_model': 'erpv6.kaizen.manual_report',
            'res_id': report.id,
            'view_mode': 'form',
            'target': 'current',
        }
