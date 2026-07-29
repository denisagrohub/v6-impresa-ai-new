from odoo import models, fields, api, _
from odoo.exceptions import UserError
import logging

_logger = logging.getLogger(__name__)

class CrmLead(models.Model):
    _inherit = 'crm.lead'

    # Campi Fenice AI
    x_fenice_score = fields.Integer(string='Fenice Score', tracking=True)
    x_fenice_livello = fields.Selection([
        ('I', 'Livello I - Terre Venete'),
        ('II', 'Livello II - Serenissima'),
        ('III', 'Livello III - Leone di San Marco'),
        ('IV', 'Livello IV - Fenice'),
    ], string='Livello Fenice', tracking=True)
    x_fenice_moduli_interesse = fields.Char(string='Moduli di Interesse')
    x_fenice_fatturato = fields.Integer(string='Fatturato Stimato (€)')
    x_fenice_source = fields.Selection([
        ('sito_web', 'Sito Web (Fenice AI)'),
        ('fiera', 'Fiera'),
        ('passaparola', 'Passaparola'),
        ('altro', 'Altro'),
    ], string='Origine Lead', default='sito_web')
    
    # Campi Funnel
    x_funnel_stage = fields.Selection([
        ('not_started', 'Non Iniziato'),
        ('email_1_sent', 'Email 1 Inviata'),
        ('email_2_sent', 'Email 2 Inviata'),
        ('email_3_sent', 'Email 3 Inviata'),
        ('email_4_sent', 'Email 4 Inviata'),
        ('email_5_sent', 'Email 5 Inviata'),
        ('completed', 'Completato'),
        ('opt_out', 'Opt-out'),
    ], string='Stato Funnel', default='not_started', tracking=True)
    
    x_funnel_next_email_date = fields.Datetime(string='Prossima Email')
    x_funnel_emails_sent = fields.Integer(string='Email Inviate', default=0)
    x_funnel_last_email_date = fields.Datetime(string='Ultima Email Inviata')
    
    x_fenice_report_sent = fields.Boolean(string='Report PDF Inviato', default=False)

    @api.model
    def create_fenice_lead(self, vals):
        """Crea un lead Fenice da API esterna e avvia il funnel"""
        lead = self.create({
            'name': f"Lead Fenice: {vals.get('azienda', 'Sconosciuto')} - {vals.get('nome', '')}",
            'partner_name': vals.get('azienda', ''),
            'contact_name': vals.get('nome', ''),
            'email_from': vals.get('email', ''),
            'phone': vals.get('telefono', ''),
            'description': f"Lead generato da Fenice AI. Score: {vals.get('score', 0)}. Livello: {vals.get('livello', 'N/A')}. Moduli: {vals.get('moduli', 'N/A')}.",
            'x_fenice_score': vals.get('score', 0),
            'x_fenice_livello': vals.get('livello', 'I'),
            'x_fenice_moduli_interesse': vals.get('moduli', ''),
            'x_fenice_fatturato': vals.get('fatturato', 0),
            'x_fenice_source': 'sito_web',
            'type': 'opportunity',
        })
        lead._start_funnel()
        return lead

    def _start_funnel(self):
        self.ensure_one()
        if self.x_funnel_stage != 'not_started': return
        self.write({'x_funnel_stage': 'email_1_sent', 'x_funnel_next_email_date': fields.Datetime.now()})
        self._send_funnel_email(1)

    def _send_funnel_email(self, step_number):
        self.ensure_one()
        template = self.env['mail.template'].search([
            ('model_id.model', '=', 'crm.lead'),
            ('subject', 'ilike', f'[Fenice AI] Step {step_number}'),
        ], limit=1)
        if not template: return
        try:
            template.send_mail(self.id, force_send=True)
            self.write({
                'x_funnel_emails_sent': self.x_funnel_emails_sent + 1,
                'x_funnel_last_email_date': fields.Datetime.now(),
                'x_fenice_report_sent': True if step_number == 1 else self.x_fenice_report_sent,
            })
        except Exception as e:
            _logger.error(f"Errore invio email step {step_number}: {str(e)}")

    def action_send_funnel_email_manual(self):
        self.ensure_one()
        stage_map = {'not_started': 1, 'email_1_sent': 2, 'email_2_sent': 3, 'email_3_sent': 4, 'email_4_sent': 5}
        next_step = stage_map.get(self.x_funnel_stage)
        if not next_step: raise UserError(_("Il funnel è già completato."))
        self._send_funnel_email(next_step)
        stage_names = {1: 'email_1_sent', 2: 'email_2_sent', 3: 'email_3_sent', 4: 'email_4_sent', 5: 'email_5_sent'}
        self.write({'x_funnel_stage': stage_names[next_step]})

    def action_generate_fenice_report(self):
        self.ensure_one()
        return self.env.ref('fenice_lead_automation.action_report_fenice_score').report_action(self)
