from odoo import api, fields, models, _
from odoo.exceptions import UserError
import logging

_logger = logging.getLogger(__name__)


class TypstTemplate(models.Model):
    _name = 'erpv6.typst.template'
    _description = 'Template Typst'
    _order = 'sequence, name'

    name = fields.Char(string='Nome Template', required=True, tracking=True)
    template_type = fields.Selection([
        ('business_plan', 'Business Plan'),
        ('nda', 'NDA - Accordo Riservatezza'),
        ('contract', 'Contratto di Servizio'),
        ('sal', 'Stato Avanzamento Lavori'),
        ('invoice', 'Fattura'),
        ('pitch_deck', 'Pitch Deck'),
        ('custom', 'Personalizzato'),
    ], string='Tipo Template', required=True, tracking=True)
    
    # Contenuto template Typst
    template_content = fields.Text(
        string='Contenuto Template Typst',
        required=True,
        help='Codice Typst del template. Usa {{ variabile }} per i placeholder.'
    )
    
    # Variabili disponibili
    variables = fields.Text(
        string='Variabili Disponibili',
        help='Lista JSON delle variabili disponibili per questo template'
    )
    
    # Brand associato
    brand_id = fields.Many2one('erpv6.consulting.brand', string='Brand')
    
    # Metadata
    sequence = fields.Integer(string='Sequenza', default=10)
    active = fields.Boolean(string='Attivo', default=True)
    description = fields.Text(string='Descrizione')
    
    # Statistiche
    usage_count = fields.Integer(string='Utilizzi', default=0)
    
    _sql_constraints = [
        ('name_brand_unique', 'unique(name, brand_id)', 'Il nome template deve essere univoco per brand!'),
    ]
    
    def action_test_template(self):
        """Testa il template con dati di esempio"""
        self.ensure_one()
        
        test_data = {
            'company': {
                'name': 'Azienda Test S.r.l.',
                'vat': 'IT12345678901',
                'address': 'Via Test 123, Milano',
            },
            'partner': {
                'name': 'Cliente Test',
                'email': 'cliente@test.it',
            },
            'document': {
                'number': 'TEST-001',
                'date': fields.Date.today().strftime('%d/%m/%Y'),
            }
        }
        
        rendered = self._render_template(test_data)
        
        return {
            'type': 'ir.actions.client',
            'tag': 'display_notification',
            'params': {
                'title': _('Template Test'),
                'message': rendered[:200] + '...',
                'type': 'info',
                'sticky': True,
            }
        }
    
    def _render_template(self, data):
        """Renderizza il template con i dati forniti"""
        self.ensure_one()
        
        rendered = self.template_content
        
        # Sostituisce {{ company.name }} con data['company']['name']
        for key, value in data.items():
            if isinstance(value, dict):
                for subkey, subvalue in value.items():
                    placeholder = '{{ ' + key + '.' + subkey + ' }}'
                    rendered = rendered.replace(placeholder, str(subvalue))
            else:
                placeholder = '{{ ' + key + ' }}'
                rendered = rendered.replace(placeholder, str(value))
        
        return rendered
    
    def action_use(self):
        """Registra l'utilizzo del template"""
        self.write({'usage_count': self.usage_count + 1})
