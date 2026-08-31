from odoo import api, fields, models

from .core_node import TIPO_DATO_VOCABOLARIO


class Erpv6CoreOutput(models.Model):
    _name = 'erpv6.core.output'
    _description = (
        "Output prodotto da un Nodo -- referenziabile come input altrove, non "
        "necessariamente in sequenza diretta (Denis, 29/08/2026: 'qualsiasi output "
        "finito puo' essere un input da un'altra parte, l'output intervista e' input "
        "di metodologia, ma non per forza sono sequenziali'). Stesso principio del "
        "rombo KB (erpv6.core.kb_link), ma per dati generati a runtime da un nodo "
        "invece che conoscenza pre-esistente -- vedi resolve_value() sotto,"
        "specchio di kb_link.resolve_kb()."
    )

    name = fields.Char(compute='_compute_name', store=True)
    source_node_id = fields.Many2one(
        'erpv6.core.node', string='Nodo produttore', required=True, ondelete='cascade')
    output_type = fields.Selection(
        TIPO_DATO_VOCABOLARIO, required=True, default='documento')
    library_category_name = fields.Char(
        string='Etichetta libreria (dichiarata dal circuito)', required=True,
        help="Denis, 29/08/2026: 'tutti i circuiti devono dire che tipo di output "
             "generano e l'informazione deve viaggiare sempre' -- regola fondamentale, "
             "non opzionale: un Output senza etichetta non e' dichiarabile. L'etichetta "
             "NON e' inferita a runtime dal contenuto, e' dichiarata qui, staticamente, "
             "dal circuito che produce questo Output.")
    category_id = fields.Many2one(
        'erpv6.core.library_category', string='Categoria (catalogo EAOSv6)', readonly=True,
        help="Trovata o creata automaticamente da library_category_name AL MOMENTO in "
             "cui questo Output viene dichiarato (create(), sia da un data XML "
             "all'installazione del modulo circuito sia da API) -- Denis, 29/08/2026: "
             "'nel momento in cui si installa un circuito nuovo, il catalogo legge anche "
             "gli output e se non esistono li crea', non solo quando gira l'etichettatrice.")

    @api.depends('source_node_id.name', 'output_type')
    def _compute_name(self):
        for rec in self:
            rec.name = "Output %s: %s" % (rec.output_type, rec.source_node_id.name or '?')

    @api.model_create_multi
    def create(self, vals_list):
        Category = self.env['erpv6.core.library_category']
        new_category_ids = []
        for vals in vals_list:
            label = (vals.get('library_category_name') or '').strip()
            if label and not vals.get('category_id'):
                category = Category.search([('name', '=', label)], limit=1)
                if not category:
                    category = Category.create({'name': label})
                    new_category_ids.append(category.id)
                vals['category_id'] = category.id
        records = super().create(vals_list)
        # Denis, 29/08/2026: "quando aeosv6 legge che la categoria e' nuova,
        # attiva l'etichettatrice che etichetta lo scaffale" -- una
        # categoria genuinamente nuova (mai vista prima, non solo trovata)
        # lascia un segnale reale e visibile (stesso meccanismo Heinrich
        # gia' usato dai cron di lettura), non solo un record silenzioso.
        if new_category_ids and 'erpv6.heinrich.indicator' in self.env:
            for category in Category.browse(new_category_ids):
                self.env['erpv6.heinrich.indicator'].log_signal(
                    'erpv6.core.library_category', category.id, 'near_miss',
                    "Nuovo scaffale libreria creato da un circuito: '%s'" % category.name)
        return records

    def resolve_value(self):
        """Ritorna l'output_data dell'ultima esecuzione REALE e riuscita del
        nodo produttore -- non inventa nulla: se il nodo non ha mai girato
        con successo ritorna False (stesso principio di kb_link.resolve_kb(),
        che ritorna un recordset vuoto se non risolve -- qui un valore falsy,
        niente fallback silenzioso)."""
        self.ensure_one()
        execution = self.env['erpv6.core.node.execution'].search(
            [('node_id', '=', self.source_node_id.id), ('status', '=', 'done')],
            order='id desc', limit=1)
        return execution.output_data if execution else False
