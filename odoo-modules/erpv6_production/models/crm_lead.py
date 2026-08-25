import logging

from odoo import _, fields, models

_logger = logging.getLogger(__name__)


class CrmLead(models.Model):
    _inherit = 'crm.lead'

    # Ruoli multipli/percentuale di compenso (Denis, 25/08/2026) - vedi
    # erpv6.production.consulente.line. user_id (nativo crm.lead) resta il
    # "consulente di riferimento" per retrocompatibilita' con le record
    # rule esistenti (lead_id.user_id), la struttura vera vive qui.
    consulente_line_ids = fields.One2many(
        'erpv6.production.consulente.line', 'lead_id', string='Consulenti/Referral')

    # ------------------------------------------------------------------
    # Assegnazione automatica del consulente (Denis, 25/08/2026), in
    # ordine di priorita' fisso - NON invertire:
    #   0. Competenza: filtro preliminare, mai un'assegnazione a chi non
    #      e' abilitato per il verticale richiesto (Denis: "il consulente
    #      specializzato in economia del bene comune non puo' gestire un
    #      lead che vuole il fotovoltaico"), anche se fosse l'unico della
    #      zona giusta o l'unico con lo storico giusto.
    #   1. Storico: il consulente competente che ha gia' lavorato con
    #      questo stesso lead/azienda in passato.
    #   2. Zona geografica: tra i consulenti competenti, chi copre la
    #      provincia del lead (res.users.zona_competenza_state_ids).
    #   3. Override del responsabile: action_reassign_consulente (vedi
    #      Erpv6ConsulenteReassignWizard) - immediato, mai automatico.
    #   4. Richiesta del consulente (action_request_assegnazione /
    #      action_request_non_assegnazione) - resta 'in_attesa' finche' un
    #      Responsabile/Admin non la approva (Erpv6ConsulenteRichiesta).
    # Se ne' storico ne' zona trovano un consulente COMPETENTE, nessuna
    # assegnazione automatica "indovinata": si segnala e si ricade sul
    # round-robin del team esistente solo come rete di sicurezza (mai piu'
    # l'utente pubblico), con un'attivita' esplicita che chiede la verifica
    # umana - vedi _promote_to_opportunity.
    # ------------------------------------------------------------------

    def _find_eligible_consulenti(self, verticale_code):
        """Consulenti (gruppo erpv6_core.group_consulente) COMPETENTI per
        il verticale richiesto (criterio 0, ora prioritario su tutto il
        resto - Denis, 25/08/2026), esclusi quelli con una
        erpv6.consulente.richiesta 'non_assegnarmi' gia' approvata su
        QUESTO lead (criterio 4). Se il lead non ha un verticale
        riconosciuto (lead grezzo, non dall'intervista ad albero), nessun
        vincolo di competenza da applicare: non e' un'invenzione di
        requisito, e' l'assenza di uno."""
        self.ensure_one()
        Users = self.env['res.users'].sudo()
        group = self.env.ref('erpv6_core.group_consulente', raise_if_not_found=False)
        if not group:
            return Users
        consulenti = Users.search([('groups_id', 'in', group.ids)])

        excluded = self.env['erpv6.consulente.richiesta'].sudo().search([
            ('lead_id', '=', self.id), ('tipo', '=', 'non_assegnarmi'), ('state', '=', 'approvata'),
        ]).mapped('consulente_id')
        consulenti = consulenti - excluded

        if not verticale_code:
            return consulenti

        eligible = Users
        for consulente in consulenti:
            codes = set(consulente.competenza_verticale_ids.mapped('verticale'))
            codes |= set(consulente.competenza_verticale_ids.child_ids.mapped('verticale'))
            if verticale_code in codes:
                eligible |= consulente
        return eligible

    def _find_storico_consulente(self, eligible):
        """Tra i consulenti competenti (eligible), quello che ha gia'
        lavorato con questo stesso lead/azienda in passato (stesso
        partner_id, o stessa email se il lead non ha ancora un partner) -
        priorita' massima (criterio 1). Cerca sia su altri crm.lead sia
        sulle righe 'delivery' di erpv6.production.consulente.line, piu'
        recente prima. Nessun match se il lead non ha un'identita' reale
        da confrontare (ne' partner ne' email) - non si inventa uno
        storico che non c'e'."""
        self.ensure_one()
        if not eligible:
            return self.env['res.users']

        if self.partner_id:
            domain = [('partner_id', '=', self.partner_id.id), ('id', '!=', self.id)]
        elif self.email_normalized:
            domain = [('email_normalized', '=', self.email_normalized), ('id', '!=', self.id)]
        else:
            return self.env['res.users']

        past_leads = self.env['crm.lead'].sudo().search(
            domain + [('user_id', 'in', eligible.ids)], order='write_date desc')
        if past_leads:
            return past_leads[0].user_id
        return self.env['res.users']

    def _find_zona_consulente(self, eligible):
        """Tra i consulenti competenti (eligible), il primo la cui zona di
        competenza (province, res.users.zona_competenza_state_ids) include
        la provincia del lead (crm.lead.state_id, campo indirizzo gia'
        esistente - nessun nuovo campo 'zona geografica' su crm.lead,
        riusa quello che c'e' gia'). Nessun match se il lead non ha una
        provincia o nessun consulente competente ha dichiarato quella
        provincia - mai un fallback a caso (Denis, 25/08/2026: "nessun
        consulente di zona trovato" e' un esito onesto, non un errore)."""
        self.ensure_one()
        if not eligible or not self.state_id:
            return self.env['res.users']
        for consulente in eligible.sorted('id'):
            if self.state_id in consulente.zona_competenza_state_ids:
                return consulente
        return self.env['res.users']

    def _auto_assign_consulente(self, order=None):
        """Applica i criteri 0->1->2 in ordine e ritorna (res.users o
        recordset vuoto, motivo str). Non scrive nulla qui: la scrittura
        reale (user_id + riga 'delivery') e' sempre _set_delivery_consulente,
        stesso punto usato anche dall'override manuale e dalla richiesta
        approvata - un solo scrittore per non duplicare la logica."""
        self.ensure_one()
        verticale_code = (order.verticale if order else None) or None
        eligible = self._find_eligible_consulenti(verticale_code)
        if not eligible:
            return self.env['res.users'], 'nessuna_competenza'

        storico = self._find_storico_consulente(eligible)
        if storico:
            return storico, 'storico'

        zona = self._find_zona_consulente(eligible)
        if zona:
            return zona, 'zona'

        return self.env['res.users'], 'nessun_match_zona'

    def _set_delivery_consulente(self, user, reason, note=None):
        """Unico scrittore reale dell'assegnazione: imposta user_id sul
        lead (retrocompatibile con le record rule esistenti, che filtrano
        su lead_id.user_id) E aggiorna/crea la riga 'delivery' in
        erpv6.production.consulente.line (dove vivono ruoli multipli e
        percentuale di compenso, Denis 25/08/2026). Usato da: assegnazione
        automatica, override manuale del responsabile, richiesta del
        consulente approvata."""
        self.ensure_one()
        self.sudo().user_id = user.id
        Line = self.env['erpv6.production.consulente.line'].sudo()
        existing = Line.search([('lead_id', '=', self.id), ('role', '=', 'delivery')])
        vals = {'lead_id': self.id, 'role': 'delivery', 'user_id': user.id, 'assignment_reason': reason}
        if note:
            vals['note'] = note
        if existing:
            existing.write(vals)
        else:
            Line.create(vals)
        self.message_post(body=_("Consulente (lavorazione) assegnato: %(user)s (%(reason)s).") % {
            'user': user.name, 'reason': dict(Line._fields['assignment_reason'].selection).get(reason, reason),
        })

    def action_request_assegnazione(self):
        """Bottone per il Consulente: 'vorrei essere assegnato a questo
        lead' - crea SOLO la richiesta, nessuna scrittura reale finche' un
        Responsabile/Admin non approva (vedi Erpv6ConsulenteRichiesta)."""
        self.ensure_one()
        return self.env['erpv6.consulente.richiesta'].create({
            'consulente_id': self.env.user.id, 'lead_id': self.id, 'tipo': 'assegnami',
        })

    def action_request_non_assegnazione(self):
        """Bottone per il Consulente: 'preferirei non essere assegnato a
        questo lead' - stesso gate umano di sopra."""
        self.ensure_one()
        return self.env['erpv6.consulente.richiesta'].create({
            'consulente_id': self.env.user.id, 'lead_id': self.id, 'tipo': 'non_assegnarmi',
        })

    def action_open_reassign_wizard(self):
        """Bottone per il Responsabile/Admin (visibilita' XML + controllo
        ripetuto dentro il wizard): apre Erpv6ConsulenteReassignWizard."""
        self.ensure_one()
        return {
            'type': 'ir.actions.act_window',
            'res_model': 'erpv6.consulente.reassign.wizard',
            'view_mode': 'form',
            'target': 'new',
            'context': {'default_lead_id': self.id},
        }

    def _start_production(self, score=None, package_hint=None, verticale=None,
                           budget=None, tempistiche=None, tipo_progetto=None,
                           destinatario=None, fatturato=None, **kwargs):
        """Crea la prima erpv6.production.order per questo lead, in fase
        iniziale 'diagnostica'. Chiamato da lead_api.py (stesso pattern
        hasattr/duck-typing gia' usato per _start_funnel), sia sulla
        creazione iniziale (anche di un lead grezzo non ancora qualificato)
        sia su un successivo arricchimento (salvataggio progressivo
        dell'intervista) - per questo e' idempotente: se esiste gia' una
        produzione per questo lead, la aggiorna invece di duplicarla.

        NON crea qui il project.project: un lead grezzo non ancora
        qualificato non merita un progetto reale in Progetti (vedi
        _promote_to_opportunity) - la produzione resta la traccia interna
        di acquisizione, il progetto arriva solo alla qualificazione.
        """
        self.ensure_one()
        order = self.env['erpv6.production.order'].sudo().search([('lead_id', '=', self.id)], limit=1)
        if order:
            update_vals = {}
            if score is not None:
                update_vals['interview_score'] = score
            if package_hint is not None:
                update_vals['interview_package_hint'] = package_hint
            if verticale is not None:
                update_vals['verticale'] = verticale
            if budget is not None:
                update_vals['interview_budget'] = budget
            if tempistiche is not None:
                update_vals['interview_tempistiche'] = tempistiche
            if tipo_progetto is not None:
                update_vals['interview_tipo_progetto'] = tipo_progetto
            if destinatario is not None:
                update_vals['interview_destinatario'] = destinatario
            if fatturato is not None:
                update_vals['interview_fatturato'] = fatturato
            if update_vals:
                order.write(update_vals)
            return order

        initial_phase = self.env.ref('erpv6_production.phase_diagnostica', raise_if_not_found=False)
        order = self.env['erpv6.production.order'].sudo().create({
            'lead_id': self.id,
            'phase_id': initial_phase.id if initial_phase else False,
            'interview_score': score or 0,
            'interview_package_hint': package_hint or '',
            'verticale': verticale or '',
            'interview_budget': budget or '',
            'interview_tempistiche': tempistiche or '',
            'interview_tipo_progetto': tipo_progetto or '',
            'interview_destinatario': destinatario or '',
            'interview_fatturato': fatturato or '',
        })
        self.env['erpv6.production.event'].sudo().create({
            'order_id': order.id,
            'event_type': 'cron_automatico',
            'description': 'Produzione creata automaticamente alla ricezione del lead.',
            'phase_after_id': initial_phase.id if initial_phase else False,
            'decision_method': 'deterministico',
        })
        return order

    def _promote_to_opportunity(self):
        """Promuove un lead grezzo (type='lead') a opportunita' qualificata:
        assegna un venditore reale (mai piu' l'utente pubblico/anonimo con
        cui e' stato creato), notifica con un'attivita', e SOLO ORA crea il
        project.project reale collegato alla produzione gia' in corso - non
        ogni compilazione anonima del form merita un progetto in Progetti,
        solo chi e' stato qualificato. Idempotente: no-op se gia' opportunity."""
        self.ensure_one()
        if self.type == 'opportunity':
            return False
        self.type = 'opportunity'

        orders = self.env['erpv6.production.order'].sudo().search([('lead_id', '=', self.id)])
        for order in orders.filtered(lambda o: not o.project_id):
            project = self.env['project.project'].sudo().create({
                'name': self.name or self.partner_name or self.contact_name or 'Nuovo progetto',
                'user_id': self.user_id.id,
                'partner_id': self.partner_id.id if self.partner_id else False,
            })
            order.project_id = project.id

        # Kairos (erpv6_methodology, motore generico gia' esistente): valuta
        # quando/se vale la pena chiamare subito questo lead invece di
        # nutrirlo prima. Calcolato qui (alla qualificazione), non prima,
        # perche' solo ora un umano deve davvero decidere la priorita'. Se i
        # dati budget/tempistiche non ci sono (es. lead da form contatti, non
        # dall'intervista) niente matrice fabbricata - vedi _compute_kairos_matrix.
        kairos_label = False
        for order in orders:
            try:
                matrix = order._compute_kairos_matrix()
                if matrix and not kairos_label:
                    kairos_label = dict(matrix._fields['quadrante'].selection).get(matrix.quadrante)
            except Exception:
                _logger.exception("Calcolo Kairos fallito per produzione #%s, non bloccante.", order.id)

        # Assegnazione del consulente reale (Denis, 25/08/2026): competenza
        # -> storico -> zona (vedi _auto_assign_consulente). Se nessun
        # criterio trova un consulente COMPETENTE, mai un'assegnazione
        # indovinata - fallback sul round-robin del team (rete di
        # sicurezza, mai piu' l'utente pubblico) con segnalazione esplicita
        # che serve una verifica umana.
        verticale_order = next((o for o in orders if o.verticale), orders[:1])
        chosen, reason = self._auto_assign_consulente(order=verticale_order)
        team = self.team_id
        summary = f"Nuovo lead qualificato da gestire: {self.name}"
        if kairos_label:
            summary += f" — Kairós: {kairos_label}"

        if chosen:
            self._set_delivery_consulente(chosen, reason=reason)
            self.activity_schedule('mail.mail_activity_data_todo', summary=summary, user_id=chosen.id)
        else:
            members = team.crm_team_member_ids.mapped('user_id') if team else self.env['res.users']
            if members:
                self._handle_salesmen_assignment(user_ids=members.ids)
                self.env['erpv6.production.consulente.line'].sudo().create({
                    'lead_id': self.id, 'role': 'delivery', 'user_id': self.user_id.id,
                    'assignment_reason': 'fallback_team',
                })
                self.activity_schedule(
                    'mail.mail_activity_data_todo',
                    summary=f"VERIFICA MANUALE — assegnazione automatica non trovata ({reason}): {self.name}",
                    note=(
                        "Nessun consulente competente/di zona trovato automaticamente "
                        f"(motivo: {reason}). Assegnato provvisoriamente per round-robin sul team "
                        f"'{team.name if team else '(nessun team)'}': verificare e riassegnare se necessario."
                    ),
                    user_id=self.user_id.id,
                )
                if kairos_label:
                    self.message_post(body=f"Kairós: {kairos_label}")
            else:
                _logger.warning(
                    "Nessun membro reale nel team '%s' - lead #%s promosso senza venditore assegnato.",
                    team.name if team else '(nessun team)', self.id,
                )

        # Fa scattare subito il motore (KB/typst/validazione) verso la fase
        # successiva invece di aspettare il prossimo giro di cron (30 min) -
        # e' il punto in cui, quando i template/copy saranno pronti, partono
        # la relazione/preventivo e le eventuali email di nurture.
        try:
            orders.evaluate_and_advance(trigger='opportunity_qualified')
        except Exception:
            _logger.exception("evaluate_and_advance fallito alla promozione del lead #%s.", self.id)
        return True
