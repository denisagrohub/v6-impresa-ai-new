import re
import unicodedata

from odoo import _, api, fields, models
from odoo.exceptions import UserError


def _slugify(text):
    text = unicodedata.normalize('NFKD', text or '').encode('ascii', 'ignore').decode('ascii')
    text = re.sub(r'[^a-z0-9]+', '-', text.lower()).strip('-')
    return text or 'progetto'


class Erpv6BookingToken(models.Model):
    """Estende erpv6.booking.token (modulo aeosv6_booking) con il
    collegamento al lead/progetto Win-Win e col trigger 'Prendi in
    carico' (06/09/2026, prompt 'Trigger progetto + Dashboard consulente
    + Email per-progetto'). Fase 0 di questo stesso giro aveva verificato
    che il modello non aveva NESSUN collegamento a lead/production_order -
    qui si colma quel gap, non se ne inventa uno diverso."""
    _inherit = 'erpv6.booking.token'

    production_order_id = fields.Many2one(
        'erpv6.production.order', string='Progetto Win-Win collegato', ondelete='set null', index=True,
        help="Valorizzato da erpv6.production.order._resolve_consultant_for_booking() quando il "
             "token viene generato per la pagina report Win-Win. Vuoto per i token generati "
             "manualmente dal consulente dalla propria dashboard (link generico, non legato a "
             "un caso specifico) - in quel caso il progetto/lead si risolve al momento della "
             "presa in carico, da client_email.",
    )
    lead_id = fields.Many2one(
        'crm.lead', string='Lead collegato', ondelete='set null', index=True,
        help="Stesso lead di production_order_id quando presente. Puo' essere valorizzato anche "
             "senza production_order_id se risolto al momento della presa in carico.",
    )
    presa_in_carico = fields.Boolean(
        string='Presa in carico', default=False, copy=False,
        help="True dopo che il consulente ha premuto 'Prendi in carico' dalla dashboard - "
             "da quel momento la richiesta esce dalla coda 'Richieste in arrivo'.",
    )

    def action_prendi_in_carico(self):
        """Trigger del progetto (Fase 1 del prompt): azione umana deliberata,
        MAI automatica su tempo/stato indovinato. Chiamata dalla dashboard
        OWL del consulente (Fase 2) sulla propria richiesta di contatto
        prenotata (status='booked', dati cliente compilati)."""
        self.ensure_one()
        if self.presa_in_carico:
            raise UserError(_("Questa richiesta è già stata presa in carico."))
        if self.status != 'booked':
            raise UserError(_(
                "Solo una richiesta prenotata (con dati cliente compilati dal cliente) "
                "può essere presa in carico - stato attuale: %s."
            ) % self.status)

        lead = self.lead_id
        if not lead:
            if self.client_email:
                lead = self.env['crm.lead'].sudo().search(
                    [('email_from', '=', self.client_email)], order='id desc', limit=1)
            if not lead:
                lead = self.env['crm.lead'].sudo().create({
                    'name': self.client_name or _('Richiesta di contatto (booking Win-Win)'),
                    'email_from': self.client_email or False,
                    'phone': self.client_phone or False,
                    'description': self.notes or False,
                })
            self.lead_id = lead.id

        order = self.env['erpv6.production.order'].sudo().search(
            [('lead_id', '=', lead.id)], order='id desc', limit=1)
        if not order:
            # "il progetto nasce quando il consulente da' OK" - non prima.
            order = self.env['erpv6.production.order'].sudo().create({'lead_id': lead.id})
        self.production_order_id = order.id

        user = self.env['res.users'].sudo().search(
            [('partner_id', '=', self.consultant_id.partner_id.id)], limit=1)
        if user:
            # 'assignment_reason' e' un Selection chiuso su
            # erpv6.production.consulente.line (verificato dal vivo:
            # 'booking_preso_in_carico' non e' un valore valido, ValueError
            # reale intercettato in test) - 'sourcing_diretto' ("Lead
            # portato/creato direttamente dal consulente (dashboard)") e'
            # il valore esistente semanticamente piu' vicino: il lead
            # arriva a QUESTO consulente tramite il SUO proprio link di
            # prenotazione, stesso concetto di "portato dal consulente
            # stesso" gia' previsto dal modello - riuso, non un nuovo
            # valore aggiunto al Selection.
            lead._set_delivery_consulente(
                user, reason='sourcing_diretto',
                note=_("Consulente ha preso in carico questa richiesta dal proprio link di prenotazione."),
            )

        root_relation = self._ensure_progetto_relation(order, user)

        self.presa_in_carico = True

        if user:
            alias_full = root_relation.email_alias and ('%s@v6impresa.it' % root_relation.email_alias) or '-'

            # 08/09/2026 (prima correzione richiesta, seguito al report
            # 'Notifiche email progetti'): message_notify() DIRETTO verso
            # il consulente, stesso meccanismo gia' usato e verificato dal
            # vivo in erpv6.tracking.relation.notify_new_email() - la sola
            # create_and_route() sotto (rimasta per il pannello
            # 'notifiche' della dashboard) NON arriva mai qui a
            # user/reviewer_user_id: senza notify_partner_ids esplicito
            # ricade sempre su base.user_admin (Denis), verificato dal
            # vivo, mai stata una notifica reale per il consulente che
            # prende in carico (debito dichiarato nel report precedente,
            # corretto ora).
            root_relation.notify_owner(
                user.partner_id,
                subject=_('Hai preso in carico: %s') % (self.client_name or order.lead_id.name or '-'),
                body=_(
                    'Hai preso in carico la richiesta di contatto di %(nome)s (%(email)s). '
                    'Progetto #%(order)s creato, alias email di progetto: %(alias)s.'
                ) % {
                    'nome': self.client_name or '-', 'email': self.client_email or '-',
                    'order': order.id, 'alias': alias_full,
                },
            )

            # Riuso di erpv6.agent.communication come canale (stesso
            # meccanismo gia' riusato in report_token.py per l'escalation
            # Gate 3B). Il modello e' pensato per segnalazioni di problema
            # (campi required orientati a quello), qui viene piegato a una
            # conferma di routine - unico canale esistente per popolare il
            # pannello 'notifiche' della dashboard, non ne invento uno
            # nuovo solo per questo (debito gia' dichiarato nel report: la
            # notifica VERA ora e' notify_owner() sopra, questa resta solo
            # per l'audit trail visibile in dashboard, anche se arriva
            # sempre a Denis via Susanna).
            susanna = self.env.ref('erpv6_agent.agent_config_susanna', raise_if_not_found=False) \
                or self.env['erpv6.agent.config'].sudo().search([('code', '=', 'susanna')], limit=1)
            if susanna:
                self.env['erpv6.agent.communication'].sudo().create_and_route({
                    'agent_config_id': susanna.id,
                    'occurred_at': fields.Datetime.now(),
                    'action_in_progress': 'Presa in carico progetto Win-Win dalla dashboard consulente',
                    'problem_description': (
                        'Nessun problema: notifica di conferma. %(user)s ha preso in carico la '
                        'richiesta di contatto di %(nome)s (%(email)s). Progetto #%(order)s creato, '
                        'alias email di progetto: %(alias)s.' % {
                            'user': user.name, 'nome': self.client_name or '-',
                            'email': self.client_email or '-', 'order': order.id, 'alias': alias_full,
                        }
                    ),
                    'heinrich_severity': 'lieve',
                    'outcome_if_resolved': 'Il consulente vede il progetto pronto sulla propria dashboard.',
                    'risk_if_nothing_done': 'n/a - notifica di conferma, non un\'anomalia da risolvere.',
                    'proposed_improvement': 'n/a',
                    'assignee_user_id': user.id,
                    'reviewer_user_id': user.id,
                    'res_model': 'erpv6.production.order',
                    'res_id': order.id,
                })

        return {
            'type': 'ir.actions.act_window',
            'res_model': 'erpv6.production.order',
            'res_id': order.id,
            'view_mode': 'form',
            'target': 'current',
        }

    def _ensure_progetto_relation(self, order, user):
        """Crea (se manca) l'Arco consulente su erpv6.tracking.relation per
        questo progetto - riusa il modello TEE (aeosv6_relation), non ne
        crea uno nuovo. Nodo radice = progetto (con alias email univoco),
        nodo figlio = consulente (stessa persona lavora+guadagna, come
        deciso: un solo ruolo unificato, mai due persone per un Arco)."""
        Relation = self.env['erpv6.tracking.relation'].sudo()
        root = Relation.search([('production_order_id', '=', order.id), ('parent_id', '=', False)], limit=1)
        if not root:
            slug = _slugify(order.lead_id.name)
            root = Relation.create({
                'name': _('Progetto %s') % (order.lead_id.name or order.id),
                'production_order_id': order.id,
                'email_alias': 'progetto-%s-%s' % (slug, order.id),
            })
        if user and user.partner_id:
            child = Relation.search(
                [('parent_id', '=', root.id), ('partner_id', '=', user.partner_id.id)], limit=1)
            if not child:
                Relation.create({
                    'name': user.partner_id.name,
                    'parent_id': root.id,
                    'partner_id': user.partner_id.id,
                    'ruolo': 'gestore',
                })
        return root

    @api.model
    def get_richieste_in_arrivo(self):
        """Dati per la vista 'Richieste in arrivo' della dashboard OWL
        (Fase 2) - endpoint dati separato dalla vista, come richiesto,
        cosi' un domani un frontend esterno puo' chiamare lo stesso
        metodo senza duplicare la logica."""
        consultant = self.env['erpv6.consulting.consultant'].sudo().search(
            [('partner_id', '=', self.env.user.partner_id.id)], limit=1)
        if not consultant:
            return []
        tokens = self.sudo().search([
            ('consultant_id', '=', consultant.id),
            ('status', '=', 'booked'),
            ('presa_in_carico', '=', False),
        ], order='booked_at desc')
        result = []
        for t in tokens:
            row = {
                'id': t.id,
                'client_name': t.client_name or '',
                'client_email': t.client_email or '',
                'client_phone': t.client_phone or '',
                'notes': t.notes or '',
                'booked_at': t.booked_at.isoformat() if t.booked_at else False,
                'quadrante': False,
                'criticita_count': 0,
            }
            rd = t.production_order_id.winwin_render_data_final if t.production_order_id else False
            if rd:
                row['quadrante'] = (rd.get('etichetta_azienda') or '').replace('_', ' ')
                row['criticita_count'] = len(rd.get('criticita') or [])
            result.append(row)
        return result
