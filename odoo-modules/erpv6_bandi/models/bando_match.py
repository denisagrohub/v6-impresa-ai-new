# -*- coding: utf-8 -*-
from odoo import models, fields, api, _
import logging

_logger = logging.getLogger(__name__)


class Erpv6BandoMatch(models.Model):
    _name = 'erpv6.bando.match'
    _description = 'Match Bando-Cliente'
    _order = 'eligibility_score DESC, create_date DESC'
    _inherit = ['erpv6.core.tracked']

    bando_id = fields.Many2one('erpv6.bando', string='Bando', required=True, ondelete='cascade')
    partner_id = fields.Many2one('res.partner', string='Cliente', required=True, ondelete='cascade')
    project_id = fields.Many2one('crm.lead', string='Progetto')
    eligibility_score = fields.Float(string='Punteggio Eligibilità', digits=(5, 2))
    eligibility_level = fields.Selection([
        ('high', 'Alta (>80%)'),
        ('medium', 'Media (60-80%)'),
        ('low', 'Bassa (<60%)'),
    ], string='Livello Eligibilità', compute='_compute_eligibility_level', store=True)
    motivi_compatibilita = fields.Text(string='Motivi Compatibilità')
    motivi_esclusione = fields.Text(string='Motivi Esclusione')
    importo_stimato = fields.Monetary(string='Importo Stimato', currency_field='currency_id')
    currency_id = fields.Many2one('res.currency', default=lambda self: self.env.company.currency_id)
    status = fields.Selection([
        ('new', 'Nuovo'),
        ('notified', 'Notificato'),
        ('interested', 'Interessato'),
        ('applied', 'Candidato'),
        ('rejected', 'Respinto'),
        ('won', 'Vinto'),
    ], string='Stato', default='new', tracking=True)
    consultant_id = fields.Many2one('res.partner', string='Consulente', 
                                     domain=[('is_consultant', '=', True)])
    notified_at = fields.Datetime(string='Notificato il')
    deadline_interna = fields.Date(string='Deadline Interna')

    @api.depends('eligibility_score')
    def _compute_eligibility_level(self):
        for record in self:
            if record.eligibility_score >= 80:
                record.eligibility_level = 'high'
            elif record.eligibility_score >= 60:
                record.eligibility_level = 'medium'
            else:
                record.eligibility_level = 'low'

    def action_notify_consultant(self):
        """Invia email al consulente"""
        self.ensure_one()
        if not self.consultant_id or not self.consultant_id.email:
            raise UserError(_('Consulente senza email configurata'))
        
        template = self.env.ref('erpv6_bandi.mail_template_bando_match')
        template.send_mail(self.id, force_send=True)
        self.status = 'notified'
        self.notified_at = fields.Datetime.now()
        return True

    def action_mark_interested(self):
        """Segna come interessato"""
        self.ensure_one()
        self.status = 'interested'
        return True

    def action_create_application(self):
        """Crea candidatura"""
        self.ensure_one()
        application = self.env['erpv6.bando.application'].create({
            'match_id': self.id,
            'bando_id': self.bando_id.id,
            'partner_id': self.partner_id.id,
            'amount_requested': self.importo_stimato,
        })
        self.status = 'applied'
        return {
            'type': 'ir.actions.act_window',
            'name': _('Candidatura'),
            'res_model': 'erpv6.bando.application',
            'view_mode': 'form',
            'res_id': application.id,
        }

    def _compute_eligibility(self):
        """Calcola score di elegibilità"""
        # Questa logica verrà implementata con l'integrazione completa
        pass
