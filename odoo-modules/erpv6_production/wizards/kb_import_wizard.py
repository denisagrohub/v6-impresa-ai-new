from odoo import fields, models, _
from odoo.exceptions import UserError

from odoo.addons.erpv6_kb.models.kb_knowledge import KB_TYPE_SELECTION


class Erpv6KbImportWizardLine(models.TransientModel):
    _name = 'erpv6.kb.import.wizard.line'
    _description = 'Voce KB proposta da estrazione AI'

    wizard_id = fields.Many2one('erpv6.kb.import.wizard', required=True, ondelete='cascade')
    selected = fields.Boolean(default=True)
    name = fields.Char(required=True)
    kb_type = fields.Selection(KB_TYPE_SELECTION, required=True)
    category_name = fields.Char(required=True, string='Categoria')
    content = fields.Text(required=True)


class Erpv6KbImportWizard(models.TransientModel):
    _name = 'erpv6.kb.import.wizard'
    _description = 'Importa Knowledge Base da documento (estrazione AI)'

    source_file = fields.Binary(string='Documento', required=True)
    source_filename = fields.Char(string='Nome File')
    extraction_notes = fields.Text(
        string='Note per l\'estrazione',
        help="Contesto opzionale da dare all'AI, es. 'queste righe sono tutte regole fiscali per artigiani'.")
    state = fields.Selection([
        ('draft', 'Bozza'),
        ('review', 'Da rivedere'),
    ], default='draft')
    raw_preview = fields.Text(string='Anteprima Testo Estratto', readonly=True)
    line_ids = fields.One2many('erpv6.kb.import.wizard.line', 'wizard_id', string='Voci Proposte')

    def action_extract(self):
        self.ensure_one()
        service = self.env['erpv6.kb.extraction.service']

        raw_text = service.extract_raw_text(self.source_file, self.source_filename)
        self.raw_preview = raw_text[:2000] + ('...' if len(raw_text) > 2000 else '')

        entries = service.extract_kb_entries(self.source_file, self.source_filename, notes=self.extraction_notes)
        if not entries:
            raise UserError(_("L'AI non ha estratto nessuna voce utilizzabile dal documento."))

        self.line_ids.unlink()
        line_vals = [(0, 0, {
            'name': e['name'],
            'kb_type': e['kb_type'],
            'category_name': e['category'],
            'content': e['content'],
        }) for e in entries]
        self.write({'line_ids': line_vals, 'state': 'review'})

        return {
            'type': 'ir.actions.act_window',
            'res_model': self._name,
            'res_id': self.id,
            'view_mode': 'form',
            'target': 'new',
        }

    def action_create_kb(self):
        self.ensure_one()
        selected_lines = self.line_ids.filtered('selected')
        if not selected_lines:
            raise UserError(_("Nessuna voce selezionata da creare."))

        entries = [{
            'name': line.name,
            'kb_type': line.kb_type,
            'category': line.category_name,
            'content': line.content,
        } for line in selected_lines]

        service = self.env['erpv6.kb.extraction.service']
        created = service.create_kb_records(entries, source_label=self.source_filename or 'kb_import_wizard')
        self.env['erpv6.kb.validation.gate'].create_validation_sessions(created)

        return {
            'type': 'ir.actions.act_window',
            'name': _('Voci KB Create (in validazione)'),
            'res_model': 'erpv6.kb',
            'view_mode': 'list,form',
            'domain': [('id', 'in', created.ids)],
        }
