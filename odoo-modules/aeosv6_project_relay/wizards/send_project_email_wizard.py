from markupsafe import Markup

from odoo import _, api, fields, models
from odoo.exceptions import UserError


class Erpv6ProjectRelaySendEmailWizard(models.TransientModel):
    """Wizard 'Invia dal Progetto' (Denis, 05/09/2026, hub email di
    progetto): manda una email vera con mittente l'alias del progetto
    (es. progetto-tee@v6sviluppoimpresa.it) verso una o piu' parti
    collegate scelte, o indirizzi liberi aggiuntivi. Usa esplicitamente
    il server SMTP con from_filter='v6sviluppoimpresa.it' (register.it,
    stessa casella del catch-all in ricezione) invece di lasciare che
    Odoo scelga di default (che userebbe Brevo, configurato per
    v6impresa.it)."""
    _name = 'erpv6.project.relay.send.email.wizard'
    _description = 'Invia Email dal Progetto'

    project_id = fields.Many2one(
        'erpv6.tracking.relation', required=True, string='Progetto',
        domain=[('parent_id', '=', False)],
    )
    project_email = fields.Char(
        related='project_id.email_alias_full', readonly=True,
        string='Email del Progetto (dì alle parti di metterla in copia)',
    )
    available_partner_ids = fields.Many2many(
        'res.partner', compute='_compute_available_partner_ids', string='Parti del progetto',
    )
    partner_ids = fields.Many2many('res.partner', string='Destinatari (parti collegate)')
    extra_emails = fields.Char(string='Altri destinatari (email separate da virgola)')
    subject = fields.Char(required=True)
    body = fields.Html(required=True, sanitize_style=False)

    @api.depends('project_id')
    def _compute_available_partner_ids(self):
        for wiz in self:
            wiz.available_partner_ids = wiz.project_id.child_ids.partner_id

    @api.model
    def default_get(self, fields_list):
        # Popola available_partner_ids gia' qui, non solo via compute
        # (Denis, 05/09/2026 -- bug riportato: al primo apertura del
        # wizard da bottone, con project_id valorizzato solo da contesto
        # default, l'onchange iniziale del client non attivava sempre il
        # ricalcolo del compute -- qui e' garantito perche' default_get()
        # viene sempre chiamato per un record nuovo, indipendentemente
        # dalla catena di onchange del client).
        res = super().default_get(fields_list)
        if 'available_partner_ids' in fields_list and res.get('project_id'):
            project = self.env['erpv6.tracking.relation'].browse(res['project_id'])
            res['available_partner_ids'] = [(6, 0, project.child_ids.partner_id.ids)]
        return res

    def action_send(self):
        self.ensure_one()
        if not self.project_id.email_alias:
            raise UserError(_(
                "Il progetto '%s' non ha un alias email configurato (es. 'progetto-tee'): "
                "impostalo prima di inviare."
            ) % self.project_id.name)

        recipients = [e for e in self.partner_ids.mapped('email') if e]
        if self.extra_emails:
            recipients += [e.strip() for e in self.extra_emails.split(',') if e.strip()]
        if not recipients:
            raise UserError(_("Seleziona almeno un destinatario (parte collegata o email libera)."))

        mail_server = self.env['ir.mail_server'].sudo().search(
            [('from_filter', '=', 'v6sviluppoimpresa.it')], limit=1)
        if not mail_server:
            raise UserError(_(
                "Nessun server SMTP configurato per il dominio v6sviluppoimpresa.it "
                "(from_filter mancante su ir.mail_server)."
            ))

        project_email = self.project_id.email_alias_full
        signature = Markup(
            '<hr/><p style="color:#888888;font-size:12px;">%s: <b>%s</b></p>'
        ) % (_('Ricorda di mettere sempre in copia (CC)'), project_email)
        body_with_signature = Markup(self.body or '') + signature

        mail = self.env['mail.mail'].sudo().create({
            'email_from': f"{self.project_id.name} <{project_email}>",
            'email_to': ','.join(recipients),
            'subject': self.subject,
            'body_html': body_with_signature,
            'mail_server_id': mail_server.id,
            'auto_delete': False,
        })
        mail.send()

        # 10/09/2026 (Denis: "esistevano solo le email ricevute nel
        # progetto TEE, e non le email inviate, cosi' si perde la
        # continuita' della conversazione") - stesso log delle email in
        # arrivo (erpv6.project.email.log), direction='inviata' invece di
        # un modello separato: la vista "Email" del progetto le mostra
        # gia' tutte insieme, ordinate per data. Corpo salvato nel
        # chatter nativo del log (message_post), stesso posto in cui il
        # flusso in ricezione lo mette per le email in arrivo - cosi'
        # riaprire un'email inviata funziona con lo stesso meccanismo,
        # nessuna UI diversa per le due direzioni.
        log = self.env['erpv6.project.email.log'].sudo().create({
            'name': self.subject,
            'sender_email': project_email,
            'recipient_emails': ','.join(recipients),
            'match_status': 'matched',
            'matched_alias': self.project_id.email_alias,
            'relation_id': self.project_id.id,
            'direction': 'inviata',
        })
        # message_type='comment' esplicito: il default di message_post()
        # senza subtype produce 'notification' (verificato dal vivo, non
        # assunto) - il frontend legge il corpo filtrando
        # message_type != 'notification' per coerenza con le email in
        # ricezione (message_type='email' via message_process()), quindi
        # senza questo la risposta inviata restava illeggibile li'.
        log.message_post(body=body_with_signature, subject=self.subject,
                          message_type='comment', subtype_xmlid='mail.mt_comment')

        return {'type': 'ir.actions.act_window_close'}
