from odoo import api, fields, models, _
import json, logging
_logger = logging.getLogger(__name__)
class Erpv6KbRequest(models.Model):
    _name = 'erpv6.kb.request'
    _description = 'Richiesta KB Mancante'
    _inherit = ['mail.thread', 'mail.activity.mixin']
    _order = 'priority desc, created_at desc'
    name = fields.Char(required=True, tracking=True)
    description = fields.Text()
    sector = fields.Char(tracking=True)
    category = fields.Char(tracking=True)
    tags = fields.Char()
    heinrich_level = fields.Selection([('red','🔴 Rosso - Critico'),('yellow','🟡 Giallo - Medio'),('green','🟢 Verde - Near Miss')],
                                      default='yellow', required=True, tracking=True)
    reason = fields.Text()
    context = fields.Text()
    status = fields.Selection([('pending','⏳ In attesa'),('accepted','✅ Accettata'),('rejected','❌ Rifiutata'),('completed','📦 Completata')],
                              default='pending', tracking=True)
    created_at = fields.Datetime(default=fields.Datetime.now)
    updated_at = fields.Datetime(default=fields.Datetime.now)
    created_by = fields.Many2one('res.users', default=lambda self: self.env.user)
    assigned_to = fields.Many2one('res.users')
    priority = fields.Selection([('0','Bassa'),('1','Media'),('2','Alta'),('3','Urgente')], default='1', tracking=True)
    admin_notes = fields.Text()
    resolution_date = fields.Datetime()
    kb_id = fields.Many2one('erpv6.kb')
    detection_count = fields.Integer(default=1)
    @api.model
    def create_from_gap(self, sector, category, tags, context_data, reason):
        existing = self.search([('sector','=',sector),('category','=',category),('status','in',['pending','accepted'])], limit=1)
        if existing:
            existing.detection_count += 1
            existing.write({'context': json.dumps(context_data)})
            return existing
        level = 'red' if not tags and not category else 'yellow'
        request = self.create({
            'name': f"KB per settore: {sector}",
            'description': f"Nessuna KB specifica per '{sector}'",
            'sector': sector, 'category': category, 'tags': ', '.join(tags) if tags else '',
            'heinrich_level': level, 'reason': reason, 'context': json.dumps(context_data),
            'priority': '2' if level == 'red' else '1', 'detection_count': 1
        })
        request._notify_admin()
        return request
    def _notify_admin(self):
        # Email template
        template = self.env.ref('erpv6_kb.email_kb_request_notification', raise_if_not_found=False)
        if template:
            template.send_mail(self.id, force_send=True)
        # Activity
        self.env['mail.activity'].create({
            'activity_type_id': self.env.ref('mail.mail_activity_data_todo').id,
            'note': f"Richiesta KB: {self.name} (Livello {self.heinrich_level})",
            'user_id': self.env.user.id,
            'res_model_id': self.env['ir.model']._get('erpv6.kb.request').id,
            'res_id': self.id,
        })
    def action_accept(self):
        self.write({'status': 'accepted', 'assigned_to': self.env.user.id, 'updated_at': fields.Datetime.now()})
    def action_reject(self):
        self.write({'status': 'rejected', 'updated_at': fields.Datetime.now()})
    def action_complete(self, kb_id):
        self.write({'status': 'completed', 'kb_id': kb_id, 'resolution_date': fields.Datetime.now(), 'updated_at': fields.Datetime.now()})
