from odoo import fields, models


class Erpv6ProductionPhase(models.Model):
    _name = 'erpv6.production.phase'
    _description = 'Fase di produzione (catalogo configurabile)'
    _order = 'sequence, id'

    name = fields.Char(required=True)
    sequence = fields.Integer(default=10)
    phase_kind = fields.Selection([
        ('diagnostica', 'Diagnostica'),
        ('lavoro', 'Fase di lavoro'),
        ('documento', 'Produzione documento'),
    ], required=True, default='diagnostica')
    requires_output = fields.Boolean(
        string='Richiede Output',
        help='Se True, questa fase deve produrre un documento/report salvato in erpv6_library prima di poter avanzare'
    )
    output_category = fields.Selection([
        ('nda', 'NDA'),
        ('proposal', 'Proposta'),
        ('sal', 'SAL'),
        ('contract', 'Contratto'),
        ('business_plan', 'Business Plan'),
        ('final', 'Documento Finale'),
        ('client_upload', 'Caricato dal Cliente'),
        ('other', 'Altro'),
    ], string='Categoria Output', help='Categoria erpv6.library.document sotto cui salvare l\'output di questa fase')
    active = fields.Boolean(default=True)

    typst_template_id = fields.Many2one(
        'erpv6.typst.template', string='Template Typst',
        help='Se vuoto, questa fase non genera automaticamente un documento: '
             'l\'avanzamento resta bloccato finche\' un documento non viene caricato manualmente.'
    )
    requires_validation = fields.Boolean(
        string='Richiede Validazione (6 Giudici)',
        help='Se True, l\'output di questa fase deve passare da erpv6_validation e ricevere '
             'action_human_approve() prima che la produzione possa avanzare oltre.'
    )
    validation_mode = fields.Selection([
        ('sesto_only', 'Solo Sesto Uomo'),
        ('full_six_judges', '5 Analisti + Sesto Uomo'),
    ], string='Modalità Validazione', default='full_six_judges')
