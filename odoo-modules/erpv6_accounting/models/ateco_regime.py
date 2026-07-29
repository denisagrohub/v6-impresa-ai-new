from odoo import models, fields, api
import logging

_logger = logging.getLogger(__name__)


class AtecoRegime(models.Model):
    _name = 'erpv6.ateco.regime'
    _description = 'Mappatura ATECO → Regime Fiscale'
    _order = 'code'

    code = fields.Char('Codice ATECO', required=True, index=True)
    description = fields.Char('Descrizione')
    regime_default = fields.Selection([
        ('ordinario', 'Ordinario'),
        ('semplificato', 'Semplificato'),
        ('forfettario', 'Forfettario'),
        ('agricolo_speciale', 'Agricolo Speciale'),
    ], string='Regime Default', required=True)
    
    # Coefficienti specifici per ATECO
    coefficiente_redditivita = fields.Float(
        'Coefficiente Redditività',
        default=0.40,
        help='Percentuale di utile stimato sul fatturato (es. 0.40 = 40%)'
    )
    aliquota_iva_media = fields.Float(
        'IVA Media %',
        default=22.0,
        help='Aliquota IVA media per questo ATECO'
    )
    settore = fields.Selection([
        ('manifatturiero', 'Manifatturiero'),
        ('commercio', 'Commercio'),
        ('servizi', 'Servizi'),
        ('agricolo', 'Agricolo'),
        ('tech', 'Tech'),
        ('food', 'Food'),
        ('hospitality', 'Hospitality'),
        ('altro', 'Altro'),
    ], string='Settore')
    
    active = fields.Boolean('Attivo', default=True)
    
    _sql_constraints = [
        ('code_unique', 'unique(code)', 'Il codice ATECO deve essere univoco!'),
    ]
    
    @api.model
    def get_regime_for_ateco(self, ateco_code):
        """Ritorna il regime fiscale per un codice ATECO"""
        regime = self.search([('code', '=', ateco_code)], limit=1)
        if regime:
            return regime.regime_default
        # Fallback: cerca per prefisso (es. "56.30" per "56.30.00")
        prefix = ateco_code[:5] if len(ateco_code) >= 5 else ateco_code
        regime = self.search([('code', '=like', f'{prefix}%')], limit=1)
        return regime.regime_default if regime else 'ordinario'
