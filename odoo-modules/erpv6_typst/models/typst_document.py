# -*- coding: utf-8 -*-

import base64
import logging

from odoo import api, fields, models, _
from odoo.exceptions import UserError

_logger = logging.getLogger(__name__)


class TypstDocument(models.Model):
    """Documento generato con Typst.

    Un solo modello per i due flussi reali che lo usano:
    - erpv6_production (via erpv6.typst.engine.generate_document) — riferimento
      generico al record sorgente tramite res_model/res_id.
    - /api/v6/typst/render (erpv6_typst/controllers/typst_api.py) — contesto
      commerciale via partner_id/project_id/bando_match_id.
    Prima di questa riconciliazione esistevano due classi Python omonime con
    _name identico e senza _inherit: quella caricata per ultima in
    models/__init__.py vinceva nel registro Odoo, rompendo l'altra.
    """
    _name = 'erpv6.typst.document'
    _description = 'Documento Generato con Typst'
    _order = 'create_date desc'
    _inherit = ['mail.thread', 'mail.activity.mixin']

    name = fields.Char(string='Nome Documento', required=True)
    template_id = fields.Many2one('erpv6.typst.template', string='Template', required=True, ondelete='restrict')

    # Riferimento generico al record sorgente (flusso erpv6_production)
    res_model = fields.Char(string='Modello Sorgente')
    res_id = fields.Integer(string='ID Record Sorgente')

    # Contesto commerciale (flusso API business plan / bandi)
    partner_id = fields.Many2one('res.partner', string='Cliente/Partner')
    project_id = fields.Many2one('crm.lead', string='Progetto/Opportunità')
    bando_match_id = fields.Many2one('erpv6.bando.match', string='Bando Match')

    # Dati usati per il rendering
    render_data = fields.Json(string='Dati Rendering')

    # Output
    pdf_file = fields.Binary(string='PDF Generato', attachment=True)
    pdf_filename = fields.Char(string='Nome File PDF')
    file_size = fields.Integer(string='Dimensione File (bytes)')
    page_count = fields.Integer(string='Numero Pagine')

    status = fields.Selection([
        ('draft', 'Bozza'),
        ('rendering', 'In Generazione'),
        ('ready', 'Pronto'),
        ('failed', 'Fallito'),
        ('sent', 'Inviato'),
    ], string='Stato', default='draft', tracking=True)
    error_message = fields.Text(string='Errore')

    language = fields.Char(string='Lingua', compute='_compute_from_template', store=True)

    created_at = fields.Datetime(string='Creato il', default=lambda self: fields.Datetime.now(), required=True)
    rendered_at = fields.Datetime(string='Generato il')
    sent_at = fields.Datetime(string='Inviato il')

    # Blockchain (certificazione/firma)
    blockchain_hash = fields.Char(string='Hash Blockchain')
    blockchain_verified = fields.Boolean(string='Verificato su Blockchain')

    notes = fields.Text(string='Note')

    log_ids = fields.One2many('erpv6.typst.document.log', 'document_id', string='Log Generazione')

    @api.depends('template_id')
    def _compute_from_template(self):
        for doc in self:
            doc.language = doc.template_id.language if doc.template_id else 'it'

    def action_render(self):
        """Genera il PDF compilando davvero il sorgente Typst (subprocess),
        non una simulazione. Chiamato sia dal flusso erpv6_production
        (via erpv6.typst.engine) sia dall'API /api/v6/typst/render."""
        for doc in self:
            if not doc.template_id:
                raise UserError(_('Template non specificato'))

            doc.status = 'rendering'
            doc.message_post(body="Generazione documento avviata...")

            try:
                typst_source = doc.template_id.get_typst_source()
                pdf_content = doc._generate_pdf_with_typst(typst_source, doc.render_data or {})

                doc.write({
                    'pdf_file': base64.b64encode(pdf_content),
                    'pdf_filename': f'{doc.name}.pdf',
                    'file_size': len(pdf_content),
                    'status': 'ready',
                    'rendered_at': fields.Datetime.now(),
                    'error_message': False,
                })
                doc.template_id.action_use()
                doc.message_post(body="Documento generato con successo!")

            except Exception as e:
                doc.status = 'failed'
                doc.error_message = str(e)
                doc.message_post(body=f"Generazione fallita: {str(e)}")
                _logger.error(f"Errore rendering documento {doc.name}: {e}")

        return True

    def _generate_pdf_with_typst(self, typst_source, data):
        """Compila il sorgente Typst in PDF con il binario typst.

        Convenzione dati: il sorgente .typ del template legge i dati con la
        funzione nativa `#let data = json("data.json")`. Il file data.json
        viene scritto qui accanto al sorgente, nella stessa directory
        temporanea, cosi' il percorso relativo si risolve sempre in
        compilazione. Nessuna sostituzione testuale fatta in Python:
        strutture annidate (liste, oggetti - es. voci SWOT, opportunita' di
        finanziamento, cronoprogrammi) restano responsabilita' del linguaggio
        Typst stesso nel .typ (#for, #if), che le gestisce nativamente senza
        bisogno di un motore di template parallelo scritto qui.
        """
        import tempfile
        import subprocess
        import os
        import json
        import shutil

        tmp_dir = tempfile.mkdtemp(prefix='erpv6_typst_')
        typst_file = os.path.join(tmp_dir, 'document.typ')
        data_file = os.path.join(tmp_dir, 'data.json')
        pdf_file = os.path.join(tmp_dir, 'document.pdf')

        try:
            with open(typst_file, 'w') as f:
                f.write(typst_source)
            with open(data_file, 'w') as f:
                json.dump(data, f)

            result = subprocess.run(
                ['typst', 'compile', typst_file, pdf_file],
                capture_output=True,
                text=True,
                timeout=30
            )

            if result.returncode != 0:
                raise Exception(f'Typst error: {result.stderr}')

            with open(pdf_file, 'rb') as f:
                return f.read()

        finally:
            shutil.rmtree(tmp_dir, ignore_errors=True)

    def action_send_to_partner(self):
        """Invia il documento al partner via email"""
        for doc in self:
            if doc.status != 'ready':
                raise UserError(_("Il documento deve essere pronto per essere inviato."))

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

    def action_notify_user(self, user):
        """Invia il documento a un utente interno (res.users, non un
        res.partner cliente) sia come notifica in-app (messaggio nell'inbox
        Discuss del destinatario, con il PDF allegato) sia come email diretta
        con lo stesso allegato -- per resoconti tecnici interni (es. resoconto
        estrazione KB, vedi erpv6_production/models/library_document.py) dove
        il destinatario e' un membro del team, non un cliente. Per il flusso
        client-facing vedi action_send_to_partner."""
        self.ensure_one()
        if self.status != 'ready':
            raise UserError(_("Il documento deve essere pronto per essere inviato."))
        if not user or not user.partner_id:
            return False

        attachments = None
        mail_attachment_ids = []
        if self.pdf_file:
            attachments = [(self.pdf_filename or 'documento.pdf', base64.b64decode(self.pdf_file))]
            mail_attachment_ids = [(0, 0, {
                'name': self.pdf_filename or 'documento.pdf',
                'datas': self.pdf_file,
                'res_model': 'erpv6.typst.document',
                'res_id': self.id,
            })]

        self.message_post(
            body=_("Documento generato: %s") % self.name,
            subject=self.name,
            partner_ids=user.partner_id.ids,
            attachments=attachments,
        )

        if user.email:
            mail_values = {
                'subject': self.name,
                'body_html': _("<p>Documento generato: <strong>%s</strong>.</p><p>In allegato il PDF.</p>") % self.name,
                'email_to': user.email,
                'attachment_ids': mail_attachment_ids,
            }
            # Senza email_from esplicito, mail.mail risolve il mittente da
            # self.env.user al momento della creazione -- incoerente a
            # seconda di chi/cosa esegue questa azione (click reale, cron,
            # odoo shell): visto dal vivo un invio finire come "OdooBot
            # <odoobot@example.com>" invece del mittente aziendale atteso.
            # mail.default.from (impostato una volta in Impostazioni Tecniche,
            # non hardcoded qui) da' un mittente stabile con nome leggibile.
            default_from = self.env['ir.config_parameter'].sudo().get_param('mail.default.from')
            if default_from:
                mail_values['email_from'] = f'"{self.env.company.name}" <{default_from}>'
            self.env['mail.mail'].create(mail_values).send()

        self.status = 'sent'
        self.sent_at = fields.Datetime.now()
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
    _order = 'created_at desc'

    document_id = fields.Many2one('erpv6.typst.document', string='Documento', required=True, ondelete='cascade')
    operation = fields.Char(string='Operazione', required=True)
    details = fields.Json(string='Dettagli')
    duration_ms = fields.Float(string='Durata (ms)')
    success = fields.Boolean(string='Esito Positivo')
    error = fields.Text(string='Errore')
    created_at = fields.Datetime(string='Data/Ora', default=lambda self: fields.Datetime.now())
