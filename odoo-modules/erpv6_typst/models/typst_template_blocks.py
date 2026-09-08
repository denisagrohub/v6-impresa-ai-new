# -*- coding: utf-8 -*-
"""Composizione template da blocchi library.

Un template erpv6.typst.template puo' dichiarare blocchi grafici
custoditi in erpv6.library.document. Il sorgente non viene MAI copiato
nel template: get_typst_source() lo assembla al volo (main + blocchi in
sequenza) leggendo i file da library al momento del render. Regola T.2:
il centrale (erpv6_typst) possiede il meccanismo, i blocchi restano
proprieta' della library centrale - un fix grafico su un blocco vale
per tutti i template che lo usano, istantaneamente.
"""
import base64
import logging

from odoo import fields, models, _
from odoo.exceptions import UserError

_logger = logging.getLogger(__name__)


class Erpv6TypstTemplate(models.Model):
    _inherit = 'erpv6.typst.template'

    block_ids = fields.One2many(
        'erpv6.typst.template.block', 'template_id',
        string='Blocchi Compositivi')

    def get_typst_source(self):
        """Override: template con blocchi = main (typst_source) seguito
        dai sorgenti dei blocchi in sequenza, letti da library.
        Template senza blocchi: comportamento invariato."""
        self.ensure_one()
        if not self.block_ids:
            return super().get_typst_source()
        if not self.typst_source:
            raise UserError(_(
                "Template composito senza main: manca il sorgente Typst (%s).") % self.name)
        # Blocchi PRIMA, main DOPO: le #let dei blocchi (palette,
        # funzioni) devono essere visibili al main che le usa.
        parts = [blocco._block_source() for blocco in self.block_ids.sorted('sequence')]
        parts.append(self.typst_source)
        return '\n\n'.join(parts)


class Erpv6TypstTemplateBlock(models.Model):
    _name = 'erpv6.typst.template.block'
    _description = "Blocco compositivo di un template (sorgente in library)"
    _order = 'sequence, id'
    _sql_constraints = [
        ('block_uniq', 'unique(template_id, library_document_id)',
         "Questo blocco e' gia' collegato al template."),
    ]

    template_id = fields.Many2one(
        'erpv6.typst.template', string='Template',
        required=True, ondelete='cascade', index=True)
    library_document_id = fields.Many2one(
        'erpv6.library.document', string='Blocco Library',
        required=True, ondelete='restrict',
        domain=[('file_name', '=like', '%.typ')])
    sequence = fields.Integer(string='Sequenza', default=10)

    def _block_source(self):
        """Sorgente .typ del blocco, letto da library (fonte unica)."""
        self.ensure_one()
        doc = self.library_document_id
        if not doc.file:
            raise UserError(_("Il blocco '%s' non ha file in library.") % doc.name)
        return base64.b64decode(doc.file).decode('utf-8')
