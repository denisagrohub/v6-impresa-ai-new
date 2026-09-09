import logging
import secrets
from datetime import timedelta

from odoo import _, api, fields, models

_logger = logging.getLogger(__name__)

# Rete di sicurezza (Fase 2 del prompt web-async, 06/09/2026): se un token
# resta 'in_elaborazione' oltre questa soglia, e' probabile un'escalation
# umana del Gate 3B (mai osservata nei test precedenti, ma gestita) -
# notifica Denis, non il cliente.
STALE_THRESHOLD_MINUTES = 30


class Erpv6WinwinReportToken(models.Model):
    """Token di accesso pubblico al report Win-Win (prompt web-async,
    06/09/2026): generato SUBITO al completamento dell'intervista (vedi
    interview_api.py, answer_interview), PRIMA che il Gate 3B (lento,
    chiamate AI reali, minuti) finisca - il frontend lo riceve
    immediatamente nella risposta di completamento. La generazione vera
    del render_data/PDF avviene in background nel cron periodico
    _cron_process_pending_tokens, mai sincrona su una richiesta HTTP
    (questa istanza Odoo non ha queue_job, verificato in un giro
    precedente del circuito - vedi CIRCUITO_WINWIN_RENDERDATA_REPORT_FINALE.md).

    Non enumerabile (secrets.token_urlsafe): e' l'unico segreto,
    l'endpoint pubblico di stato/dati non ha altro auth."""
    _name = 'erpv6.winwin.report.token'
    _description = 'Token Accesso Report Win-Win'
    _inherit = ['mail.thread']
    _rec_name = 'token'

    token = fields.Char(
        required=True, index=True, copy=False,
        default=lambda self: secrets.token_urlsafe(32),
    )
    production_order_id = fields.Many2one(
        'erpv6.production.order', required=True, ondelete='cascade',
    )
    scadenza = fields.Datetime(
        required=True,
        default=lambda self: fields.Datetime.now() + timedelta(days=30),
    )
    stato = fields.Selection([
        ('in_elaborazione', 'In Elaborazione'),
        ('pronto', 'Pronto'),
        ('inviato_email', 'Inviato via Email'),
    ], default='in_elaborazione', required=True, tracking=True)

    # Campi di gestione coda/lock, non parte dello schema di stato
    # pubblico richiesto (i 3 valori sopra) - servono solo al cron per non
    # elaborare due volte lo stesso token e per la rete di sicurezza.
    started_at = fields.Datetime(
        help="Valorizzato quando il cron prende in carico il token (claim). "
             "Un token con stato='in_elaborazione' e started_at=False non è "
             "ancora stato preso in carico da nessuna esecuzione del cron.",
    )
    errore = fields.Text()
    escalation_notificata = fields.Boolean(default=False)

    # 09/09/2026 (audit "Punto Zero", pagamento reale): PRIMA lo sblocco a
    # 49€ era un semplice setUnlocked(true) lato client, zero pagamento -
    # il backend mandava GIA' i dati completi ad ogni chiamata (preview=true
    # era solo un'etichetta ignorata dal frontend). Corretto qui: sale_order_id
    # e' il "carrello" (richiesto da Denis: "solo la parte del carrello",
    # riusa il sale.order nativo Odoo - portale/pagamento/conferma automatica
    # su transazione riuscita sono gia' gestiti da payment/sale, nessun
    # codice Stripe nuovo scritto qui). is_paid e' l'UNICO gate reale:
    # winwin_report_api.py._data_ non manda piu' le sezioni pagate se e'
    # False, non solo un flag ignorato lato frontend.
    sale_order_id = fields.Many2one('sale.order', string='Ordine (pagamento report)', copy=False)
    is_paid = fields.Boolean(compute='_compute_is_paid', string='Pagato')

    @api.depends('sale_order_id.state')
    def _compute_is_paid(self):
        for token in self:
            token.is_paid = token.sale_order_id.state in ('sale', 'done')

    _sql_constraints = [
        ('token_unique', 'unique(token)', 'Il token deve essere univoco.'),
    ]

    def action_get_payment_url(self):
        """Crea (o riusa) il sale.order del report e ritorna l'URL portale
        nativo Odoo per pagarlo - NESSUNA integrazione Stripe scritta qui,
        e' lo stesso meccanismo di pagamento online di un preventivo Odoo
        qualsiasi (payment.transaction collegata via sale_order_ids conferma
        l'ordine da sola su transazione riuscita, vedi sale/models/payment_transaction.py
        core Odoo - verificato leggendo il codice, non assunto)."""
        self.ensure_one()
        if not self.sale_order_id or self.sale_order_id.state == 'cancel':
            product = self.env.ref('erpv6_winwin_renderdata.product_report_winwin')
            lead = self.production_order_id.lead_id
            partner = lead.partner_id
            if not partner:
                # Lead pubblico senza partner_id risolto: stesso pattern di
                # find_or_create gia' usato per i referral (admin_dashboard_extension.py) -
                # cerca per email prima di creare, mai un duplicato.
                Partner = self.env['res.partner'].sudo()
                partner = Partner.search([('email', '=', lead.email_from)], limit=1) if lead.email_from else Partner
                if not partner:
                    partner = Partner.create({
                        'name': lead.contact_name or lead.partner_name or lead.name or 'Cliente Win-Win',
                        'email': lead.email_from or False,
                        'phone': lead.phone or False,
                    })
            order = self.env['sale.order'].sudo().create({
                'partner_id': partner.id,
                # Verificato dal vivo: il default e' 'Firma e paga' (require_signature),
                # un passo di firma senza senso per un report digitale da 49€ -
                # richiede solo il pagamento.
                'require_signature': False,
                'require_payment': True,
                'order_line': [(0, 0, {
                    'product_id': product.product_variant_id.id,
                    'product_uom_qty': 1,
                    'price_unit': product.list_price,
                })],
            })
            self.sale_order_id = order.id
            self.env.cr.commit()
        return self.sale_order_id.get_portal_url()

    @api.model
    def create_for_order(self, production_order):
        """Punto di ingresso chiamato da erpv6_api_gateway/interview_api.py
        al completamento dell'intervista (duck-typing: erpv6_api_gateway
        resta agnostico da questo modulo, stesso pattern hasattr gia' usato
        altrove nel gateway per _start_production)."""
        return self.sudo().create({'production_order_id': production_order.id})

    def _report_url(self):
        self.ensure_one()
        base = self.env['ir.config_parameter'].sudo().get_param(
            'erpv6_winwin_renderdata.report_base_url', 'https://www.v6impresa.it')
        return f"{base.rstrip('/')}/report/{self.token}"

    # ------------------------------------------------------------------
    # Cron "esegui appena possibile" (Fase 1.2): nessun queue_job
    # disponibile in questa istanza (verificato in un giro precedente) -
    # un cron periodico molto frequente (ogni minuto) che pesca lavori in
    # coda, reclamati con FOR UPDATE SKIP LOCKED per sicurezza su
    # esecuzioni sovrapposte, e il lock viene committato SUBITO (prima di
    # lanciare il lavoro pesante) cosi' la riga non resta bloccata per i
    # minuti che il Gate 3B puo' richiedere.
    # ------------------------------------------------------------------
    @api.model
    def _cron_process_pending_tokens(self):
        self.env.cr.execute("""
            SELECT id FROM erpv6_winwin_report_token
            WHERE stato = 'in_elaborazione' AND started_at IS NULL
            ORDER BY create_date ASC
            LIMIT 5
            FOR UPDATE SKIP LOCKED
        """)
        ids = [r[0] for r in self.env.cr.fetchall()]
        if ids:
            self.browse(ids).write({'started_at': fields.Datetime.now()})
            self.env.cr.commit()
            for token in self.browse(ids):
                token._process_one()

        self._check_stale_escalation()

    def _process_one(self):
        self.ensure_one()
        order = self.production_order_id
        try:
            order.build_and_validate_render_data()
            order.generate_winwin_documents()
            self.write({'stato': 'pronto', 'errore': False})
            self.env.cr.commit()
        except Exception as e:  # noqa: BLE001 - deve continuare a processare gli altri token in coda
            _logger.exception("Token winwin report #%s (production_order #%s): elaborazione fallita.",
                               self.id, order.id)
            self.env.cr.rollback()
            self.write({'errore': str(e)})
            self.env.cr.commit()
            return

        # Invio email separato dal blocco sopra: un fallimento qui (es.
        # SMTP momentaneamente giu') non deve mai far sembrare fallita la
        # generazione del report, che e' gia' riuscita e committata.
        try:
            self._send_ready_email()
        except Exception as e:  # noqa: BLE001
            _logger.exception("Token winwin report #%s: report pronto ma invio email fallito.", self.id)
            self.write({'errore': 'Report pronto, invio email fallito: %s' % e})
            self.env.cr.commit()

    def _send_ready_email(self):
        """Fase 2: email inviata SUL COMPLETAMENTO REALE (qui, appena
        stato passa a 'pronto'), mai su un timer fisso. Mittente il
        default del sito v6impresa.it (Brevo, mail.default.from) - NON il
        server register.it/v6sviluppoimpresa.it usato altrove in questa
        sessione per un progetto diverso (Progetto TEE): sono due identita'
        di invio distinte per due business distinti, non vanno mai
        mescolate."""
        self.ensure_one()
        order = self.production_order_id
        email_to = order.lead_id.email_from
        if not email_to:
            _logger.warning("Token winwin report #%s: nessuna email sul lead #%s, email di completamento non inviata.",
                             self.id, order.lead_id.id)
            return
        report_url = self._report_url()
        # email_from esplicito (non lasciato al default di sistema): un
        # test dal vivo ha mostrato che senza specificarlo Odoo non
        # applicava mail.default.from ma un fallback generico
        # (odoobot@example.com) - meglio essere espliciti che dipendere da
        # una configurazione di sistema silenziosa.
        default_from = self.env['ir.config_parameter'].sudo().get_param(
            'mail.default.from', 'noreply@v6impresa.it')
        self.env['mail.mail'].sudo().create({
            'email_from': default_from if '@' in default_from else 'noreply@v6impresa.it',
            'email_to': email_to,
            'subject': _('Il tuo report Win-Win è pronto'),
            'body_html': _(
                '<p>Il tuo report Win-Win è pronto.</p>'
                '<p><a href="%s">Clicca qui per vederlo</a></p>'
            ) % report_url,
            'auto_delete': False,
        }).send()
        self.write({'stato': 'inviato_email'})
        self.env.cr.commit()

    @api.model
    def _check_stale_escalation(self):
        soglia = fields.Datetime.now() - timedelta(minutes=STALE_THRESHOLD_MINUTES)
        stale = self.search([
            ('stato', '=', 'in_elaborazione'),
            ('started_at', '!=', False),
            ('started_at', '<', soglia),
            ('escalation_notificata', '=', False),
        ])
        for token in stale:
            token._notify_escalation()
            token.escalation_notificata = True
        if stale:
            self.env.cr.commit()

    def _notify_escalation(self):
        """Rete di sicurezza (non il meccanismo primario): oltre i 30
        minuti, notifica Denis - non il cliente - riusando
        erpv6.agent.communication (Compito 4, gia' esistente in
        erpv6_agent) invece di inventare un canale nuovo, come richiesto
        dal prompt web-async (Fase 0.2/Fase 2: 'riusa un meccanismo di
        notifica gia' in uso se ne trovi uno coerente')."""
        self.ensure_one()
        order = self.production_order_id
        Comm = self.env.get('erpv6.agent.communication')
        if Comm is None:
            _logger.warning("erpv6.agent.communication non installato: escalation token #%s solo su log.", self.id)
            return
        # 'lieve' instrada via Susanna (route(), ROUTED_SEVERITIES) - lei e'
        # la piu' coerente come agente di origine per una segnalazione di
        # processo come questa (non esiste un agent_config dedicato al
        # circuito winwin_renderdata, e crearne uno solo per questo report
        # sarebbe overreach). Assegnatario/revisore: admin (Denis), stesso
        # pattern di erpv6_kaizen.kaizen_rule_engine._notify_denis quando
        # non c'e' un agente operativo sensato a cui assegnare il seguito.
        susanna = self.env.ref('erpv6_agent.agent_config_susanna', raise_if_not_found=False) \
            or self.env['erpv6.agent.config'].sudo().search([('code', '=', 'susanna')], limit=1)
        admin = self.env.ref('base.user_admin', raise_if_not_found=False)
        if not susanna or not admin:
            _logger.warning("Susanna o l'utente admin non trovati: escalation token #%s solo su log.", self.id)
            return
        Comm.sudo().create_and_route({
            'agent_config_id': susanna.id,
            'occurred_at': fields.Datetime.now(),
            'action_in_progress': 'Elaborazione report Win-Win (Gate 3B) in background',
            'problem_description': (
                'Il token report #%s (production_order #%s, lead "%s") è '
                'in elaborazione da oltre %s minuti senza raggiungere lo '
                'stato "pronto" - probabile escalation umana del Gate 3B '
                'di erpv6_validation, mai raggiunto un timeout così lungo '
                'nei test.' % (self.id, order.id, order.lead_id.name, STALE_THRESHOLD_MINUTES)
            ),
            'heinrich_severity': 'lieve',
            'outcome_if_resolved': 'Il cliente riceve il report via email come previsto.',
            'risk_if_nothing_done': 'Il cliente non riceve mai il report, nessun avviso, esperienza cliente rotta silenziosamente.',
            'proposed_improvement': 'Verificare manualmente la sessione erpv6.validation bloccata e la coda dei token winwin.',
            'assignee_user_id': admin.id,
            'reviewer_user_id': admin.id,
            'res_model': 'erpv6.winwin.report.token',
            'res_id': self.id,
        })
