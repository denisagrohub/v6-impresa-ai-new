import logging

from odoo import api, models, _

_logger = logging.getLogger(__name__)


class LibraryDocument(models.Model):
    """Estende erpv6.library.document (definito in erpv6_library, che NON
    puo' dipendere da erpv6_omni_bridge/erpv6_validation senza creare un
    ciclo -- erpv6_production gia' dipende da entrambi, vedi kb_validation_gate.py)
    con il trigger automatico: caricare un documento in categoria 'kb_source'
    avvia l'estrazione AI e mette le voci create in validazione.
    """
    _name = 'erpv6.library.document'
    _inherit = ['erpv6.library.document', 'mail.thread']

    @api.model_create_multi
    def create(self, vals_list):
        documents = super().create(vals_list)
        for document in documents:
            if document.category == 'kb_source' and document.file:
                document._process_kb_source()
        return documents

    def _process_kb_source(self):
        """Estrae le voci KB dal documento (create inattive) e le mette
        subito in validazione (erpv6_validation) -- mai attive senza
        passare da li'. Esito sempre loggato nel chatter del documento."""
        self.ensure_one()
        service = self.env['erpv6.kb.extraction.service']
        gate = self.env['erpv6.kb.validation.gate']
        try:
            entries = service.extract_kb_entries(self.file, self.file_name, notes=self.name)
            if not entries:
                self.message_post(body=_("Elaborazione KB: nessuna voce estratta dal documento."))
                return
            created = service.create_kb_records(
                entries, source_label=f'library_document:{self.id}:{self.file_name or self.name}')
            gate.create_validation_sessions(created)
            names = ", ".join(created.mapped('name'))
            self.message_post(body=_(
                "Elaborazione KB completata: %(count)d voci create (inattive, in validazione) — %(names)s"
            ) % {'count': len(created), 'names': names})
        except Exception as e:
            _logger.exception("Elaborazione KB fallita per documento #%s", self.id)
            self.message_post(body=_("Elaborazione KB fallita: %s") % str(e))
