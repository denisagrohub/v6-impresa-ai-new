# -*- coding: utf-8 -*-
from odoo import http, _
from odoo.http import request
from odoo.exceptions import AccessError, ValidationError
import logging
import json

_logger = logging.getLogger(__name__)


class BandiAPI(http.Controller):
    """API JSON-RPC per il frontend Next.js"""

    @http.route('/api/v6/bandi/search', type='json', auth='user', methods=['POST'], csrf=False)
    def search_bandi(self, source_id=None, query=None):
        """Ricerca bandi da una fonte specifica"""
        try:
            if source_id:
                source = request.env['erpv6.bando.source'].browse(int(source_id))
                if not source.exists():
                    return {'error': 'Fonte non trovata'}
                source.action_scrape_now()
            
            domain = []
            if query:
                domain = ['|', ('name', 'ilike', query), ('ente', 'ilike', query)]
            
            bandi = request.env['erpv6.bando'].search(domain, limit=50)
            return {
                'success': True,
                'data': [{
                    'id': b.id,
                    'name': b.name,
                    'code': b.code,
                    'ente': b.ente,
                    'importo_max': b.importo_max,
                    'scadenza_domanda': b.scadenza_domanda.isoformat() if b.scadenza_domanda else None,
                    'status': b.status,
                } for b in bandi]
            }
        except Exception as e:
            _logger.error(f"Errore search_bandi: {str(e)}")
            return {'error': str(e)}

    @http.route('/api/v6/bandi/match', type='json', auth='user', methods=['POST'], csrf=False)
    def match_bandi(self, partner_id=None, project_id=None):
        """Calcola match tra bandi e cliente/progetto"""
        try:
            domain = [('partner_id', '=', int(partner_id))] if partner_id else []
            if project_id:
                domain.append(('project_id', '=', int(project_id)))
            
            matches = request.env['erpv6.bando.match'].search(domain, order='eligibility_score DESC')
            return {
                'success': True,
                'data': [{
                    'id': m.id,
                    'bando_id': m.bando_id.id,
                    'bando_name': m.bando_id.name,
                    'partner_id': m.partner_id.id,
                    'eligibility_score': m.eligibility_score,
                    'eligibility_level': m.eligibility_level,
                    'importo_stimato': m.importo_stimato,
                    'status': m.status,
                } for m in matches]
            }
        except Exception as e:
            _logger.error(f"Errore match_bandi: {str(e)}")
            return {'error': str(e)}

    @http.route('/api/v6/bandi/active', type='json', auth='user', methods=['GET'], csrf=False)
    def get_active_bandi(self):
        """Restituisce bandi attivi con match >70%"""
        try:
            bandi = request.env['erpv6.bando'].search([
                ('status', '=', 'active'),
                ('match_ids.eligibility_score', '>', 70)
            ], order='scadenza_domanda ASC')
            
            return {
                'success': True,
                'data': [{
                    'id': b.id,
                    'name': b.name,
                    'code': b.code,
                    'ente': b.ente,
                    'importo_max': b.importo_max,
                    'scadenza_domanda': b.scadenza_domanda.isoformat() if b.scadenza_domanda else None,
                    'match_count': b.match_count,
                    'best_score': max(b.match_ids.mapped('eligibility_score')) if b.match_ids else 0,
                } for b in bandi]
            }
        except Exception as e:
            _logger.error(f"Errore get_active_bandi: {str(e)}")
            return {'error': str(e)}

    @http.route('/api/v6/bandi/application', type='json', auth='user', methods=['POST'], csrf=False)
    def create_application(self, match_id=None, documents=None):
        """Crea una nuova candidatura"""
        try:
            if not match_id:
                return {'error': 'Match ID richiesto'}
            
            match = request.env['erpv6.bando.match'].browse(int(match_id))
            if not match.exists():
                return {'error': 'Match non trovato'}
            
            application = request.env['erpv6.bando.application'].create({
                'match_id': match.id,
                'status': 'draft',
            })
            
            return {
                'success': True,
                'application_id': application.id,
                'message': 'Candidatura creata con successo'
            }
        except Exception as e:
            _logger.error(f"Errore create_application: {str(e)}")
            return {'error': str(e)}

    @http.route('/api/v6/bandi/dashboard', type='json', auth='user', methods=['GET'], csrf=False)
    def get_dashboard_stats(self):
        """Restituisce statistiche per la dashboard"""
        try:
            bando_obj = request.env['erpv6.bando']
            match_obj = request.env['erpv6.bando.match']
            application_obj = request.env['erpv6.bando.application']
            
            active_bandi = bando_obj.search_count([('status', '=', 'active')])
            high_score_matches = match_obj.search_count([('eligibility_score', '>', 70)])
            submitted_applications = application_obj.search_count([('status', '=', 'submitted')])
            funded_amount = sum(application_obj.search([('status', '=', 'funded')]).mapped('funded_amount'))
            
            return {
                'success': True,
                'data': {
                    'active_bandi': active_bandi,
                    'high_score_matches': high_score_matches,
                    'submitted_applications': submitted_applications,
                    'total_funded': funded_amount,
                }
            }
        except Exception as e:
            _logger.error(f"Errore get_dashboard_stats: {str(e)}")
            return {'error': str(e)}
