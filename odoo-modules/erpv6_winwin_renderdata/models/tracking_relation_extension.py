from odoo import api, fields, models


class Erpv6TrackingRelation(models.Model):
    """Estende erpv6.tracking.relation (modulo aeosv6_relation, gia'
    installato per il Progetto TEE) con il collegamento al progetto
    Win-Win (06/09/2026, prompt 'Trigger progetto + Dashboard consulente
    + Email per-progetto'): l'Arco consulente di un progetto Win-Win vive
    sullo stesso modello generico progetto<->parte, non ne serve uno
    nuovo. Vive qui (erpv6_winwin_renderdata) e non in aeosv6_relation
    perche' quest'ultimo e' lavoro non committato di un altro thread
    (Progetto TEE) che non va toccato.

    owner_user_id (06/09/2026, seguito - dashboard: sezione generica
    'I miei progetti (relazioni)'): stesso motivo di design, il campo e'
    generico (si applica a QUALUNQUE nodo tracking.relation, non solo
    Win-Win - es. serve anche per "Progetto TEE") ma vive qui per non
    toccare aeosv6_relation. L'inheritance Odoo aggiunge il campo al
    modello per intero, indipendentemente da quale modulo lo dichiara."""
    _inherit = 'erpv6.tracking.relation'

    # 23/09/2026: pitch pubblico (one-pager per aziende esterne, link
    # condivisibile) + tracking views. Riusa action_create_from_public_form
    # di erpv6.partnership.candidacy per il form.
    x_v6_pitch_views = fields.Integer(
        string='Visite pitch', default=0, readonly=True,
        help="Numero di aperture del link pubblico /p/<slug>.")
    x_v6_pitch_last_view = fields.Datetime(
        string='Ultima visita', readonly=True)
    x_v6_pitch_title = fields.Char(
        string='Titolo pitch pubblico',
        help="Titolo mostrato nella pagina pubblica. Vuoto = usa name.")
    x_v6_pitch_summary = fields.Text(
        string='Sommario pitch pubblico',
        help="Testo introduttivo per aziende esterne. Vuoto = usa charter.descrizione.")
    x_v6_pitch_enabled = fields.Boolean(
        string='Pitch pubblico attivo', default=False,
        help="Se True, /p/<email_alias> è accessibile senza login.")

    production_order_id = fields.Many2one(
        'erpv6.production.order', string='Progetto Win-Win', ondelete='cascade', index=True,
        help="Vuoto per i nodi TEE (dominio v6sviluppoimpresa.it) o altri usi futuri "
             "del modello generico. Valorizzato sul nodo radice di un Arco Win-Win "
             "creato da erpv6.booking.token.action_prendi_in_carico().",
    )

    owner_user_id = fields.Many2one(
        'res.users', string='Responsabile Progetto', index=True,
        default=lambda self: self.env.uid,
        help="Chi segue questo progetto (di solito il nodo radice) - riassegnabile "
             "senza perdere lo storico di chi l'ha creato (create_uid). Usato dal "
             "filtro 'i miei progetti' della dashboard consulente per QUALUNQUE "
             "tipo di progetto tracking.relation, non solo Win-Win.",
    )

    def notify_owner(self, partner, subject, body):
        """Notifica diretta forzata in-app: message_notify() sul nodo +
        forza la riga mail.notification appena creata per il destinatario
        a notification_type='inbox', is_read=False (stesso trucco gia'
        verificato dal vivo in notify_new_email() sotto - vedi li' il
        perche', comportamento nativo Odoo che altrimenti instrada solo
        via email per chi ha quella preferenza personale).

        Estratto qui da notify_new_email() (08/09/2026, seconda
        correzione richiesta dopo il report 'Notifiche email progetti'):
        riusato anche da erpv6.booking.token.action_prendi_in_carico()
        per la notifica 'prendi in carico', che fino ad ora passava SOLO
        da erpv6.agent.communication/create_and_route() - canale
        verificato NON arrivare mai al vero destinatario (ricade sempre
        su base.user_admin/Denis quando Susanna non ha notify_partner_ids
        configurato, vedi motivazione completa sotto). create_and_route()
        resta comunque in booking_token_extension.py (non rimosso): serve
        anche a creare la riga erpv6.agent.communication mostrata nel
        pannello 'notifiche' di get_miei_progetti_generici(), un uso
        diverso dalla notifica in se'."""
        self.ensure_one()
        if not partner:
            return False
        message = self.message_notify(partner_ids=partner.ids, subject=subject, body=body)
        if message:
            notif = self.env['mail.notification'].sudo().search([
                ('mail_message_id', '=', message.id),
                ('res_partner_id', '=', partner.id),
            ], limit=1)
            if notif:
                notif.write({'notification_type': 'inbox', 'is_read': False})
        return True

    def notify_new_email(self, subject, sender_email):
        """Notifica 'nuova email captata' (07/09/2026, prompt 'Dashboard:
        quarta tab Amministrazione / PARTE B') - chiamata da
        erpv6.project.email.log (TEE, aeosv6_project_relay) ed
        erpv6.winwin.email.log (Win-Win, stesso modulo di questo file)
        DOPO che il salvataggio del log e' gia' riuscito - non tocca la
        logica di parsing/matching di nessuno dei due.

        Nessun filtro di rilevanza (richiesto esplicitamente dal prompt):
        OGNI email captata genera sempre una notifica, mai un giudizio
        automatico su cosa "conta di piu'".

        NON usa erpv6.agent.communication/create_and_route() nonostante
        sia il canale gia' riusato altrove in questo circuito (Gate 3B,
        "prendi in carico") - verificato dal vivo (07/09/2026) che quel
        meccanismo NON notifica affatto assignee_user_id: route() passa
        da erpv6.agent.config('susanna').notify_pending_confirmation(),
        che senza un notify_partner_ids esplicito ricade SEMPRE su
        _default_notify_partner_ids() = base.user_admin (Denis) - Susanna
        non ha oggi nessun notify_partner_ids configurato (verificato,
        vuoto). Per una notifica "chiunque sia collegato al progetto",
        non solo admin (requisito esplicito di questo prompt), quel
        meccanismo e' strutturalmente sbagliato: userebbe SEMPRE Denis
        indipendentemente da chi e' owner_user_id. NOTA: questo vale
        anche per la notifica "prendi in carico" gia' shippata in
        booking_token_extension.py (stessa causa, mai corretta li' -
        fuori scope qui, fuori dal mio mandato di questo giro, segnalato
        nel report).

        Uso invece message_notify() DIRETTO sul nodo progetto (root
        eredita mail.thread da erpv6.tracking.relation) verso
        owner_user_id.partner_id esplicito - questo E' il meccanismo
        nativo Odoo della campanella (mail.notification), lo stesso che
        create_and_route() usa internamente ma senza il livello Susanna
        che qui perderebbe il destinatario reale."""
        self.ensure_one()
        root = self
        while root.parent_id:
            root = root.parent_id
        owner = getattr(root, 'owner_user_id', False)
        if not owner or not owner.partner_id:
            return False

        # 07/09/2026 (fix mobile/notifiche, richiesta esplicita utente):
        # message_notify() instrada su inbox o email "a seconda della
        # configurazione utente" (docstring nativa, verificato leggendo
        # mail_thread.py) - per un utente con preferenza "Email" (es.
        # Stefano) questo significa MAI una voce non letta nella
        # campanella, solo un'email. L'utente vuole il canale in-app
        # SEMPRE forzato per QUESTE notifiche specifiche, indipendentemente
        # dalla preferenza personale - non tocchiamo la preferenza
        # dell'utente (resta sua), notify_owner() forza solo la riga
        # mail.notification gia' creata da message_notify() a essere una
        # notifica inbox non letta, in aggiunta a qualunque email che sia
        # gia' partita. (08/09/2026: forzatura estratta in notify_owner()
        # sopra, riusata anche da 'prendi in carico'.)
        return root.notify_owner(
            owner.partner_id,
            subject='Nuova email su "%s"' % root.name,
            body='Nuova email su "%(progetto)s" da %(mittente)s: "%(oggetto)s".' % {
                'progetto': root.name, 'mittente': sender_email or '-', 'oggetto': subject or '-',
            },
        )

    def mark_notifications_read(self):
        """Azione dashboard (PARTE B, problema 3 - "le notifiche non si
        cancellano"): segna come lette, per l'utente corrente, tutte le
        notifiche non lette postate su questo nodo (radice). Usa il
        meccanismo nativo mail.notification.is_read, nessuna gestione
        separata dei "letti" reinventata qui."""
        self.ensure_one()
        notifs = self.env['mail.notification'].sudo().search([
            ('res_partner_id', '=', self.env.user.partner_id.id),
            ('is_read', '=', False),
            ('mail_message_id.model', '=', 'erpv6.tracking.relation'),
            ('mail_message_id.res_id', '=', self.id),
        ])
        notifs.write({'is_read': True})
        return True

    def get_unread_notification_count(self):
        """Badge dashboard (PARTE B, punto 3): conteggio nativo Odoo delle
        notifiche non lette (mail.notification, non erpv6.agent.communication
        - vedi notify_new_email sopra sul perche') per l'utente corrente,
        sui messaggi postati su questo nodo. Chiamato dal chiamante gia'
        con self = root (un solo nodo, non un conteggio per-figlio)."""
        self.ensure_one()
        return self.env['mail.notification'].search_count([
            ('res_partner_id', '=', self.env.user.partner_id.id),
            ('is_read', '=', False),
            ('mail_message_id.model', '=', 'erpv6.tracking.relation'),
            ('mail_message_id.res_id', '=', self.id),
        ])

    @api.model
    def get_miei_progetti_generici(self):
        """Endpoint dati per la terza sezione della dashboard OWL
        ('Progetti & Relazioni') - dato separato dalla vista, stesso
        principio di get_richieste_in_arrivo()/get_miei_progetti().
        Restituisce i nodi radice (parent_id=False) di cui l'utente
        corrente e' owner_user_id, con parti collegate, feed email
        (erpv6.project.email.log, modulo aeosv6_project_relay) e
        notifiche (erpv6.agent.communication, collegamento generico
        res_model/res_id) di tutto l'albero (radice + figli diretti)."""
        roots = self.sudo().search([('parent_id', '=', False), ('owner_user_id', '=', self.env.uid)])
        EmailLog = self.env['erpv6.project.email.log'].sudo()
        Notif = self.env['erpv6.agent.communication'].sudo()
        result = []
        for root in roots:
            node_ids = root.ids + root.child_ids.ids
            emails = EmailLog.search(
                [('relation_id', 'in', node_ids)], order='create_date desc', limit=20)
            notifiche = Notif.search(
                [('res_model', '=', 'erpv6.tracking.relation'), ('res_id', 'in', node_ids)],
                order='create_date desc', limit=20)
            result.append({
                'id': root.id,
                'name': root.name,
                'email_alias_full': getattr(root, 'email_alias_full', False) or False,
                'unread_count': root.get_unread_notification_count(),
                'parti': [
                    {
                        'id': c.id,
                        'name': c.name,
                        'ruolo': c.ruolo or '',
                        'partner': c.partner_id.name or '',
                    }
                    for c in root.child_ids
                ],
                'emails': [
                    {
                        'id': e.id,
                        'oggetto': e.name,
                        'mittente': e.sender_email or '',
                        'data': e.create_date,
                        'match_status': e.match_status,
                    }
                    for e in emails
                ],
                'notifiche': [
                    {
                        'id': n.id,
                        'problema': n.problem_description or '',
                        'stato': n.routing_state or '',
                        'data': n.create_date,
                    }
                    for n in notifiche
                ],
            })
        return result
