# pylint: disable=import-error
"""Lead API Controller - creates CRM leads from frontend."""
import json
import logging
import time

from odoo import http
from odoo.http import request

from .main import APIBaseController

_logger = logging.getLogger(__name__)


class LeadAPIController(APIBaseController):

    @http.route('/api/v1/leads', type='http', auth='none', methods=['POST', 'OPTIONS'], csrf=False)
    def create_lead(self, **kwargs):  # pylint: disable=unused-argument
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})
        start_time = time.time()

        try:
            data = json.loads(request.httprequest.data)
        except json.JSONDecodeError:
            return self._json_response({'error': 'Invalid JSON'}, 400)

        name = data.get('name', '').strip()
        email = data.get('email', '').strip()
        if not name or not email:
            return self._json_response({'error': 'name and email required'}, 400)

        # auth='none': la richiesta non ha una sessione/uid valido, quindi
        # env.user e' un recordset vuoto. .sudo() bypassa solo gli ACL, non
        # imposta un uid: qualunque write su un campo tracked (message_post
        # -> _is_public()) crasha con "Expected singleton: res.users()".
        # Leghiamo l'env all'utente pubblico, la stessa convenzione usata dai
        # controller website/portal nativi di Odoo per scritture anonime.
        env = request.env(user=request.env.ref('base.public_user'))

        # Duplicati
        existing = env['crm.lead'].sudo().search([('email_from', '=', email), ('active', '=', True)], limit=1)
        if existing:
            return self._json_response({'error': 'Lead already exists', 'lead_id': existing.id}, 409)

        company = data.get('company_name', '').strip()
        lead_name = f"Lead Web: {name}"
        if company:
            lead_name += f" - {company}"

        vals = {
            'name': lead_name,
            'contact_name': name,
            'partner_name': company,
            'email_from': email,
            'phone': data.get('phone', ''),
            'description': data.get('description', ''),
            'type': 'opportunity',
        }

        # Campi Fenice (se il modulo e' installato). I campi reali hanno
        # prefisso x_ (convenzione custom-field Odoo): senza, hasattr()
        # falliva sempre e questo mapping non scriveva mai nulla.
        for field, key in [('x_fenice_score', 'fenice_score'), ('x_fenice_livello', 'fenice_livello'),
                           ('x_fenice_moduli_interesse', 'moduli_interesse'),
                           ('x_fenice_fatturato', 'fatturato_stimato'), ('x_fenice_source', 'source')]:
            if key in data and hasattr(env['crm.lead'], field):
                vals[field] = data[key]

        if 'x_fenice_source' not in vals and hasattr(env['crm.lead'], 'x_fenice_source'):
            vals['x_fenice_source'] = 'sito_web'

        try:
            lead = env['crm.lead'].sudo().create(vals)
        except Exception as e:
            _logger.error("Lead creation error: %s", e)
            return self._json_response({'error': 'Creation failed'}, 500)

        # Assegna un venditore reale (mai l'utente pubblico con cui gira
        # questa richiesta): senza questo, create() lascia user_id sul default
        # env.user, cioe' l'utente pubblico stesso - nessun umano risulta mai
        # responsabile del lead, quindi nessuna notifica arriva a nessuno.
        # Round-robin sui membri reali del team gia' assegnato al lead
        # (metodo nativo crm.lead, stesso usato dal wizard di assegnazione
        # Odoo) cosi' resta automatico anche se il team cambia composizione.
        try:
            team = lead.sudo().team_id
            members = team.crm_team_member_ids.mapped('user_id') if team else env['res.users']
            if members:
                lead.sudo()._handle_salesmen_assignment(user_ids=members.ids)
                lead.sudo().activity_schedule(
                    'mail.mail_activity_data_todo',
                    summary=f"Nuovo lead da gestire: {lead.name}",
                    note=f"Lead ricevuto da {data.get('source') or 'sito web'}. Verificare e contattare.",
                    user_id=lead.sudo().user_id.id,
                )
            else:
                _logger.warning(
                    "Nessun membro reale nel team '%s' - lead #%s creato senza venditore assegnato.",
                    team.name if team else '(nessun team)', lead.id,
                )
        except Exception as e:
            _logger.warning("Assegnazione venditore fallita per lead #%s: %s", lead.id, e)

        # Avvia funnel se disponibile
        funnel_started = False
        if data.get('start_funnel', True) and hasattr(lead, '_start_funnel'):
            try:
                lead._start_funnel()
                funnel_started = True
            except Exception as e:
                _logger.warning("Funnel start error: %s", e)

        # Avvia produzione (erpv6_production, se installato). Stesso pattern
        # hasattr di _start_funnel: erpv6_api_gateway resta agnostico, non
        # dichiara erpv6_production come dipendenza.
        if hasattr(lead, '_start_production'):
            try:
                lead._start_production(
                    score=data.get('score'),
                    package_hint=data.get('package_hint') or data.get('packageId') or data.get('livello'),
                    verticale=data.get('verticale') or data.get('settore'),
                )
            except Exception as e:
                _logger.warning("Production start error: %s", e)

        # Webhook
        for wh in env['erpv6.webhook'].sudo().search([('events', '=', 'lead.created'), ('is_active', '=', True)]):
            wh.trigger({'event': 'lead.created', 'lead_id': lead.id, 'email': email})

        self._log_api_call('/api/v1/leads', 'POST', None, 201, start_time)
        return self._json_response({'id': lead.id, 'name': lead.name, 'funnel_started': funnel_started}, 201)

    @http.route('/api/v1/leads/evaluate', type='http', auth='none', methods=['POST', 'OPTIONS'], csrf=False)
    def evaluate_lead(self, **kwargs):  # pylint: disable=unused-argument
        if request.httprequest.method == 'OPTIONS':
            return self._json_response({})

        try:
            data = json.loads(request.httprequest.data)
        except json.JSONDecodeError:
            return self._json_response({'error': 'Invalid JSON'}, 400)

        score = 0
        fatturato = data.get('fatturato', 0)
        if fatturato >= 500000:
            score += 30
        elif fatturato >= 100000:
            score += 15
        elif fatturato > 0:
            score += 5

        dig = data.get('digitalizzazione', 'none')
        if dig == 'avanzato':
            score += 25
        elif dig == 'base':
            score += 10

        if data.get('sostenibilita'):
            score += 15
        if data.get('innovazione'):
            score += 10

        dip = data.get('dipendenti', 0)
        if dip >= 10:
            score += 10
        elif dip >= 5:
            score += 5

        if score >= 93:
            livello = 'IV'
        elif score >= 80:
            livello = 'III'
        elif score >= 65:
            livello = 'II'
        else:
            livello = 'I'

        moduli = []
        if dig in ('none', 'base'):
            moduli.append('Modulo C - Comunicazione')
        if data.get('sostenibilita'):
            moduli.append('BioCircolo')
        if fatturato >= 100000:
            moduli.append('Fenice Procurement')

        return self._json_response({'score': score, 'livello': livello, 'moduli_consigliati': moduli})
