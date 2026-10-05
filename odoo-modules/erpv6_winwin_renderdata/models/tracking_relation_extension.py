from odoo.exceptions import ValidationError
from odoo import api, fields, models
from odoo.exceptions import UserError

import logging
_logger = logging.getLogger(__name__)


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
    # 24/09/2026: riserva minima V6 configurabile per progetto.
    # Admin non puo' salvare split con riserva < questo valore.
    x_v6_min_reserve_pct = fields.Float(
        string='Riserva V6 minima (%)', default=70.0,
        help="Soglia minima che la riserva V6 deve mantenere. La UI e "
             "il constraint Odoo bloccano split che scendono sotto.")

    # 27/09/2026: versioning split V6 (Fase 2)
    split_version_ids = fields.One2many(
        'erpv6.revenue.split.version', 'relation_id',
        string='Versioni Split V6')
    active_split_version_id = fields.Many2one(
        'erpv6.revenue.split.version', string='Versione split attiva',
        compute='_compute_active_split_version', store=False)

    @api.depends('split_version_ids', 'split_version_ids.state')
    def _compute_active_split_version(self):
        for r in self:
            active = r.split_version_ids.filtered(
                lambda v: v.state in ('bozza', 'in_firma'))
            r.active_split_version_id = active[:1] if active else False

    # 30/09/2026 — Catalogo playbook consultant (opt-in).
    # Se True, il progetto appare nel catalogo /consultant/playbook e i
    # consultant possono richiedere accesso. L'approvazione (admin o
    # chief_projects) aggiunge lo user a access_user_ids e (opzionale)
    # crea un nodo parte figlio.
    x_v6_catalog_visible = fields.Boolean(
        string='Visibile nel catalogo consultant',
        default=False,
        help='Se True, il progetto è pubblicato nel catalogo playbook '
             'consultant e accetta richieste di accesso.')
    x_v6_catalog_published_at = fields.Datetime(
        string='Pubblicato nel catalogo il',
        readonly=True,
        help="Timestamp dell'ultima attivazione di x_v6_catalog_visible.")

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

    # 30/09/2026 (F2 B3): schema deal associato (padre o figlio)
    schema_id = fields.Many2one(
        'erpv6.deal.schema', string='Schema deal',
        ondelete='set null', index=True,
        help='Schema di processo associato a questa relazione. Per i padri '
             'è il template da cui ereditano i figli.')
    schema_applied_at = fields.Datetime(
        string='Schema applicato il', readonly=True)

    vertical = fields.Char(
        string='Vertical', index=True,
        help='Vertical business (TEE, Fotovoltaico, ESCO, Superbonus...) '
             'per la selezione automatica dello schema.')
    revenue_model_default = fields.Char(
        string='Revenue model default',
        help='Modello di ricavo di default per i deal figli.')

    # 01/10/2026 (F3.A): scouting automatico da charter.
    # x_v6_scouting è già su res.partner ma serve sul soggetto (padre) per
    # storicizzare le ricerche fatte in base al charter. Formato JSON:
    #   {"schemaVersion":1, "generated_at":"...", "queries":[...],
    #    "results":[{...}], "sources_used":[...]}
    x_v6_scouting = fields.Text(
        string='Scouting relazione',
        help='Risultati dello scouting automatico generato dal charter.')
    x_v6_scouting_updated_at = fields.Datetime(
        string='Scouting aggiornato il', readonly=True)

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


    def action_send_split_to_sign(self):
        """23/09/2026: invia accordo split V6 al consulente per firma
        digitale (Documenso). Se i dati fiscali mancano, non invia:
        il consulente li compila in dashboard e poi rilancia.
        Riusa il motore Typst e il modello sign.request gia' esistenti."""
        self.ensure_one()
        if not self.x_v6_revenue_split:
            return {'error': 'Nessuno split definito'}

        import json as _json
        try:
            split = _json.loads(self.x_v6_revenue_split)
        except Exception:
            return {'error': 'Split malformato'}

        consulenti = [b for b in (split.get('beneficiari') or [])
                       if b.get('tipo') == 'consulente']
        if not consulenti:
            return {'error': 'Nessun consulente nello split'}

        # 25/09/2026: prima di creare i nuovi sign request, annulla tutti
        # quelli vecchi (sent/viewed) dello stesso progetto -> altrimenti
        # il consulente riceve 3 email con 3 link diversi e rischia di
        # firmare la versione sbagliata (bug trovato su Christian: aveva
        # sr 11, 8, 7 tutti 'sent' contemporaneamente).
        SignReq = self.env['erpv6.sign.request'].sudo()
        orphans = SignReq.search([
            ('split_project_id', '=', self.id),
            ('status', 'in', ['draft', 'sent', 'viewed']),
        ])
        for orphan in orphans:
            try:
                # Usa action_cancel (chiama adapter Documenso + log)
                try:
                    orphan.action_cancel()
                except Exception:
                    _logger.warning('action_cancel fallito per sr %s, forzo cancelled', orphan.id)
                    orphan.write({'status': 'cancelled'})
                _logger.info('Annullato sign request orfano %s (split %s)',
                             orphan.id, self.id)
            except Exception:
                _logger.exception('Cancel sign request orfano %s fallito', orphan.id)

        Partner = self.env['res.partner'].sudo()
        sent = []
        missing_data = []
        for b in consulenti:
            pid = b.get('res_partner_id')
            if not pid:
                continue
            partner = Partner.browse(pid)
            if not partner.exists():
                continue
            # check dati fiscali obbligatori
            missing = []
            if not partner.l10n_it_codice_fiscale:
                missing.append('codice_fiscale')
            if not partner.street or not partner.city or not partner.zip:
                missing.append('indirizzo')
            if missing:
                missing_data.append({
                    'partner_id': pid,
                    'partner_name': partner.name,
                    'missing': missing,
                })
                # 25/09/2026: crea un sign request in DRAFT per dare visibilita'
                # nella tab /admin/firme. Prima non creava nulla -> il consulente
                # in attesa dati non appariva da nessuna parte. Quando compilera'
                # i dati (consultant_me_api), action_send_split_to_sign verra'
                # richiamato e il draft diventera' 'sent' col PDF generato.
                try:
                    SignReq.create({
                        'name': f'Accordo Split V6 — {self.name} — {partner.name}',
                        'partner_id': pid,
                        'split_project_id': self.id,
                        'related_kind': 'split_v6',
                        'related_id': self.id,
                        'related_model': 'erpv6.tracking.relation',
                        'status': 'draft',
                        'notes': f"In attesa dati fiscali: {', '.join(missing)}",
                    })
                    _logger.info(
                        'Creato sign request draft per partner %s (dati mancanti: %s)',
                        pid, missing,
                    )
                except Exception:
                    _logger.exception('Creazione sign request draft fallita per partner %s', pid)
                continue

            # genera PDF + sign request
            try:
                result = self._generate_split_sign_request(partner, b, split)
                if result.get('sign_request_id'):
                    sent.append({
                        'partner_id': pid,
                        'sign_request_id': result['sign_request_id'],
                        'sign_url': result.get('sign_url'),
                    })
            except Exception as e:
                _logger.exception('Errore invio firma split per partner %s', pid)
                missing_data.append({'partner_id': pid, 'error': str(e)})

        # aggiorna timestamp
        self.write({'revenue_split_notified_at': fields.Datetime.now()})

        # 23/09/2026: notifica ADMIN (Denis) con riepilogo:
        # - firma inviata con successo
        # - firma NON inviata per dati fiscali mancanti
        try:
            self._notify_admin_split_result(sent, missing_data, consulenti)
        except Exception:
            _logger.exception('Notifica admin split fallita')

        return {
            'sent': sent,
            'missing_data': missing_data,
            'consulenti_totali': len(consulenti),
        }

    def _notify_admin_split_result(self, sent, missing_data, consulenti):
        """Notifica Denis (admin) via EMAIL (non in-app) su invio firma split."""
        from odoo.addons.erpv6_referral.models.system_mail_helper import (
            send_system_mail, get_admin_email,
        )
        admin_email = get_admin_email(self.env)
        if not admin_email:
            _logger.warning('Nessuna email admin configurata, skip notifica')
            return

        for m in (missing_data or []):
            pname = m.get('partner_name') or 'Consulente'
            missing = ', '.join(m.get('missing', []))
            if not missing:
                continue
            body = (
                f'<p><b>{pname}</b> è stato inserito nello split del progetto '
                f'<b>{self.name}</b>.</p>'
                f'<p><b>La firma NON è stata inviata</b> perché mancano i dati fiscali:</p>'
                f'<p style="color:#b45309;"><b>{missing}</b></p>'
                f'<p>Appena li compilerà dalla sua dashboard, il sistema invierà '
                f'automaticamente la firma.</p>'
                f'<p><a href="https://www.v6impresa.it/admin/partner-projects/{self.id}">'
                f'Apri il progetto nell\'admin</a></p>'
            )
            send_system_mail(
                self.env,
                admin_email,
                f'[In attesa] Split {self.name}: {pname} deve completare i dati fiscali',
                body,
                model='erpv6.tracking.relation',
                res_id=self.id,
            )

        for s in (sent or []):
            pid = s.get('partner_id')
            partner = self.env['res.partner'].sudo().browse(pid) if pid else None
            if not partner or not partner.exists():
                continue
            body = (
                f'<p>La richiesta di firma dello split del progetto '
                f'<b>{self.name}</b> è stata <b>inviata</b> a '
                f'<b>{partner.name}</b> ({partner.email}).</p>'
                f'<p>Riceverai una notifica quando avrà firmato.</p>'
                f'<p><a href="https://www.v6impresa.it/admin/partner-projects/{self.id}">'
                f'Apri il progetto</a></p>'
            )
            send_system_mail(
                self.env,
                admin_email,
                f'[Inviata] Firma split {self.name} a {partner.name}',
                body,
                model='erpv6.tracking.relation',
                res_id=self.id,
            )

    def _generate_split_sign_request(self, partner, benefit, split):
        """Genera il PDF accordo split + crea sign.request + invia a Documenso."""
        import json as _json
        from datetime import datetime

        Template = self.env['erpv6.typst.template'].sudo().search(
            [('code', '=', 'SPLIT-V6-001')], limit=1)
        if not Template:
            raise UserError('Template SPLIT-V6-001 non trovato')

        base = split.get('base') or {}
        pct = float(benefit.get('pct') or 0)
        riserva = float(split.get('riserva_v6_pct') or 0)
        base_val = float(base.get('valore') or 0)
        quota_unitaria = base_val * pct / 100

        # indirizzo compatto
        addr_parts = [partner.street or '', partner.street2 or '', 
                      f"{partner.zip or ''} {partner.city or ''}".strip(),
                      partner.state_id.name if partner.state_id else '',
                      partner.country_id.name if partner.country_id else '']
        indirizzo = ', '.join([p for p in addr_parts if p])

        data = {
            'data_generazione': datetime.now().strftime('%d/%m/%Y'),
            'v6_sede': 'Via Roma 1, 20100 Milano (MI)',  # TODO: prendere da config
            'v6_piva': '12345678901',  # TODO: prendere da config
            'consulente_nome': partner.name or '',
            'consulente_email': partner.email or '',
            'consulente_cf': partner.l10n_it_codice_fiscale or '',
            'consulente_piva': partner.vat or '',
            'consulente_indirizzo': indirizzo,
            'progetto_nome': self.name,
            'consulente_pct': f'{pct:.2f}',
            'base_tipo': base.get('tipo') or 'fisso_unita',
            'base_valore': f'{base_val:.2f}',
            'base_unita': base.get('unita') or 'EUR',
            'quota_unitaria': f'{quota_unitaria:.4f}',
            'riserva_pct': f'{riserva:.2f}',
        }

        engine = self.env['erpv6.typst.engine'].sudo()
        typst_doc = engine.generate_document(
            template_id=Template.id,
            res_model='erpv6.tracking.relation',
            res_id=self.id,
            data=data,
        )
        if typst_doc.status != 'ready' or not typst_doc.pdf_file:
            raise UserError(f"Generazione PDF fallita: {typst_doc.error_message}")

        Sign = self.env['erpv6.sign.request'].sudo()
        sign_req = Sign.create({
            'name': f'Accordo Split V6 — {self.name} — {partner.name}',
            'partner_id': partner.id,
            'document_id': typst_doc.id,
            'split_project_id': self.id,
            'related_kind': 'split_v6',
            'related_id': self.id,
            'related_model': 'erpv6.tracking.relation',
            'notes': f'Split V6 {pct}% per progetto {self.name}',
        })
        sign_req.action_send_to_sign()

        return {
            'sign_request_id': sign_req.id,
            'sign_url': sign_req.request_url,
            'external_id': sign_req.external_id,
        }

    @api.constrains('x_v6_revenue_split')
    def _check_min_reserve(self):
        """24/09/2026: la riserva V6 non puo' scendere sotto
        x_v6_min_reserve_pct. Vale anche per scritture via shell/API,
        non solo UI."""
        import json
        for r in self:
            if not r.x_v6_revenue_split:
                continue
            try:
                data = json.loads(r.x_v6_revenue_split)
            except (ValueError, TypeError):
                continue
            riserva = float(data.get('riserva_v6_pct', 100))
            minimo = r.x_v6_min_reserve_pct or 0
            if riserva < minimo:
                raise ValidationError(
                    f"Riserva V6 ({riserva:.1f}%) sotto il minimo "
                    f"configurato per questo progetto ({minimo:.1f}%)"
                )

    def _select_schema_for_relation(self, vals):
        """Seleziona lo schema deal migliore per i parametri dati.

        30/09/2026 (F2 B4): dato un dict con `vertical`, `revenue_model`,
        `relation_type` (root/child), `volume`, ritorna lo schema con più
        matching rispetto ad `applicability_rules`. Vuoto = schema generico
        sempre candidato. Ritorna None se nessuno schema attivo matcha.

        Regola di scoring:
        - +3 se vertical matcha
        - +2 se revenue_model matcha
        - +1 se relation_type matcha
        - +1 se volume dentro range [min, max]
        """
        Schema = self.env['erpv6.deal.schema'].sudo()
        schemas = Schema.search([('active', '=', True), ('locked', '=', False)])

        vertical = (vals.get('vertical') or '').strip()
        revenue_model = (vals.get('revenue_model') or '').strip()
        relation_type = vals.get('relation_type') or 'root'
        volume = vals.get('volume')

        best = None
        best_score = 0
        for s in schemas:
            rules = s.applicability_rules or {}
            if not isinstance(rules, dict) or not rules:
                # Schema generico senza regole: score 1 di base (fallback)
                if best is None:
                    best = s
                    best_score = 1
                continue

            score = 0
            verts = rules.get('verticals') or []
            if vertical and verts and vertical in verts:
                score += 3
            revs = rules.get('revenue_models') or []
            if revenue_model and revs and revenue_model in revs:
                score += 2
            rts = rules.get('relation_types') or []
            if relation_type in rts:
                score += 1
            if volume is not None:
                vmin = rules.get('min_volume')
                vmax = rules.get('max_volume')
                try:
                    vn = float(volume)
                    ok_min = (vmin is None or vn >= float(vmin))
                    ok_max = (vmax is None or vn <= float(vmax))
                    if ok_min and ok_max:
                        score += 1
                except (TypeError, ValueError):
                    pass

            if score > best_score:
                best_score = score
                best = s

        # 30/09/2026 (fix): fallback intelligente.
        # Se nessuno schema ha matchato (best_score = 0) ma esistono schemi
        # attivi, ritorna il primo per non lasciare il form vuoto.
        # L'admin vede comunque il dropdown e può cambiare.
        if best is None and schemas:
            best = schemas[0]
            _logger.info(
                '_select_schema_for_relation: nessun match, fallback a %s',
                best.code)

        return best

    def _propagate_schema_to_children(self):
        """Propaga lo schema del padre ai figli che non ne hanno uno.

        30/09/2026 (F2 B4): quando un padre riceve uno schema (o lo cambia),
        i figli senza schema esplicito lo ereditano. I figli con schema
        esplicito mantengono il loro.
        """
        self.ensure_one()
        if not self.schema_id:
            return 0
        children = self.search([
            ('parent_id', '=', self.id),
            ('schema_id', '=', False),
        ])
        if not children:
            return 0
        children.write({
            'schema_id': self.schema_id.id,
            'schema_applied_at': fields.Datetime.now(),
        })
        return len(children)

    def _scouting_generate_plan(self, charter, project_name):
        """Genera il PIANO scouting (queries + sources) via AI.

        01/10/2026 (F3.A v2): il piano è dinamico. L'AI legge nome progetto
        + charter, e sceglie QUAИ quali fonti dal catalogo usare e con quali
        query. Niente più hardcoded "wikipedia + trends".
        """
        self.ensure_one()
        import json as _json
        Bridge = self.env['erpv6.omni.bridge'].sudo()

        # Fonti disponibili: le leggo dal catalogo
        available = self.env['erpv6.deep.source.config'].sudo().search([
            ('is_active', '=', True),
        ])
        sources_list = [
            {'fetch_type': c.fetch_type, 'name': c.name}
            for c in available if c.fetch_type
        ]
        if not sources_list:
            return None

        prompt = f"""Sei un analista di scouting B2B. Devi generare un piano di arricchimento per un progetto partner, con dati di mercato aggiornati.

PROGETTO: {project_name}

CHARTER (compilato dall'utente, può essere vuoto):
- Settore: {charter.get('pitchSettore') or 'non specificato'}
- Origine: {charter.get('origin') or 'non specificato'}
- Contesto normativo: {charter.get('regulatoryContext') or 'non specificato'}
- Requisiti: {charter.get('requirements') or 'non specificato'}
- Termini commerciali: {charter.get('commercialTerms') or 'non specificato'}

FONTI DISPONIBILI (usa SOLO queste fetch_type):
{_json.dumps(sources_list, ensure_ascii=False, indent=2)}

Genera ESATTAMENTE 3 query di ricerca (max 5 parole ciascuna) e assegnale alle fonti.

Rispondi SOLO con un JSON valido (no markdown, no testo attorno):
{{
  "queries": ["query1", "query2", "query3"],
  "plan": [
    {{"fetch_type": "<una delle fetch_type sopra>", "query": "query1", "rationale": "perché"}},
    {{"fetch_type": "...", "query": "query2", "rationale": "..."}},
    {{"fetch_type": "...", "query": "query3", "rationale": "..."}}
  ]
}}"""

        try:
            res = Bridge.execute_ai_task(
                task_type='scouting_plan_generation',
                prompt=prompt,
                context={'relation_id': self.id},
            )
            if not res.get('success'):
                _logger.warning('_scouting_generate_plan AI KO: %s', res.get('error'))
                return None

            # Estrazione: struttura OpenAI-compatible (Gemini via OmniRoute)
            # res = {'success': True, 'data': {'choices': [{'message': {'content': '...'}}]}}
            content = ''
            data = res.get('data') or {}
            choices = data.get('choices') if isinstance(data, dict) else None
            if choices and isinstance(choices, list):
                first = choices[0] or {}
                msg = first.get('message') or {}
                content = (msg.get('content') or '').strip()
            # Fallback: campo diretto (altri provider)
            if not content:
                content = (res.get('content') or res.get('response') or '').strip()
            # Pulizia markdown
            if content.startswith('```'):
                content = content.split('```')[1]
                if content.startswith('json'):
                    content = content[4:].strip()
                content = content.strip('`').strip()
            # A volte l'AI include "JSON:" o simile
            if ':' in content.split('\n')[0] and not content.startswith('{'):
                content = content.split(':', 1)[1].strip()

            return _json.loads(content)
        except Exception as e:
            _logger.warning('_scouting_generate_plan parse KO: %s', e)
            return None

    def _scouting_execute_step(self, step):
        """Esegue un singolo step del piano (fetch_type + query)."""
        self.ensure_one()
        ft = step.get('fetch_type')
        q = step.get('query')
        if not ft or not q:
            return None

        Config = self.env['erpv6.deep.source.config'].sudo()
        cfg = Config.search([('fetch_type', '=', ft), ('is_active', '=', True)], limit=1)
        if not cfg:
            _logger.debug('scouting: nessuna config per fetch_type=%s', ft)
            return {'fetch_type': ft, 'query': q, 'error': 'config non trovata'}

        # Parametri context in base al tipo di fonte
        ctx_map = {
            'wikipedia': {'topic': q},
            'google_trends': {'keyword': q},
            'amazon': {'query': q},
        }
        ctx = ctx_map.get(ft, {'query': q, 'topic': q})

        try:
            result = self.env['erpv6.deep.source.engine'].sudo().search_and_extract(
                source_config_id=cfg.id,
                context_extra=ctx,
                extraction_schema_override=cfg.default_extraction_schema,
            )
            return {
                'fetch_type': ft,
                'query': q,
                'rationale': step.get('rationale', ''),
                'kb_id': result.id if hasattr(result, 'id') else None,
            }
        except Exception as e:
            _logger.warning('scouting step %s/%s KO: %s', ft, q, e)
            return {'fetch_type': ft, 'query': q, 'error': str(e)}

    def action_run_scouting_from_charter(self):
        """Scouting automatico: AI genera piano, sistema esegue.

        01/10/2026 (F3.A v2): refactor. Legge nome progetto + charter,
        chiede all'AI il PIANO (queries + sources dal catalogo), esegue,
        aggrega su x_v6_scouting.
        """
        self.ensure_one()
        import json as _json
        from odoo import fields as _fields

        charter_raw = self.x_v6_charter or '{}'
        try:
            charter = _json.loads(charter_raw) if isinstance(charter_raw, str) else (charter_raw or {})
        except Exception:
            charter = {}

        # 1. Genera piano via AI
        plan = self._scouting_generate_plan(charter, self.name)

        queries = (plan or {}).get('queries') or []
        steps = (plan or {}).get('plan') or []

        # Fallback: se AI KO, uso il nome progetto
        if not queries:
            queries = [self.name]
            steps = [{'fetch_type': 'wikipedia', 'query': self.name, 'rationale': 'Fallback (AI KO)'}]

        # 2. Esegui ogni step del piano
        # 01/10/2026: separo ok da errori. Tengo entrambi nei risultati (audit)
        # ma sources_used conta solo quelle che hanno funzionato davvero.
        results = []
        sources_used = set()
        for step in steps:
            r = self._scouting_execute_step(step)
            if r:
                results.append(r)
                if 'error' not in r:
                    sources_used.add(r['fetch_type'])

        # 3. Salva aggregato
        payload = {
            'schemaVersion': 2,
            'generated_at': _fields.Datetime.now().isoformat() + 'Z',
            'generated_by': 'auto',
            'project_name': self.name,
            'charter_hash': hash(_json.dumps(charter, sort_keys=True, default=str)) & 0xFFFFFFFF,
            'queries': queries,
            'sources_used': list(sources_used),
            'results': results,
        }

        self.write({
            'x_v6_scouting': _json.dumps(payload, ensure_ascii=False, default=str),
            'x_v6_scouting_updated_at': _fields.Datetime.now(),
        })

        # 4. Log su chatter
        try:
            self.message_post(
                body=f'🔍 <b>Scouting automatico</b>: {len(queries)} query su {len(sources_used)} fonti.<br/>'
                     f'Query: {" · ".join(queries)}'
            )
        except Exception:
            pass

        return {
            'success': True,
            'queries': queries,
            'sources_used': list(sources_used),
            'results_count': len(results),
        }

    @api.model_create_multi
    def create(self, vals_list):
        """Override create: trigger scouting automatico su progetti root.

        01/10/2026 (F3.A v2): quando viene creato un progetto padre
        (parent_id=False, child_kind != 'parte'), dopo il commit della
        transazione lancio in background lo scouting dal charter.
        L'utente non aspetta — la pagina si apre subito, lo scouting
        appare in 20-60 sec se ricarica.
        """
        records = super().create(vals_list)
        for rec in records:
            if rec.parent_id:
                continue
            # 01/10/2026: rimossa esclusione child_kind='parte'. I progetti
            # reali (26 GO, 21 AV) hanno child_kind='parte' per dato storico.
            # Basta parent_id=None per essere root.
            try:
                self.env.cr.postcommit.add(
                    lambda rid=rec.id: self._scouting_after_commit(rid)
                )
            except Exception as e:
                _logger.debug('postcommit add skip: %s', e)
        return records

    @api.model
    def _scouting_after_commit(self, relation_id):
        """Esegue lo scouting in un nuovo cursor dopo il commit.

        Best effort: se fallisce, log e pace. Non blocca mai nulla.
        """
        try:
            with self.pool.cursor() as new_cr:
                new_env = api.Environment(new_cr, self.env.uid, self.env.context)
                rel = new_env['erpv6.tracking.relation'].sudo().browse(relation_id)
                if not rel.exists():
                    return
                result = rel.action_run_scouting_from_charter()
                _logger.info('scouting post-commit rel %s: %s', relation_id, result)
                new_cr.commit()
        except Exception as e:
            _logger.warning('scouting post-commit KO rel %s: %s', relation_id, e)

    def write(self, vals):
        """Override write: se cambia x_v6_charter, ri-trigger scouting.

        01/10/2026 (F3.A v2): il charter può essere compilato dopo la
        creazione. Con debounce 5 min per non martellare AI mentre l'utente
        compila campo per campo.
        """
        charter_changed = 'x_v6_charter' in vals and bool(vals.get('x_v6_charter'))
        result = super().write(vals)

        if charter_changed:
            for rec in self:
                if rec.parent_id:
                    continue
                # Debounce: se ultimo scouting < 5 min fa, skip
                if rec.x_v6_scouting_updated_at:
                    delta = (fields.Datetime.now() - rec.x_v6_scouting_updated_at).total_seconds()
                    if delta < 300:
                        _logger.info(
                            'scouting debounce: rel %s aggiornata %ss fa, skip',
                            rec.id, int(delta))
                        continue
                try:
                    self.env.cr.postcommit.add(
                        lambda rid=rec.id: self._scouting_after_commit(rid)
                    )
                except Exception as e:
                    _logger.debug('postcommit write add skip: %s', e)
        return result

    @api.model
    def action_create_deal(self, params):
        """28/09/2026: crea figlio progetto + deal + variabili iniziali.
        Riceve un dict `params`:
          parent_id (req), seller_partner_id (req), buyer_partner_id (req),
          nome, volume_month, prezzo_base, fee_pct, durata_mesi,
          revenue_model, schema_code, unit
        """
        parent_id = params.get('parent_id')
        seller_partner_id = params.get('seller_partner_id')
        buyer_partner_id = params.get('buyer_partner_id')
        volume_month = params.get('volume_month', 100000)
        prezzo_base = params.get('prezzo_base', 222.30)
        fee_pct = params.get('fee_pct', 4.5)
        durata_mesi = params.get('durata_mesi', 12)
        revenue_model = params.get('revenue_model', 'fee')
        schema_code = params.get('schema_code', 'TEE-ROLLING-001')
        unit = params.get('unit', 'TEE')
        nome = params.get('nome')
        # 05/10/2026 (C-attribution-1d): link opzionale al portfolio
        # di origine. Il deal NON copia i campi attribuzione: linka,
        # e l'attribuzione si legge dal portfolio.
        source_portfolio_id = params.get('source_portfolio_id')
        parent = self.browse(parent_id)
        if not parent.exists():
            raise UserError('Progetto padre non trovato')
        if parent.parent_id:
            raise UserError('Il deal va creato su un progetto radice.')

        Seller = self.env['res.partner'].sudo().browse(seller_partner_id)
        Buyer = self.env['res.partner'].sudo().browse(buyer_partner_id)
        if not Seller.exists() or not Buyer.exists():
            raise UserError('Venditore o compratore non trovati.')

        # Nome: dal chiamante o auto-generato da placeholder/name
        def _display(p):
            if p.is_placeholder and p.placeholder_code:
                return p.placeholder_code
            return p.name or '—'

        if not nome:
            nome = f'{parent.name} — Deal ({_display(Seller)} -> {_display(Buyer)})'

        # 1. Figlio progetto (uso action_create_subproject esistente)
        child = self.env['erpv6.tracking.relation'].sudo().create({
            'name': nome,
            'parent_id': parent_id,
            'child_kind': 'progetto',
            'partner_id': self.env.company.partner_id.id,
            'state': 'attivo',
        })

        # 2. Schema deal — usa schema_code se passato, altrimenti auto-selezione
        Schema = self.env['erpv6.deal.schema'].sudo()
        if schema_code:
            schema = Schema.search([('code', '=', schema_code)], limit=1)
            if not schema:
                raise UserError(f'Schema "{schema_code}" non trovato.')
        else:
            # 30/09/2026 (F2 B4): auto-selezione tramite applicability_rules
            schema = parent._select_schema_for_relation({
                'vertical': getattr(parent, 'vertical', None),
                'revenue_model': revenue_model,
                'relation_type': 'root',
                'volume': volume_month * 12 if volume_month else None,
            })
            if not schema:
                raise UserError(
                    'Nessuno schema applicabile trovato per i parametri correnti. '
                    'Specifica schema_code oppure configura applicability_rules.'
                )

        # 3. Deal
        # 3.bis: assegna schema al padre se non ne ha (una sola volta)
        if not parent.schema_id:
            parent.write({
                'schema_id': schema.id,
                'schema_applied_at': fields.Datetime.now(),
            })
            # Propaga anche ai figli esistenti che non hanno schema
            parent._propagate_schema_to_children()

        Deal = self.env['erpv6.deal'].sudo()
        deal_vals = {
            'name': nome,
            'relation_id': child.id,
            'schema_id': schema.id,
            'seller_id': seller_partner_id,
            'buyer_id': buyer_partner_id,
            'revenue_model': revenue_model,
            'state': 'forecasting',
        }
        if source_portfolio_id:
            deal_vals['source_portfolio_id'] = source_portfolio_id
        deal = Deal.create(deal_vals)

        # 4. Variabili iniziali (source=manual, enabled=True)
        Var = self.env['erpv6.deal.variable'].sudo()
        Var.create([
            {'deal_id': deal.id, 'name': 'prezzo_tee', 'label': 'Prezzo unitario',
             'unit': 'EUR/' + unit, 'value_base': prezzo_base,
             'source': 'manual', 'enabled': True},
            {'deal_id': deal.id, 'name': 'quantita_mese', 'label': 'Quantità mensile',
             'unit': unit, 'value_base': volume_month,
             'source': 'manual', 'enabled': True},
            {'deal_id': deal.id, 'name': 'fee_v6_pct', 'label': 'Fee V6',
             'unit': '%', 'value_base': fee_pct,
             'source': 'manual', 'enabled': True},
            {'deal_id': deal.id, 'name': 'durata_mesi', 'label': 'Durata',
             'unit': 'mesi', 'value_base': durata_mesi,
             'source': 'manual', 'enabled': True},
        ])

        _logger.info('Deal %s creato da %s (parent %s)',
                     deal.id, nome, parent_id)
        return {
            'project_id': child.id,
            'deal_id': deal.id,
            'name': nome,
        }
