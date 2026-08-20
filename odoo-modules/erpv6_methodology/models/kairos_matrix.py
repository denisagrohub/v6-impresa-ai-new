from odoo import api, fields, models


class Erpv6KairosMatrix(models.Model):
    _name = 'erpv6.kairos.matrix'
    _description = 'Matrice Kairós - Motore generico Impatto x Prontezza (4 quadranti)'

    res_model = fields.Char(string='Modello Collegato', required=True, index=True)
    res_id = fields.Integer(string='ID Record', required=True, index=True)
    
    matrix_type = fields.Selection([
        ('organizzativo', 'Kairós Organizzativo'),
        ('finanziario', 'Matrice Finanziabilità x Prontezza'),
        ('tecnico', 'Kairós Tecnico (sistema/debito tecnico)'),
    ], string='Tipo Matrice', required=True, default='organizzativo')
    
    name = fields.Char(string='Nome/Descrizione', compute='_compute_name', store=True)

    # Impatto (derivato tipicamente da Pareto o inserito manualmente)
    impatto_score = fields.Integer(string='Punteggio Impatto (1-5)', required=True)
    impatto_level = fields.Selection([
        ('basso', 'Basso'),
        ('alto', 'Alto'),
    ], string='Livello Impatto', compute='_compute_impact_level', store=True)

    # Indicatori per prontezza (scala 1-3 ciascuno)
    # Nomi generici con help che spiega la doppia semantica
    indicatore_1 = fields.Integer(
        string='Indicatore 1 (Stato emotivo/Apertura)',
        required=True,
        help="Organizzativo: stato emotivo del titolare (3=aperto, 1=difensivo). "
             "Finanziario: stesso significato applicato alla leadership decisionale. "
             "Tecnico: causa del problema chiara e non contestata (3) o ancora ambigua/in discussione (1)."
    )
    indicatore_2 = fields.Integer(
        string='Indicatore 2 (Energia/Risorse interne)',
        required=True,
        help="Organizzativo: energia e motivazione interna. "
             "Finanziario: capacità di investimento interno / liquidità disponibile. "
             "Tecnico: fix a basso rischio/additivo (3) o intervento invasivo su logica condivisa (1)."
    )
    indicatore_3 = fields.Integer(
        string='Indicatore 3 (Risorse disponibili)',
        required=True,
        help="Organizzativo: risorse strumentali e umane. "
             "Finanziario: accesso a finanziamenti esterni / garanzie. "
             "Tecnico: nessuna dipendenza esterna bloccante, es. provider AI (3) o dipendenza critica non disponibile (1)."
    )
    indicatore_4 = fields.Integer(
        string='Indicatore 4 (Pressione esterna)',
        required=True,
        help="Organizzativo: pressione competitiva o di mercato. "
             "Finanziario: urgenza finanziaria / scadenze imminenti. "
             "Tecnico: quanto il bug blocca utenti/dati reali in questo momento (3=alta urgenza, 1=nessuna)."
    )
    indicatore_5 = fields.Integer(
        string='Indicatore 5 (Storia tentativi precedenti)',
        required=True,
        help="Organizzativo: esperienze pregresse di cambiamento. "
             "Finanziario: storico relazioni bancarie / finanziamenti passati. "
             "Tecnico: esperienza pregressa nel risolvere problemi simili su questo stack (3=già fatto, 1=mai)."
    )

    prontezza_totale = fields.Integer(string='Prontezza Totale (5-15)', compute='_compute_prontezza', store=True)
    prontezza_level = fields.Selection([
        ('bassa', 'Bassa (5-8)'),
        ('media', 'Media (9-12)'),
        ('alta', 'Alta (13-15)'),
    ], string='Livello Prontezza', compute='_compute_prontezza_level', store=True)

    quadrante = fields.Selection([
        ('prepara_condizioni', 'Prepara le Condizioni'),
        ('kairos_autentico', 'Kairós Autentico'),
        ('parcheggio', 'Parcheggio'),
        ('quick_win', 'Quick Win'),
    ], string='Quadrante', compute='_compute_quadrante', store=True)

    assessment_date = fields.Date(string='Data Valutazione', default=fields.Date.context_today)
    previous_matrix_id = fields.Many2one('erpv6.kairos.matrix', string='Valutazione Precedente')
    notes = fields.Text(string='Note')

    @api.depends('res_model', 'res_id')
    def _compute_name(self):
        for rec in self:
            try:
                if rec.res_model and rec.res_id:
                    model = self.env[rec.res_model]
                    record = model.browse(rec.res_id).exists()
                    if record:
                        rec.name = f"{rec.matrix_type} - {record.display_name}"
                    else:
                        rec.name = f"{rec.matrix_type} (record non trovato)"
                else:
                    rec.name = "Nuova valutazione"
            except Exception:
                rec.name = "Nuova valutazione"

    @api.depends('impatto_score')
    def _compute_impact_level(self):
        for rec in self:
            if rec.impatto_score >= 4:
                rec.impatto_level = 'alto'
            else:
                rec.impatto_level = 'basso'

    @api.depends('indicatore_1', 'indicatore_2', 'indicatore_3', 'indicatore_4', 'indicatore_5')
    def _compute_prontezza(self):
        for rec in self:
            rec.prontezza_totale = (rec.indicatore_1 + rec.indicatore_2 + 
                                     rec.indicatore_3 + rec.indicatore_4 + rec.indicatore_5)

    @api.depends('prontezza_totale')
    def _compute_prontezza_level(self):
        for rec in self:
            if rec.prontezza_totale <= 8:
                rec.prontezza_level = 'bassa'
            elif rec.prontezza_totale <= 12:
                rec.prontezza_level = 'media'
            else:
                rec.prontezza_level = 'alta'

    @api.depends('impatto_level', 'prontezza_level')
    def _compute_quadrante(self):
        """
        Logica quadranti:
        - impatto alto + prontezza bassa = prepara_condizioni
        - impatto alto + prontezza alta = kairos_autentico
        - impatto basso + prontezza bassa = parcheggio
        - impatto basso + prontezza alta = quick_win
        """
        for rec in self:
            if rec.impatto_level == 'alto':
                if rec.prontezza_level == 'bassa':
                    rec.quadrante = 'prepara_condizioni'
                elif rec.prontezza_level == 'alta':
                    rec.quadrante = 'kairos_autentico'
                else:
                    # prontezza media con impatto alto: zona grigia, tendiamo a prepara_condizioni
                    rec.quadrante = 'prepara_condizioni'
            else:  # impatto basso
                if rec.prontezza_level == 'bassa':
                    rec.quadrante = 'parcheggio'
                elif rec.prontezza_level == 'alta':
                    rec.quadrante = 'quick_win'
                else:
                    # prontezza media con impatto basso: parcheggio
                    rec.quadrante = 'parcheggio'
