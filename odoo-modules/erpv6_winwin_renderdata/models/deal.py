# -*- coding: utf-8 -*-
from odoo import models, fields, api
from odoo.exceptions import UserError


class Erpv6DealSchema(models.Model):
    _name = 'erpv6.deal.schema'
    _description = 'Schema di calcolo deal (registro)'
    _order = 'code, version desc'

    code = fields.Char(required=True, index=True)
    name = fields.Char(required=True)
    deal_type = fields.Selection([
        ('tee', 'TEE'),
        ('cogenerazione', 'Cogenerazione'),
        ('fotovoltaico', 'Fotovoltaico'),
        ('custom', 'Custom'),
    ], required=True)
    version = fields.Integer(default=1)
    active = fields.Boolean(default=True)
    valid_from = fields.Date()
    valid_to = fields.Date()
    locked = fields.Boolean(default=False)
    description = fields.Text()

    _sql_constraints = [
        ('code_version_uniq', 'unique(code, version)',
         'Combinazione codice+versione già esistente'),
    ]


class Erpv6Deal(models.Model):
    _name = 'erpv6.deal'
    _description = 'Deal commerciale con schema parametrico'
    _inherit = ['mail.thread', 'mail.activity.mixin']
    _order = 'create_date desc'

    name = fields.Char(required=True, tracking=True)
    relation_id = fields.Many2one('erpv6.tracking.relation', required=True,
                                   ondelete='restrict', index=True,
                                   string='Progetto')
    parent_deal_id = fields.Many2one('erpv6.deal', string='Deal padre',
                                      ondelete='set null', index=True)
    child_deal_ids = fields.One2many('erpv6.deal', 'parent_deal_id',
                                      string='Deal figli')

    seller_id = fields.Many2one('res.partner', string='Venditore',
                                 ondelete='restrict')
    buyer_id = fields.Many2one('res.partner', string='Compratore',
                                ondelete='restrict')
    seller_is_placeholder = fields.Boolean(
        related='seller_id.is_placeholder', string='Venditore placeholder')
    buyer_is_placeholder = fields.Boolean(
        related='buyer_id.is_placeholder', string='Compratore placeholder')

    schema_id = fields.Many2one('erpv6.deal.schema', required=True,
                                 ondelete='restrict', string='Schema')
    schema_code = fields.Char(related='schema_id.code', store=True)
    schema_version = fields.Integer(related='schema_id.version', store=True)

    state = fields.Selection([
        ('forecasting', 'Previsione'),
        ('negotiating', 'In trattativa'),
        ('frozen', 'Congelato'),
        ('signing', 'In firma'),
        ('active', 'Attivo'),
        ('closed', 'Chiuso'),
        ('cancelled', 'Annullato'),
    ], default='forecasting', required=True, tracking=True, index=True)

    variable_ids = fields.One2many('erpv6.deal.variable', 'deal_id',
                                    string='Variabili')
    participant_ids = fields.One2many('erpv6.deal.participant', 'deal_id',
                                       string='Partecipanti')
    prospetto_ids = fields.One2many('erpv6.deal.prospetto', 'deal_id',
                                     string='Prospetti')

    current_prospetto_id = fields.Many2one('erpv6.deal.prospetto',
                                            string='Prospetto corrente',
                                            ondelete='set null')
    frozen_at = fields.Datetime(readonly=True, tracking=True)
    frozen_by = fields.Many2one('res.users', readonly=True)
    signed_at = fields.Datetime(readonly=True, tracking=True)
    closed_at = fields.Datetime(readonly=True)

    can_freeze = fields.Boolean(compute='_compute_gates', store=False)
    can_sign = fields.Boolean(compute='_compute_gates', store=False)
    missing_critical_count = fields.Integer(compute='_compute_gates',
                                             store=False)

    notes = fields.Text()

    @api.depends('variable_ids.locked', 'variable_ids.is_critical',
                 'state', 'current_prospetto_id',
                 'current_prospetto_id.state')
    def _compute_gates(self):
        for d in self:
            critical = d.variable_ids.filtered('is_critical')
            missing = critical.filtered(lambda v: not v.locked)
            d.missing_critical_count = len(missing)
            d.can_freeze = (
                d.state in ('forecasting', 'negotiating')
                and bool(critical)
                and not missing
            )
            d.can_sign = (
                d.state == 'frozen'
                and bool(d.current_prospetto_id)
                and d.current_prospetto_id.state == 'frozen'
            )

    def action_freeze(self):
        for d in self:
            if not d.can_freeze:
                missing = d.variable_ids.filtered(
                    lambda v: v.is_critical and not v.locked)
                names = ', '.join(missing.mapped('label') or missing.mapped('name'))
                raise UserError(
                    "Impossibile congelare: variabili critiche mancanti: %s" % names)
            prospetto = d._generate_prospetto(freeze=True)
            d.write({
                'state': 'frozen',
                'frozen_at': fields.Datetime.now(),
                'frozen_by': self.env.user.id,
                'current_prospetto_id': prospetto.id,
            })
        return True

    def action_send_to_sign(self):
        for d in self:
            if not d.can_sign:
                raise UserError(
                    "Impossibile inviare in firma: congela prima il deal.")
            d.state = 'signing'
        return True

    def _generate_prospetto(self, freeze=False):
        self.ensure_one()
        from .deal_engine import compute_prospetto, build_snapshot
        snapshot = build_snapshot(self)
        results = compute_prospetto(self.schema_code, self, snapshot)

        prospetto = self.env['erpv6.deal.prospetto'].create({
            'deal_id': self.id,
            'version': len(self.prospetto_ids) + 1,
            'state': 'frozen' if freeze else 'draft',
            'computed_by': self.env.user.id,
            'snapshot_json': str(snapshot),
            'frozen_at': fields.Datetime.now() if freeze else False,
            'frozen_by': self.env.user.id if freeze else False,
        })

        lines = []
        for p in self.participant_ids:
            r = results['per_participant'].get(p.id, {})
            lines.append({
                'prospetto_id': prospetto.id,
                'participant_id': p.id,
                'role': p.role,
                'monthly_min': r.get('monthly_min', 0),
                'monthly_base': r.get('monthly_base', 0),
                'monthly_max': r.get('monthly_max', 0),
                'rolling_12_min': r.get('rolling_12_min', 0),
                'rolling_12_base': r.get('rolling_12_base', 0),
                'rolling_12_max': r.get('rolling_12_max', 0),
                'rolling_24_min': r.get('rolling_24_min', 0),
                'rolling_24_base': r.get('rolling_24_base', 0),
                'rolling_24_max': r.get('rolling_24_max', 0),
            })
        self.env['erpv6.deal.prospetto.line'].create(lines)
        return prospetto

    def action_recompute(self):
        for d in self:
            if d.state in ('frozen', 'signing', 'active', 'closed'):
                raise UserError(
                    "Non si può ricalcolare un deal congelato o firmato.")
            d.current_prospetto_id = d._generate_prospetto().id
        return True

    def unlink(self):
        for d in self:
            d.current_prospetto_id = False
            d.prospetto_ids.unlink()
            d.participant_ids.unlink()
            d.variable_ids.unlink()
        return super().unlink()


class Erpv6DealVariable(models.Model):
    _name = 'erpv6.deal.variable'
    _description = 'Variabile di un deal'
    _order = 'deal_id, is_critical desc, name'

    deal_id = fields.Many2one('erpv6.deal', required=True, ondelete='cascade',
                              index=True)
    name = fields.Char(required=True)
    label = fields.Char()
    unit = fields.Char()

    value_min = fields.Float(digits=(16, 4))
    value_base = fields.Float(digits=(16, 4))
    value_max = fields.Float(digits=(16, 4))
    value_text = fields.Char()

    source = fields.Selection([
        ('catcher', 'Catcher progetto'),
        ('contract', 'Contratto'),
        ('manual', 'Manuale admin'),
        ('formula', 'Calcolata'),
        ('actual', 'Consuntivo'),
    ], required=True, default='manual')

    source_ref = fields.Char()
    is_critical = fields.Boolean(default=False)
    locked = fields.Boolean(default=False)
    locked_at = fields.Datetime(readonly=True)
    locked_by = fields.Many2one('res.users', readonly=True)
    notes = fields.Text()

    def action_lock(self):
        for v in self:
            v.write({
                'locked': True,
                'locked_at': fields.Datetime.now(),
                'locked_by': self.env.user.id,
            })

    def action_unlock(self):
        for v in self:
            if v.deal_id.state not in ('forecasting', 'negotiating'):
                raise UserError("Deal congelato: variabile non modificabile.")
            v.write({'locked': False, 'locked_at': False, 'locked_by': False})


class Erpv6DealParticipant(models.Model):
    _name = 'erpv6.deal.participant'
    _description = 'Partecipante a un deal'

    deal_id = fields.Many2one('erpv6.deal', required=True, ondelete='cascade',
                              index=True)
    partner_id = fields.Many2one('res.partner', required=True,
                                  ondelete='restrict')
    role = fields.Selection([
        ('v6_entity', 'V6 (entità)'),
        ('consultant', 'Consulente'),
        ('referral', 'Referral'),
        ('other', 'Altro'),
    ], required=True)
    share_pct = fields.Float(digits=(6, 4))
    consultant_user_id = fields.Many2one('res.users')
    is_referral_payer = fields.Boolean(
        string='Paga il referral',
        help="Se True, il costo referral e' dedotto dalla quota di questo "
             "partecipante invece che dal pool generale")
    notes = fields.Char()


class Erpv6DealProspetto(models.Model):
    _name = 'erpv6.deal.prospetto'
    _description = 'Prospetto di calcolo di un deal'
    _order = 'deal_id, version desc'

    deal_id = fields.Many2one('erpv6.deal', required=True, ondelete='cascade',
                              index=True)
    version = fields.Integer(default=1)
    state = fields.Selection([
        ('draft', 'Bozza'),
        ('shared', 'Condiviso'),
        ('frozen', 'Congelato'),
        ('signed', 'Firmato'),
        ('superseded', 'Superato'),
    ], default='draft', required=True, index=True)

    computed_at = fields.Datetime(default=fields.Datetime.now)
    computed_by = fields.Many2one('res.users')
    snapshot_json = fields.Text()
    pdf_document_id = fields.Many2one('erpv6.typst.document')
    pdf_hash = fields.Char()

    line_ids = fields.One2many('erpv6.deal.prospetto.line', 'prospetto_id',
                                string='Linee')
    sign_request_ids = fields.Many2many(
        'erpv6.sign.request',
        'erpv6_deal_prospetto_sign_rel',
        'prospetto_id', 'sign_request_id',
        string='Richieste di firma')

    frozen_at = fields.Datetime()
    frozen_by = fields.Many2one('res.users')
    signed_at = fields.Datetime()


class Erpv6DealProspettoLine(models.Model):
    _name = 'erpv6.deal.prospetto.line'
    _description = 'Linea prospetto'

    prospetto_id = fields.Many2one('erpv6.deal.prospetto', required=True,
                                    ondelete='cascade', index=True)
    participant_id = fields.Many2one('erpv6.deal.participant', required=True,
                                      ondelete='restrict')
    role = fields.Char()

    monthly_min = fields.Float(digits=(16, 2))
    monthly_base = fields.Float(digits=(16, 2))
    monthly_max = fields.Float(digits=(16, 2))

    rolling_12_min = fields.Float(digits=(16, 2))
    rolling_12_base = fields.Float(digits=(16, 2))
    rolling_12_max = fields.Float(digits=(16, 2))

    rolling_24_min = fields.Float(digits=(16, 2))
    rolling_24_base = fields.Float(digits=(16, 2))
    rolling_24_max = fields.Float(digits=(16, 2))
