from odoo import models, fields, api
import hashlib
import logging

_logger = logging.getLogger(__name__)


class LibraryDocument(models.Model):
    _name = 'erpv6.library.document'
    _description = 'Documento di Libreria per Progetti'
    _inherit = ['erpv6.tracking.mixin']
    _order = 'create_date desc'

    # Progetto correlato (CRM Lead)
    project_id = fields.Many2one(
        'crm.lead',
        string='Progetto',
        required=True,
        ondelete='cascade'
    )

    # Nome documento
    name = fields.Char(
        string='Nome Documento',
        required=True
    )

    # Categoria documento
    category = fields.Selection([
        ('nda', 'NDA'),
        ('proposal', 'Proposta'),
        ('sal', 'SAL'),
        ('contract', 'Contratto'),
        ('business_plan', 'Business Plan'),
        ('final', 'Documento Finale'),
        ('client_upload', 'Caricato dal Cliente'),
        ('other', 'Altro'),
        ('brand_logo', 'Logo Brand'),
        ('brand_asset', 'Altro Asset Brand'),
        ('kb_source', 'Sorgente KB da elaborare'),
        ('kb_case_study', 'Caso studio (lavoro già eseguito)'),
        ('agent_knowledge', 'Conoscenza Agente'),
    ], string='Categoria', required=True)

    # Denis, 30/08/2026, prompt #19 (sblocca §O per davvero): campo NATIVO
    # qui, non piu' un'estensione _inherit da erpv6_core_engine (vedi
    # library_document_ext.py, rimosso -- erpv6.core.library_category ora
    # vive in erpv6_core_dispatch, neutro). category (sopra) resta identica,
    # mai toccata -- questo e' un catalogo vero parallelo, che i circuiti
    # fanno crescere dichiarando nuove etichette (erpv6.core.output.create(),
    # Motore 'etichettatrice' label_output), senza rompere nessun confronto
    # esistente sul campo legacy.
    category_id = fields.Many2one(
        'erpv6.core.library_category', string='Categoria (catalogo EAOSv6)',
        help="Popolato dal Motore 'etichettatrice' (label_output) quando un circuito "
             "dichiara un'etichetta per il suo Output -- parallelo al campo category "
             "legacy, mai un suo sostituto.")

    # Progetto brand collegato (opzionale, per documenti di categoria brand_logo/brand_asset)
    brand_project_id = fields.Many2one(
        'erpv6.brand.project',
        string='Progetto Brand Collegato',
        help='Riferimento al progetto brand (solo per documenti di categoria Logo Brand o Altro Asset Brand)'
    )

    # Origine del documento
    origin = fields.Selection([
        ('generated', 'Generato dal sistema'),
        ('client_upload', 'Caricato dal cliente'),
        ('internal_upload', 'Caricato internamente'),
    ], string='Origine', required=True, default='generated')

    # Riferimento al modello sorgente (se generato)
    source_model = fields.Char(
        string='Modello Sorgente',
        help='Nome tecnico del modello sorgente (es: erpv6.typst.document)'
    )

    # ID del record sorgente
    source_res_id = fields.Integer(
        string='ID Record Sorgente',
        help='ID del record nel modello sorgente'
    )

    # Campi candidati per il recupero del file dal documento sorgente
    FILE_FIELD_CANDIDATES = ('pdf_file', 'file', 'signed_document', 'content')

    # File binary (usato solo se origin != 'generated')
    file = fields.Binary(
        string='File',
        attachment=True,
        help='File allegato (usato solo per documenti caricati manualmente)'
    )

    # Nome del file
    file_name = fields.Char(
        string='Nome File'
    )

    # Flag per documenti finali client-facing
    is_final_client_facing = fields.Boolean(
        string='Documento Finale per Cliente',
        help='Se True, triggera la certificazione blockchain'
    )

    # Record blockchain collegato
    blockchain_record_id = fields.Many2one(
        'erpv6.blockchain.record',
        string='Record Blockchain',
        readonly=True,
        help='Record blockchain associato al documento certificato'
    )

    # Stato reale della certificazione: la sola presenza di blockchain_record_id
    # non implica una certificazione confermata (può essere 'pending',
    # 'non_disponibile', 'failed'). Esposto per evitare di mostrare in UI/API
    # un documento come "certificato" quando non lo è.
    blockchain_status = fields.Selection(
        related='blockchain_record_id.status',
        string='Stato Certificazione Blockchain',
        readonly=True,
    )

    def _get_source_file_content(self, source_doc):
        """Recupera il contenuto del file da un documento sorgente
        
        Itera su FILE_FIELD_CANDIDATES e ritorna il primo campo valorizzato trovato.
        
        :param source_doc: record del documento sorgente
        :return: contenuto binario del file o None se nessun campo trovato
        """
        for field_name in self.FILE_FIELD_CANDIDATES:
            if hasattr(source_doc, field_name) and getattr(source_doc, field_name):
                return getattr(source_doc, field_name)
        return None

    def action_certify_blockchain(self):
        """Certifica il documento su blockchain
        
        Se is_final_client_facing e non ha già blockchain_record_id,
        crea un erpv6.blockchain.record collegato e chiama .action_certify()
        """
        self.ensure_one()
        
        if not self.is_final_client_facing:
            return False
            
        if self.blockchain_record_id:
            # Già certificato
            return False
        
        # Calcola hash del documento
        if self.origin == 'generated' and self.source_model and self.source_res_id:
            # Documento generato: usa hash del record sorgente
            source_doc = self.env[self.source_model].browse(self.source_res_id)
            file_content = self._get_source_file_content(source_doc)
            if file_content:
                doc_hash = hashlib.sha256(file_content).hexdigest()
            else:
                doc_hash = hashlib.sha256(f'{self.source_model}:{self.source_res_id}'.encode()).hexdigest()
        elif self.file:
            # Documento caricato: usa hash del file
            doc_hash = hashlib.sha256(self.file).hexdigest()
        else:
            # Fallback: usa nome e ID
            doc_hash = hashlib.sha256(f'{self.name}:{self.id}'.encode()).hexdigest()
        
        # Crea record blockchain
        blockchain_config = self.env['erpv6.blockchain.config'].search(
            [('active', '=', True)], limit=1
        )
        
        if not blockchain_config:
            _logger.warning('Nessuna configurazione blockchain attiva trovata')
            return False
        
        blockchain_record = self.env['erpv6.blockchain.record'].create({
            'config_id': blockchain_config.id,
            'document_model': 'erpv6.library.document',
            'document_id': self.id,
            'document_name': self.name,
            'document_hash': doc_hash,
            'lot_number': self.batch_lot_id.code if self.batch_lot_id else None,
        })
        
        # Aggiorna il documento con il riferimento blockchain
        self.write({'blockchain_record_id': blockchain_record.id})
        
        # Certifica sulla blockchain
        blockchain_record.action_certify()
        
        return True

    @api.model
    def register_document(self, project_id, name, category, origin, 
                          source_model=None, source_res_id=None, 
                          file_data=None, file_name=None, is_final=False):
        """Helper method per creare documenti
        
        :param project_id: ID del progetto (crm.lead)
        :param name: Nome del documento
        :param category: Categoria (selection value)
        :param origin: Origine (selection value)
        :param source_model: Nome tecnico modello sorgente (opzionale)
        :param source_res_id: ID record sorgente (opzionale)
        :param file_data: Dati binari del file (opzionale, per upload)
        :param file_name: Nome del file (opzionale)
        :param is_final: Se True e origin='generated', triggera certificazione
        :return: record del documento creato
        """
        vals = {
            'project_id': project_id,
            'name': name,
            'category': category,
            'origin': origin,
            'is_final_client_facing': is_final,
        }
        
        if source_model:
            vals['source_model'] = source_model
        if source_res_id:
            vals['source_res_id'] = source_res_id
        if file_data:
            vals['file'] = file_data
        if file_name:
            vals['file_name'] = file_name
        
        document = self.create(vals)
        
        # Triggera certificazione se è finale
        if is_final:
            document.action_certify_blockchain()
        
        return document
