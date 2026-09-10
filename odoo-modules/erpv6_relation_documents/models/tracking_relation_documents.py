import base64
import hashlib
import logging

from odoo import _, fields, models
from odoo.exceptions import UserError

_logger = logging.getLogger(__name__)


class Erpv6TrackingRelationDocuments(models.Model):
    """Generazione manuale di documenti contrattuali (NDA/Contratto/NCND)
    + richiesta firma per un nodo (parte) di erpv6.tracking.relation
    (Denis, 10/09/2026: "sui progetti partner manca anche la
    generazione documenti... altra cosa che manca è la richiesta di
    firma documenti").

    Stessa infrastruttura reale già usata per erpv6.production.order
    (action_generate_contract_document/_generate_contract_document_pdf in
    production_order.py) - motore Typst, stesso erpv6.contract.document,
    stesso erpv6.sign.request/Documenso. Duplicata qui (non condivisa via
    un mixin) perché i due modelli non hanno un antenato comune e i dati
    sorgente sono strutturalmente diversi (intervista/prodotto vs
    partner/parte) - un mixin condiviso avrebbe richiesto una nuova
    dipendenza sui moduli esistenti, evitata di proposito oggi (vedi
    commento nel manifest)."""
    _inherit = 'erpv6.tracking.relation'

    _MANUAL_DOC_TEMPLATE_XMLID = {
        'nda': 'erpv6_production.typst_template_nda',
        'service': 'erpv6_production.typst_template_contratto_consulenza',
    }
    _MANUAL_DOC_TEMPLATE_CATEGORY = {'nda': 'nda', 'service': 'contract', 'ncnd': 'ncnd'}

    def _ensure_relation_contract(self):
        self.ensure_one()
        if not self.partner_id:
            raise UserError(_(
                "'%s' non ha una parte collegata (partner): il contratto va generato sul nodo "
                "della parte specifica, non sul nodo progetto.") % self.name)
        existing = self.contract_ids[:1]
        if existing:
            return existing
        return self.env['erpv6.contract'].sudo().create({
            'name': _("Contratto - %s") % self.name,
            'partner_id': self.partner_id.id,
            'relation_id': self.id,
        })

    def _build_relation_contract_doc_data(self, doc_type):
        self.ensure_one()
        data = {
            'doc_type': doc_type,
            'generated_at': fields.Date.context_today(self).strftime('%d/%m/%Y'),
            'azienda_fornitore': self.env.company.name,
            'progetto_nome': self.parent_id.name if self.parent_id else self.name,
        }
        if self.partner_id:
            data['cliente_nome'] = self.partner_id.name
            if self.partner_id.vat:
                data['cliente_piva'] = self.partner_id.vat
            if self.partner_id.street or self.partner_id.city:
                data['cliente_indirizzo'] = ", ".join(filter(None, [self.partner_id.street, self.partner_id.city]))
        return data

    def _generate_relation_contract_pdf(self, contract_doc, template):
        self.ensure_one()
        template = self.env.ref(template, raise_if_not_found=False) if isinstance(template, str) else template
        if not template:
            _logger.warning("Template Typst '%s' non trovato: PDF non generato per erpv6.contract.document #%s.",
                             template, contract_doc.id)
            return False
        data = self._build_relation_contract_doc_data(contract_doc.doc_type)
        typst_doc = self.env['erpv6.typst.engine'].generate_document(
            template.id, 'erpv6.contract.document', contract_doc.id, data=data)
        if typst_doc.status != 'ready':
            _logger.warning("Generazione PDF fallita per erpv6.contract.document #%s: %s",
                             contract_doc.id, typst_doc.error_message or 'nessun dettaglio')
            return False
        pdf_bytes = base64.b64decode(typst_doc.pdf_file)
        contract_doc.sudo().write({
            'content': typst_doc.pdf_file,
            'file_name': typst_doc.pdf_filename,
            'hash': hashlib.sha256(pdf_bytes).hexdigest(),
        })
        return typst_doc

    def action_generate_contract_document(self, doc_type):
        self.ensure_one()
        contract = self._ensure_relation_contract()
        existing = contract.document_ids.filtered(lambda d: d.doc_type == doc_type)
        if existing:
            doc = existing[0]
            return {'document_id': doc.id, 'has_pdf': bool(doc.content), 'template_missing': False}

        doc_labels = dict(self.env['erpv6.contract.document']._fields['doc_type'].selection)
        doc = self.env['erpv6.contract.document'].sudo().create({
            'name': _("%(tipo)s - %(nome)s") % {'tipo': doc_labels.get(doc_type, doc_type), 'nome': self.name},
            'contract_id': contract.id,
            'doc_type': doc_type,
        })

        template_xmlid = self._MANUAL_DOC_TEMPLATE_XMLID.get(doc_type)
        template = self.env.ref(template_xmlid, raise_if_not_found=False) if template_xmlid else False
        if not template:
            category = self._MANUAL_DOC_TEMPLATE_CATEGORY.get(doc_type)
            template = self.env['erpv6.typst.template'].search([('category', '=', category)], limit=1) if category else False
        if not template:
            return {'document_id': doc.id, 'has_pdf': False, 'template_missing': True}

        typst_doc = self._generate_relation_contract_pdf(doc, template)
        return {'document_id': doc.id, 'has_pdf': bool(typst_doc), 'template_missing': False}

    def action_upload_contract_template(self, doc_type, typst_source, name=None):
        self.ensure_one()
        if not (typst_source or '').strip():
            raise UserError(_("Il sorgente Typst del template non può essere vuoto."))
        category = self._MANUAL_DOC_TEMPLATE_CATEGORY.get(doc_type, 'custom')
        doc_labels = dict(self.env['erpv6.contract.document']._fields['doc_type'].selection)
        self.env['erpv6.typst.template'].sudo().create({
            'name': name or _("%s (caricato manualmente)") % doc_labels.get(doc_type, doc_type),
            'code': f"{doc_type.upper()}-REL-{self.id}-{self.create_date.strftime('%Y%m%d%H%M%S') if self.create_date else 'x'}",
            'category': category,
            'language': 'it',
            'version': '1.0',
            'typst_source': typst_source,
        })
        return self.action_generate_contract_document(doc_type)

    def action_send_document_to_sign(self, contract_document_id):
        """Richiesta di firma reale su Documenso per UN documento
        contrattuale già generato (Denis, 10/09/2026: "manca la richiesta
        di firma documenti") - stesso motore erpv6_sign già usato per i
        gate automatici NDA/contratto di erpv6.production.order, qui
        innescato manualmente su richiesta esplicita dell'admin (mai
        automatico per i Progetti Partner: non esiste un gate di fase
        equivalente qui)."""
        self.ensure_one()
        contract_doc = self.env['erpv6.contract.document'].sudo().browse(contract_document_id)
        if not contract_doc.exists() or contract_doc.contract_id.relation_id.id != self.id:
            raise UserError(_("Documento non trovato su questa parte."))
        if not self.partner_id or not self.partner_id.email:
            raise UserError(_("'%s' non ha un'email valida per la firma.") % self.name)
        typst_docs = self.env['erpv6.typst.document'].sudo().search([
            ('res_model', '=', 'erpv6.contract.document'), ('res_id', '=', contract_doc.id),
        ], order='id desc', limit=1)
        if not typst_docs:
            raise UserError(_("Nessun PDF generato per questo documento: generalo prima di inviarlo a firma."))
        sign_request = self.env['erpv6.sign.request'].sudo().create({
            'name': contract_doc.name,
            'contract_id': contract_doc.contract_id.id,
            'document_id': typst_docs.id,
            'partner_id': self.partner_id.id,
        })
        sign_request.action_send_to_sign()
        return {'sign_request_id': sign_request.id}
