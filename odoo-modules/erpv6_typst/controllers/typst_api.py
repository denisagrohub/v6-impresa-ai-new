# -*- coding: utf-8 -*-

import json
import logging
from datetime import datetime
from odoo import http
from odoo.http import request, Response
from odoo.exceptions import AccessError, ValidationError

_logger = logging.getLogger(__name__)


class TypstAPIController(http.Controller):
    """
    API JSON-RPC per la generazione documenti Tipst
    Chiamate dal frontend Next.js
    """

    @http.route('/api/v6/typst/templates', type='json', auth='user', methods=['POST'], csrf=False)
    def get_templates(self, category=None, language=None):
        """
        Ottiene lista template disponibili
        :param category: filtro per categoria (opzionale)
        :param language: filtro per lingua (opzionale)
        :return: lista di template con metadati
        """
        domain = [('active', '=', True)]
        
        if category:
            domain.append(('category', '=', category))
        if language:
            domain.append(('language', '=', language))
        
        templates = request.env['erpv6.typst.template'].sudo().search(domain, order='sequence, name')
        
        result = []
        for tpl in templates:
            result.append({
                'id': tpl.id,
                'code': tpl.code,
                'name': tpl.name,
                'category': tpl.category,
                'language': tpl.language,
                'description': tpl.description,
                'required_fields': tpl.required_fields,
                'page_size': tpl.page_size,
                'orientation': tpl.orientation,
            })
        
        return {'templates': result}

    @http.route('/api/v6/typst/render', type='json', auth='user', methods=['POST'], csrf=False)
    def render_document(self, template_code, data, partner_id=None, project_id=None, context_extra=None):
        """
        Genera un documento PDF da un template e dati
        :param template_code: codice univoco del template
        :param data: dizionario JSON con i dati per il rendering
        :param partner_id: ID del partner (opzionale)
        :param project_id: ID del progetto/lead (opzionale)
        :param context_extra: contesto aggiuntivo (opzionale)
        :return: {document_id, status, pdf_url, error}
        """
        try:
            # Trova template
            template = request.env['erpv6.typst.template'].sudo().search([('code', '=', template_code)], limit=1)
            if not template:
                return {'error': f"Template '{template_code}' non trovato"}
            
            # Prepara dati di rendering (merge con dati contestuali)
            render_data = dict(data)
            
            # Aggiungi metadati contestuali se forniti
            if partner_id:
                partner = request.env['res.partner'].sudo().browse(partner_id)
                render_data['partner'] = {
                    'name': partner.name,
                    'vat': partner.vat,
                    'address': partner.contact_address,
                    'email': partner.email,
                    'phone': partner.phone,
                }
            
            if project_id:
                project = request.env['crm.lead'].sudo().browse(project_id)
                render_data['project'] = {
                    'name': project.name,
                    'expected_revenue': project.expected_revenue,
                    'probability': project.probability,
                    'description': project.description,
                }
            
            # Crea record documento
            doc_values = {
                'name': f"{template.name} - {datetime.now().strftime('%Y-%m-%d %H:%M')}",
                'template_id': template.id,
                'partner_id': partner_id,
                'project_id': project_id,
                'render_data': render_data,
                'status': 'draft',
            }
            
            if context_extra and context_extra.get('bando_match_id'):
                doc_values['bando_match_id'] = context_extra['bando_match_id']
            
            document = request.env['erpv6.typst.document'].sudo().create(doc_values)
            
            # Avvia rendering (in produzione: chiamata asincrona a servizio esterno)
            # Qui chiamiamo il metodo che si occupa di generare
            document.action_render()
            
            # Se il rendering è immediato (simulazione), ritorna URL download
            if document.status == 'ready':
                pdf_url = f"/web/content/erpv6.typst.document/{document.id}/pdf_file/{document.pdf_filename or 'documento.pdf'}?download=true"
                return {
                    'document_id': document.id,
                    'status': document.status,
                    'pdf_url': pdf_url,
                    'created_at': document.created_at.isoformat(),
                }
            else:
                # Rendering asincrono: ritorna ID per polling
                return {
                    'document_id': document.id,
                    'status': document.status,
                    'message': 'Rendering in corso. Controlla lo stato.',
                }
        
        except Exception as e:
            _logger.error(f"Errore rendering documento: {e}", exc_info=True)
            return {'error': str(e)}

    @http.route('/api/v6/typst/document/<int:doc_id>/status', type='json', auth='user', methods=['POST'], csrf=False)
    def get_document_status(self, doc_id):
        """
        Ottiene lo stato di un documento in rendering
        :param doc_id: ID del documento
        :return: {status, progress, error, pdf_url}
        """
        try:
            document = request.env['erpv6.typst.document'].sudo().browse(doc_id)
            if not document.exists():
                return {'error': 'Documento non trovato'}
            
            result = {
                'status': document.status,
                'error': document.error_message,
                'created_at': document.created_at.isoformat(),
                'rendered_at': document.rendered_at.isoformat() if document.rendered_at else None,
            }
            
            if document.status == 'ready' and document.pdf_file:
                result['pdf_url'] = f"/web/content/erpv6.typst.document/{doc_id}/pdf_file/{document.pdf_filename or 'documento.pdf'}?download=true"
                result['file_size'] = document.file_size
            
            return result
        
        except Exception as e:
            _logger.error(f"Errore recupero stato documento: {e}", exc_info=True)
            return {'error': str(e)}

    @http.route('/api/v6/typst/document/<int:doc_id>/send', type='json', auth='user', methods=['POST'], csrf=False)
    def send_document(self, doc_id, email_custom=None):
        """
        Invia documento al partner via email
        :param doc_id: ID del documento
        :param email_custom: email personalizzata (opzionale, altrimenti usa quella del partner)
        :return: {success, message}
        """
        try:
            document = request.env['erpv6.typst.document'].sudo().browse(doc_id)
            if not document.exists():
                return {'error': 'Documento non trovato'}
            
            if document.status != 'ready':
                return {'error': 'Il documento non è pronto per l\'invio'}
            
            # Se email custom, override temporaneo
            original_email = None
            if email_custom and document.partner_id:
                original_email = document.partner_id.email
                document.partner_id.email = email_custom
            
            document.action_send_to_partner()
            
            # Ripristina email originale se modificata
            if original_email and document.partner_id:
                document.partner_id.email = original_email
            
            return {
                'success': True,
                'message': f"Documento inviato a {email_custom or document.partner_id.email}",
                'sent_at': document.sent_at.isoformat() if document.sent_at else None,
            }
        
        except Exception as e:
            _logger.error(f"Errore invio documento: {e}", exc_info=True)
            return {'error': str(e)}

    @http.route('/api/v6/typst/business-plan/data', type='json', auth='user', methods=['POST'], csrf=False)
    def get_business_plan_data(self, project_id):
        """
        Estrae tutti i dati necessari per generare un Business Plan da un progetto CRM
        :param project_id: ID del progetto/lead
        :return: dati strutturati per il template Business Plan
        """
        try:
            project = request.env['crm.lead'].sudo().browse(project_id)
            if not project.exists():
                return {'error': 'Progetto non trovato'}
            
            partner = project.partner_id or project.contact_name
            
            # Raccogli dati da vari moduli
            data = {
                'executive_summary': {
                    'project_name': project.name,
                    'partner_name': partner.name if partner else '',
                    'date': datetime.now().strftime('%d/%m/%Y'),
                    'description': project.description or '',
                },
                'market_analysis': {
                    'target_market': project.contact_name or 'PMI Italiane',
                    'competitors': [],  # Da arricchire con erpv6_deep_source
                },
                'financial_plan': {
                    'initial_investment': project.expected_revenue or 0,
                    'revenue_projection': [],  # Da calcolare con erpv6_accounting
                    'break_even_point': 0,  # Da calcolare
                },
                'swot_analysis': {
                    'strengths': [],
                    'weaknesses': [],
                    'opportunities': [],
                    'threats': [],
                },
            }
            
            # Se ci sono bandi collegati, aggiungili
            if hasattr(project, 'bando_match_ids'):
                matches = request.env['erpv6.bando.match'].sudo().search([
                    ('partner_id', '=', partner.id if partner else False),
                    ('status', 'in', ['new', 'notified', 'interested'])
                ])
                data['funding_opportunities'] = [
                    {
                        'bando_name': m.bando_id.name,
                        'amount': m.importo_stimato,
                        'eligibility': m.eligibility_score,
                    }
                    for m in matches[:3]  # Top 3 opportunità
                ]
            
            return data
        
        except Exception as e:
            _logger.error(f"Errore estrazione dati business plan: {e}", exc_info=True)
            return {'error': str(e)}
