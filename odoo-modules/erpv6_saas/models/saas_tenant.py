from odoo import models, fields, api, _
from odoo.exceptions import ValidationError
from datetime import datetime
import logging

_logger = logging.getLogger(__name__)


class Erpv6SaasTenant(models.Model):
    _name = 'erpv6.saas.tenant'
    _description = 'ERP V6 SaaS Tenant'
    _inherit = ['mail.thread']

    name = fields.Char(string='Nome', required=True, compute='_compute_name', store=True)
    partner_id = fields.Many2one('res.partner', string='Cliente', required=True, tracking=True)
    verticale = fields.Char(string='Verticale', required=True, tracking=True)
    api_key_id = fields.Many2one('erpv6.api.key', string='API Key', required=True, tracking=True)
    subscription_status = fields.Selection([
        ('trial', 'Trial'),
        ('active', 'Attivo'),
        ('expired', 'Scaduto'),
        ('cancelled', 'Cancellato')
    ], string='Stato Sottoscrizione', default='trial', required=True, tracking=True)
    subscription_expires_at = fields.Datetime(string='Scadenza Sottoscrizione', tracking=True)
    setup_fee_paid = fields.Boolean(string='Quota Setup Pagata', default=False, tracking=True)
    trial_ends_at = fields.Datetime(string='Scadenza Trial', tracking=True)
    notes = fields.Text(string='Note')
    active = fields.Boolean(default=True)

    @api.depends('partner_id')
    def _compute_name(self):
        for record in self:
            record.name = record.partner_id.name if record.partner_id else _('Nuovo Tenant')

    @api.model
    def _cron_sync_subscription_status(self):
        """
        Cron giornaliero per sincronizzare lo stato delle sottoscrizioni.
        - Imposta 'expired' e disattiva api_key per tenant attivi/trial scaduti
        """
        now = fields.Datetime.now()
        
        # Cerca tenant attivi scaduti
        expired_active = self.search([
            ('subscription_status', '=', 'active'),
            ('subscription_expires_at', '<', now)
        ])
        for tenant in expired_active:
            _logger.info(f"Tenant {tenant.name}: sottoscrizione scaduta, impostazione stato expired")
            tenant.subscription_status = 'expired'
            if tenant.api_key_id:
                tenant.api_key_id.is_active = False
        
        # Cerca tenant trial scaduti
        expired_trial = self.search([
            ('subscription_status', '=', 'trial'),
            ('trial_ends_at', '<', now)
        ])
        for tenant in expired_trial:
            _logger.info(f"Tenant {tenant.name}: trial scaduto, impostazione stato expired")
            tenant.subscription_status = 'expired'
            if tenant.api_key_id:
                tenant.api_key_id.is_active = False
        
        _logger.info(f"Cron sync completato: {len(expired_active)} attivi scaduti, {len(expired_trial)} trial scaduti")
