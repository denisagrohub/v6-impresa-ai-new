# -*- coding: utf-8 -*-
import logging

from odoo import api, fields, models, _

_logger = logging.getLogger(__name__)


class Erpv6KgTripleShape(models.Model):
    """Vocabolario controllato per le triple del Knowledge Graph (Fase
    1C.2, vedi docs/PLAN_knowledge_graph_phase1.md) -- SOSTITUISCE la lista
    Python hardcodata ALLOWED_TRIPLE_SHAPES che viveva in
    kb_extraction_service.py fino al 22/08/2026. Ogni riga con
    is_active=True e' una combinazione (subject_type, predicate,
    object_type) ammessa in estrazione: erpv6.kb.extraction.service la
    legge da qui (con una cache a livello di singola richiesta, vedi
    get_allowed_shapes) invece di ricalcolarla a mano ogni volta che serve
    estendere il vocabolario -- crescere qui non richiede piu' un
    ciclo modifica-codice/compila/promuovi/riavvia.

    Vive in erpv6_omni_bridge (non in erpv6_kb) per lo stesso motivo per
    cui ci vive kb_extraction_service.py: e' un motore generico
    (a-settoriale) di estrazione, non conoscenza di dominio -- vedi
    CLAUDE.md, principio "motore vs conoscenza".

    Una riga proposta dal rilevatore (_raise_triple_discovery_signal) nasce
    SEMPRE con is_active=False, source='discovery_proposal': mai
    un'attivazione automatica, resta sempre un click umano (vedi
    action_activate)."""
    _name = 'erpv6.kg.triple.shape'
    _description = 'Vocabolario Controllato Triple Knowledge Graph'
    _order = 'is_active desc, subject_type, predicate, object_type'

    subject_type = fields.Char(string='Tipo Soggetto', required=True)
    predicate = fields.Char(string='Predicato', required=True)
    object_type = fields.Char(string='Tipo Oggetto', required=True)

    is_active = fields.Boolean(
        string='Attiva', default=False,
        help="Solo le shape attive entrano nel vocabolario controllato "
             "usato in estrazione (_clean_triples). Una riga proposta dal "
             "rilevatore nasce sempre inattiva: va attivata a mano.")

    source = fields.Selection([
        ('seed_bandi', 'Seed — Layer Bandi'),
        ('seed_vendita', 'Seed — Layer Vendita/Comunicazione'),
        ('discovery_proposal', 'Proposta — Rilevatore Automatico'),
        ('manual', 'Aggiunta Manuale'),
    ], string='Origine', required=True, default='manual')

    proposed_at = fields.Datetime(
        string='Proposta il', default=fields.Datetime.now, readonly=True)
    activated_at = fields.Datetime(string='Attivata il', readonly=True)
    activated_by = fields.Many2one(
        'res.users', string='Attivata da', readonly=True)

    notes = fields.Text(string='Note')

    _sql_constraints = [
        ('triple_shape_unique',
         'unique(subject_type, predicate, object_type)',
         'Questa combinazione soggetto/predicato/oggetto esiste già nel vocabolario.'),
    ]

    def name_get(self):
        return [(rec.id, f"{rec.subject_type} -{rec.predicate}-> {rec.object_type}") for rec in self]

    def action_activate(self):
        """Click umano esplicito che attiva una shape (tipicamente una
        proposta del rilevatore, ma utilizzabile anche su una riga
        disattivata a mano) -- MAI chiamato automaticamente dal rilevatore
        stesso, vedi kb_extraction_service.py:_raise_triple_discovery_signal."""
        self.write({
            'is_active': True,
            'activated_at': fields.Datetime.now(),
            'activated_by': self.env.user.id,
        })

    def action_deactivate(self):
        self.write({'is_active': False})

    @api.model
    def get_allowed_shapes(self):
        """Tuple (subject_type, predicate, object_type) di tutte le shape
        attive -- fonte di verita' per _clean_triples al posto della vecchia
        lista Python hardcodata."""
        rows = self.sudo().search_read(
            [('is_active', '=', True)],
            ['subject_type', 'predicate', 'object_type'])
        return [(r['subject_type'], r['predicate'], r['object_type']) for r in rows]

    @api.model
    def get_allowed_node_types(self):
        """Insieme di tutti i tipi di nodo (soggetto od oggetto) usati dalle
        shape attive -- deriva dinamicamente da get_allowed_shapes, mai
        ricalcolato a mano."""
        shapes = self.get_allowed_shapes()
        return {t for shape in shapes for t in (shape[0], shape[2])}

    @api.model
    def get_allowed_shapes_text(self):
        """Descrizione leggibile "Soggetto -predicato-> Oggetto; ..." delle
        shape attive, usata nel prompt di estrazione (EXTRACTION_SYSTEM_PROMPT)
        -- generata dalla stessa fonte di get_allowed_shapes cosi' prompt e
        validazione Python non possono divergere tra loro."""
        shapes = self.get_allowed_shapes()
        return "; ".join(f"{s} -{p}-> {o}" for s, p, o in shapes)

    @api.model
    def propose_discovery_shape(self, subject_type, predicate, object_type, notes=None):
        """Scrive (o riusa, se gia' presente) una riga PROPOSTA
        (is_active=False, source='discovery_proposal') dedotta dal
        rilevatore di vocabolario insufficiente -- SOLO quando il chiamante
        riesce a dedurre un subject_type/predicate/object_type plausibile
        dal contesto reale (vedi _raise_triple_discovery_signal). Se una
        riga con la stessa tripla esiste gia' (attiva o no, di qualunque
        origine), non viene duplicata: ritorna quella esistente cosi' com'e',
        senza toccarne lo stato."""
        if not (subject_type and predicate and object_type):
            return self.browse()
        existing = self.sudo().search([
            ('subject_type', '=', subject_type),
            ('predicate', '=', predicate),
            ('object_type', '=', object_type),
        ], limit=1)
        if existing:
            return existing
        return self.sudo().create({
            'subject_type': subject_type,
            'predicate': predicate,
            'object_type': object_type,
            'is_active': False,
            'source': 'discovery_proposal',
            'notes': notes,
        })
