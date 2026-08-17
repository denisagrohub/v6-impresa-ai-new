import logging

from odoo import models

_logger = logging.getLogger(__name__)


class CrmLead(models.Model):
    _inherit = 'crm.lead'

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

        team = self.team_id
        members = team.crm_team_member_ids.mapped('user_id') if team else self.env['res.users']
        if members:
            self._handle_salesmen_assignment(user_ids=members.ids)
            summary = f"Nuovo lead qualificato da gestire: {self.name}"
            if kairos_label:
                summary += f" — Kairós: {kairos_label}"
            self.activity_schedule(
                'mail.mail_activity_data_todo',
                summary=summary,
                user_id=self.user_id.id,
            )
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
