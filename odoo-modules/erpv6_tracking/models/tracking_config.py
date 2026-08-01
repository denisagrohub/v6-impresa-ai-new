from odoo import models, fields, api


class TrackingConfig(models.Model):
    _name = 'erpv6.tracking.config'
    _description = 'Configurazione Tracciamento Lotti'

    name = fields.Char('Nome Configurazione', required=True)
    code = fields.Char('Codice', required=True,
                       help='Codice univoco (es: product, document, project)')

    # Flag per abilitare/disabilitare tipologie
    active = fields.Boolean('Attivo', default=True)

    # Configurazione formato lotto
    use_definitive_lot = fields.Boolean(
        'Usa Lotto Definitivo',
        default=True,
        help='Genera il codice univoco sul prodotto finito (AAA-YYGGG-PI-HHMM)'
    )
    use_batch_lot = fields.Boolean(
        'Usa Lotto Batch',
        default=True,
        help='Genera il contenitore che segue tutto il flusso'
    )

    # Configurazione azienda
    company_code = fields.Char(
        'Sigla Azienda',
        required=True,
        help='Sigla di 3 lettere (es: AAA, ERP, V6)'
    )

    # Configurazione brand
    default_brand = fields.Char(
        'Brand Default',
        default='PI',
        help='Codice brand da usare nel lotto (es: PI, ZS, MR)'
    )

    # Configurazione giorno giuliano
    use_julian_day = fields.Boolean(
        'Usa Giorno Giuliano',
        default=True,
        help='Usa il giorno dell\'anno (1-366) invece del giorno del mese'
    )

    # Configurazione timestamp
    include_time = fields.Boolean(
        'Includi Orario',
        default=True,
        help='Includi ore e minuti nel lotto definitivo'
    )

    # Tipologie abilitate
    tracking_types = fields.Selection([
        ('product', 'Prodotti'),
        ('document', 'Documenti'),
        ('project', 'Progetti'),
        ('order', 'Ordini'),
        ('custom', 'Custom'),
    ], string='Tipologia Principale', required=True)

    # ATECO suggeriti per questa configurazione
    ateco_suggested_ids = fields.Many2many(
        'erpv6.ateco.regime',
        'erpv6_tracking_config_ateco_rel',
        'config_id',
        'ateco_id',
        string='ATECO Suggeriti',
        help='Codici ATECO per i quali applicare questa configurazione'
    )

    # Descrizione
    description = fields.Text('Descrizione')

    _sql_constraints = [
        ('code_unique', 'unique(code)', 'Il codice deve essere univoco!'),
    ]

    @api.model
    def get_default_config(self, tracking_type='product'):
        """Ottiene la configurazione di default per una tipologia"""
        config = self.search(
            [('code', '=', tracking_type), ('active', '=', True)], limit=1)
        if not config:
            config = self.search([('active', '=', True)], limit=1)
        return config

    @api.model
    def get_config_for_ateco(self, ateco_code):
        """Ottiene la configurazione per un codice ATECO specifico
        
        Cerca una config con match su ateco_suggested_ids, 
        fallback su get_default_config
        """
        # Cerca config che hanno questo ATECO tra i suggeriti
        ateco_regime = self.env['erpv6.ateco.regime'].search(
            [('code', '=', ateco_code)], limit=1)
        
        if ateco_regime:
            config = self.search(
                [('ateco_suggested_ids', 'in', ateco_regime.id),
                 ('active', '=', True)], 
                limit=1
            )
            if config:
                return config
        
        # Fallback sulla config default
        return self.get_default_config()
