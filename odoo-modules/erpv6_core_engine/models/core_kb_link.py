from odoo import api, fields, models

from .core_node import TIPO_DATO_VOCABOLARIO


class Erpv6CoreKbLink(models.Model):
    _name = 'erpv6.core.kb_link'
    _description = 'Rombo KB -- conoscenza sostanziale collegata a un Nodo motore'

    name = fields.Char(compute='_compute_name', store=True)
    target_node_id = fields.Many2one('erpv6.core.node', string='Nodo motore', required=True, ondelete='cascade')

    resolution_mode = fields.Selection([
        ('fixed_kb', 'Voce KB fissa (pin diretto)'),
        ('dynamic', 'Risoluzione dinamica (find_best_for)'),
    ], required=True, default='fixed_kb')

    kb_id = fields.Many2one(
        'erpv6.kb', string='Voce KB (pin diretto)',
        help='Usato se resolution_mode=fixed_kb -- stesso pattern gia\' in uso in '
             'erpv6_production._KB_ANALYST_PROMPT_XMLIDS, reso dati invece che codice.')

    kb_type_dynamic = fields.Char(
        string='kb_type (dinamico)',
        help='Usato solo se resolution_mode=dynamic -- valore atteso tra quelli di '
             'erpv6.kb.KB_TYPE_SELECTION (es. "prompt", "metodo_v6").')
    kb_category_id = fields.Many2one('erpv6.kb.category', string='Categoria KB (dinamico, solo hint)')
    verticale = fields.Char(
        help="Solo per resolution_mode=dynamic -- Char libero coerente con "
             "erpv6.kb.category.verticale (nessun vincolo DB, per convenzione del progetto).")

    data_format = fields.Selection(
        TIPO_DATO_VOCABOLARIO, required=True, default='prompt',
        help='Dichiarato qui, sull\'estremo KB -- NON sull\'arco (decisione presa con Denis: '
             'l\'arco non porta un terzo canale visivo per il formato dato).')
    format_mismatch = fields.Boolean(
        compute='_compute_format_mismatch', store=True,
        help='True se data_format e\' diverso dall\'input_format del nodo target -- solo '
             'segnalazione visiva (arco rosso/tratteggiato in frontend), NON blocca '
             'l\'esecuzione in questo pilota.')

    @api.depends('kb_id.name', 'kb_type_dynamic', 'target_node_id.name')
    def _compute_name(self):
        for rec in self:
            rec.name = "KB → %s: %s" % (rec.target_node_id.name or '?', rec.kb_id.name or rec.kb_type_dynamic or '?')

    @api.depends('data_format', 'target_node_id.input_format')
    def _compute_format_mismatch(self):
        for rec in self:
            rec.format_mismatch = bool(
                rec.target_node_id.input_format and rec.data_format
                and rec.target_node_id.input_format != rec.data_format
            )

    def resolve_kb(self):
        """Ritorna il record erpv6.kb effettivo per questo rombo: pin diretto
        (fixed_kb) o risoluzione dinamica tramite erpv6.kb.find_best_for()
        gia' esistente (che ritorna un id o False, non un record -- vedi
        odoo-modules/erpv6_kb/models/kb_knowledge.py:246) -- non reinventa
        la ricerca."""
        self.ensure_one()
        KbModel = self.env['erpv6.kb']
        if self.resolution_mode == 'fixed_kb':
            return self.kb_id
        kb_id = KbModel.find_best_for(
            kb_type=self.kb_type_dynamic,
            verticale=self.verticale or None,
            category_hint=self.kb_category_id.name if self.kb_category_id else None,
        )
        if kb_id:
            return KbModel.browse(kb_id)
        # Denis, 30/08/2026, aggancio Core Engine -> erpv6.kb.request: prima
        # ritornava il recordset vuoto in silenzio, nessuna traccia del
        # buco. Riusa DAVVERO create_from_gap() gia' esistente (dedup su
        # sector+category, notifica admin) -- non reinventa la
        # segnalazione, la stessa famiglia gia' usata per la Libreria
        # (segnale Heinrich su categoria nuova, vedi erpv6.core.output).
        # Il comportamento di ritorno per chi chiama resolve_kb() resta
        # identico (recordset vuoto): questo e' solo una segnalazione in
        # piu', non un cambio di contratto.
        self.env['erpv6.kb.request'].create_from_gap(
            sector=self.verticale or "(nessun verticale specificato)",
            category=self.kb_category_id.name if self.kb_category_id else self.kb_type_dynamic,
            tags=[],
            context_data={
                'kb_type': self.kb_type_dynamic,
                'target_node': self.target_node_id.name,
                'target_node_id': self.target_node_id.id,
            },
            reason="Rombo KB dinamico non risolto: nessuna voce erpv6.kb attiva per kb_type='%s'%s" % (
                self.kb_type_dynamic,
                ", verticale='%s'" % self.verticale if self.verticale else "",
            ),
        )
        return KbModel.browse()
