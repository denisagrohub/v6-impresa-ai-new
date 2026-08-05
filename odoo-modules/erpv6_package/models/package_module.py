from odoo import api, fields, models

class Erpv6PackageModule(models.Model):
    _name = 'erpv6.package.module'
    _description = 'Modulo di servizio'

    name = fields.Char(required=True)
    code = fields.Char(required=True)
    price = fields.Monetary(required=True)
    currency_id = fields.Many2one('res.currency', default=lambda self: self.env.company.currency_id)
    description = fields.Text()
    is_active = fields.Boolean(default=True)
    
    # TASK 1 - Estensione per integrazione con erpv6_typst e erpv6_kb
    required_fields = fields.Json(
        string='Schema Campi Richiesti',
        help='JSON Schema dei dati necessari per generare questa sezione'
    )
    interview_questions = fields.Text(
        string='Domande Intervista',
        help='Domande in linguaggio naturale, una per riga, derivate da required_fields'
    )
    generation_prompt_kb_id = fields.Many2one(
        'erpv6.kb',
        string='Prompt di Generazione',
        domain="[('kb_type','=','prompt')]",
        help='Prompt KB da usare per generare il contenuto di questa sezione'
    )
    typst_template_id = fields.Many2one(
        'erpv6.typst.template',
        string='Template Typst Collegato'
    )
