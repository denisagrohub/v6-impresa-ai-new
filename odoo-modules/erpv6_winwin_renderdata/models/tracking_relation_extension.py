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
            ('status', 'in', ['sent', 'viewed']),
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
