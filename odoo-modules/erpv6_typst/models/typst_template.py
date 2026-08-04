# -*- coding: utf-8 -*-

import logging
import json
from datetime import datetime
from odoo import models, fields, api, _
from odoo.exceptions import UserError, ValidationError

_logger = logging.getLogger(__name__)


class TypstTemplate(models.Model):
    """
    Modello per gestire i template Tipst (.typ)
    I template sono salvati criptati in erpv6_kb e referenziati qui
    """
    _name = 'erpv6.typst.template'
    _description = 'Template Tipst per generazione documenti'
    _order = 'category, sequence, name'

    name = fields.Char(string='Nome Template', required=True)
    code = fields.Char(string='Codice Univoco', required=True, index=True)
    category = fields.Selection([
        ('business_plan', 'Business Plan'),
        ('financial_report', 'Report Finanziario'),
        ('bando_application', 'Candidatura Bando'),
        ('proposal', 'Proposta Commerciale'),
        ('contract', 'Contratto'),
        ('custom', 'Personalizzato'),
    ], string='Categoria', required=True, default='business_plan')
    
    sequence = fields.Integer(string='Sequenza', default=10)
    description = fields.Text(string='Descrizione')
    
    # Riferimento al modulo KB dove è salvato il contenuto .typ criptato
    kb_id = fields.Many2one('erpv6.kb', string='KB Reference')
    
    # Metadati del template
    version = fields.Char(string='Versione', default='1.0')
    language = fields.Selection([
        ('it', 'Italiano'),
        ('en', 'English'),
        ('de', 'Deutsch'),
        ('fr', 'Français'),
    ], string='Lingua', default='it')
    
    # Campi richiesti dal template (JSON schema)
    required_fields = fields.Json(string='Campi Richiesti (JSON Schema)')
    
    # Configurazione rendering
    page_size = fields.Selection([
        ('a4', 'A4'),
        ('a3', 'A3'),
        ('letter', 'Letter'),
        ('legal', 'Legal'),
    ], string='Formato Pagina', default='a4')
    
    orientation = fields.Selection([
        ('portrait', 'Verticale'),
        ('landscape', 'Orizzontale'),
    ], string='Orientamento', default='portrait')
    
    active = fields.Boolean(string='Attivo', default=True)
    
    # Statistiche
    usage_count = fields.Integer(string='Utilizzi', compute='_compute_usage_count')
    last_used = fields.Datetime(string='Ultimo Utilizzo', compute='_compute_usage_count')
    
    _sql_constraints = [
        ('code_unique', 'UNIQUE(code)', 'Il codice del template deve essere univoco!'),
    ]

    @api.depends('kb_id')
    def _compute_usage_count(self):
        Document = self.env['erpv6.typst.document']
        for template in self:
            docs = Document.search([('template_id', '=', template.id)], order='created_at DESC', limit=1)
            template.usage_count = len(Document.search([('template_id', '=', template.id)]))
            template.last_used = docs.created_at if docs else False

    def action_preview_source(self):
        """Restituisce il sorgente .typ decifrato dalla KB (solo per admin)"""
        self.ensure_one()
        if not self.kb_id:
            raise UserError(_("Nessun modulo KB associato a questo template."))
        
        # Decifra il contenuto dalla KB
        content = self.kb_id.get_content_for_ai('typst_preview')
        return {
            'type': 'ir.actions.client',
            'tag': 'display_text',
            'params': {
                'title': f"Anteprima Template: {self.name}",
                'content': content,
            }
        }

    def action_sync_to_kb(self, typst_source_code):
        """
        Salva/aggiorna il template .typ nella KB criptato
        :param typst_source_code: stringa con il codice Tipst
        """
        self.ensure_one()
        
        if not self.code:
            raise ValidationError(_("Il template deve avere un codice univoco."))
        
        # Prepara contenuto per KB
        kb_content = {
            'template_code': self.code,
            'version': self.version,
            'language': self.language,
            'source': typst_source_code,
            'updated_at': datetime.now().isoformat(),
        }
        
        if self.kb_id:
            # Aggiorna esistente
            self.kb_id.write({
                'content': json.dumps(kb_content),
                'version': self.version,
            })
            _logger.info(f"Template {self.code} aggiornato in KB")
        else:
            # Crea nuovo
            kb_module = self.env['erpv6.kb.module'].create({
                'module_id': f"typst-template-{self.code}",
                'category': 'typst_templates',
                'content': json.dumps(kb_content),
                'encrypted': True,
                'version': self.version,
                'description': f"Template Tipst: {self.name}",
            })
            self.kb_id = kb_module.id
            _logger.info(f"Template {self.code} creato in KB con ID {kb_module.id}")
        
        return True

    def get_typst_source(self):
        """Ottiene il sorgente .typ decifrato (usato dalle API di rendering)"""
        self.ensure_one()
        if not self.kb_id:
            raise UserError(_("Template non sincronizzato con KB."))
        
        decrypted = self.kb_id.get_content_for_ai('typst_preview')
        data = json.loads(decrypted)
        return data.get('source', '')


class TypstDocument(models.Model):
    """
    Modello per tracciare i documenti generati con Tipst
    """
    _name = 'erpv6.typst.document'
    _description = 'Documento Generato con Tipst'
    _order = 'created_at DESC'
    _inherit = ['mail.thread', 'mail.activity.mixin']

    name = fields.Char(string='Nome Documento', required=True)
    template_id = fields.Many2one('erpv6.typst.template', string='Template', required=True, ondelete='restrict')
    
    # Contesto di generazione
    partner_id = fields.Many2one('res.partner', string='Cliente/Partner')
    project_id = fields.Many2one('crm.lead', string='Progetto/Opportunità')
    bando_match_id = fields.Many2one('erpv6.bando.match', string='Bando Match')
    
    # Dati usati per il rendering (snapshot JSON)
    render_data = fields.Json(string='Dati Rendering (Snapshot)')
    
    # Output
    pdf_file = fields.Binary(string='PDF Generato', attachment=True)
    pdf_filename = fields.Char(string='Nome File PDF')
    
    # Stato
    status = fields.Selection([
        ('draft', 'Bozza'),
        ('rendering', 'In Generazione'),
        ('ready', 'Pronto'),
        ('failed', 'Fallito'),
        ('sent', 'Inviato'),
    ], string='Stato', default='draft', tracking=True)
    
    error_message = fields.Text(string='Errore')
    
    # Metadata
    language = fields.Char(string='Lingua', compute='_compute_from_template', store=True)
    page_count = fields.Integer(string='Numero Pagine')
    file_size = fields.Integer(string='Dimensione File (bytes)')
    
    created_at = fields.Datetime(string='Creato il', default=lambda self: fields.Datetime.now(), required=True)
    rendered_at = fields.Datetime(string='Generato il')
    sent_at = fields.Datetime(string='Inviato il')
    
    # Log attività
    log_ids = fields.One2many('erpv6.typst.document.log', 'document_id', string='Log Generazione')

    @api.depends('template_id')
    def _compute_from_template(self):
        for doc in self:
            doc.language = doc.template_id.language if doc.template_id else 'it'

    def action_render(self):
        """
        Avvia la generazione del documento PDF
        Chiama l'API Next.js che a sua volta chiama il servizio Tipst
        """
        for doc in self:
            if not doc.render_data:
                raise UserError(_("Impossibile generare: mancano i dati di rendering."))
            
            doc.status = 'rendering'
            doc.message_post(body="Generazione documento avviata...")
            
            # In produzione: chiamata asincrona all'API
            # Qui simuliamo il flusso
            try:
                # Recupera template source
                template_source = doc.template_id.get_typst_source()
                
                # Chiama API Next.js (in produzione)
                # response = requests.post(f"{NEXTJS_URL}/api/docs/render", json={
                #     'template_code': doc.template_id.code,
                #     'data': doc.render_data,
                #     'template_source': template_source,
                # })
                
                # Simulazione successo
                doc.status = 'ready'
                doc.rendered_at = fields.Datetime.now()
                doc.message_post(body="Documento generato con successo!")
                
            except Exception as e:
                doc.status = 'failed'
                doc.error_message = str(e)
                doc.message_post(body=f"Generazione fallita: {str(e)}")
                _logger.error(f"Errore rendering documento {doc.name}: {e}")
        
        return True

    def action_send_to_partner(self):
        """Invia il documento al partner via email"""
        for doc in self:
            if doc.status != 'ready':
                raise UserError(_("Il documento deve essere pronto per essere inviato."))
            
            # Crea email con allegato
            mail_values = {
                'subject': f"{doc.name} - {doc.partner_id.name}",
                'body_html': f"""
                    <p>Gentile {doc.partner_id.name},</p>
                    <p>In allegato trova il documento: <strong>{doc.name}</strong>.</p>
                    <p>Restiamo a disposizione per eventuali chiarimenti.</p>
                """,
                'email_to': doc.partner_id.email,
                'attachment_ids': [(0, 0, {
                    'name': doc.pdf_filename or 'documento.pdf',
                    'datas': doc.pdf_file,
                    'res_model': 'erpv6.typst.document',
                    'res_id': doc.id,
                })],
            }
            
            self.env['mail.mail'].create(mail_values).send()
            doc.status = 'sent'
            doc.sent_at = fields.Datetime.now()
            doc.message_post(body="Documento inviato al cliente.")
        
        return True

    def action_download(self):
        """Scarica il PDF generato"""
        self.ensure_one()
        if not self.pdf_file:
            raise UserError(_("Nessun PDF disponibile per questo documento."))
        
        return {
            'type': 'ir.actions.act_url',
            'url': f"/web/content/erpv6.typst.document/{self.id}/pdf_file/{self.pdf_filename or 'documento.pdf'}?download=true",
            'target': 'new',
        }


class TypstDocumentLog(models.Model):
    """Log dettagliato delle operazioni di rendering"""
    _name = 'erpv6.typst.document.log'
    _description = 'Log Generazione Documento'
    _order = 'created_at DESC'

    document_id = fields.Many2one('erpv6.typst.document', string='Documento', required=True, ondelete='cascade')
    operation = fields.Char(string='Operazione', required=True)
    details = fields.Json(string='Dettagli')
    duration_ms = fields.Float(string='Durata (ms)')
    success = fields.Boolean(string='Esito Positivo')
    error = fields.Text(string='Errore')
    created_at = fields.Datetime(string='Data/Ora', default=lambda self: fields.Datetime.now())
