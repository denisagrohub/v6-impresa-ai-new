# pylint: disable=import-error
"""Processo certificato attivabile su un progetto partner.

05/10/2026 (C-processi-1): figlio di erpv6.tracking.relation. Pattern
FK+O2M (come erpv6.contract, erpv6.revenue.split.version).

Un processo = (progetto, process_code) + config (alias, parser, KB).
Il watcher email itera su processi attivi invece di essere hardcoded.
"""
from odoo import fields, models


class Erpv6CertificateProcess(models.Model):
    _name = 'erpv6.certificate.process'
    _description = 'Processo certificati attivo su un progetto'
    _order = 'relation_id, process_code'
    _rec_name = 'name'

    name = fields.Char(string='Nome', required=True, index=True)
    relation_id = fields.Many2one(
        'erpv6.tracking.relation', string='Progetto',
        required=True, ondelete='cascade', index=True)
    process_code = fields.Selection([
        ('credit_tax_ade', 'Crediti fiscali (AdE)'),
        ('tee_gme', 'TEE (GME)'),
        ('go_gme', 'GO (GME)'),
        # futuri: fotovoltaico_gse, ...
    ], string='Tipo processo', required=True, index=True)

    is_active = fields.Boolean(
        string='Attivo', default=True, index=True)

    # Config esplicita
    alias_in = fields.Char(
        string='Alias email in ingresso',
        help='Alias su cui arrivano i documenti. '
             'Se vuoto, eredita da relation.email_alias.')
    parser_key = fields.Char(
        string='Chiave parser',
        help="Parser da usare: 'ade_pdf' -> erpv6.credit.parser. "
             "Fallback: credit.parser se vuoto.")
    kb_category_id = fields.Many2one(
        'erpv6.kb.category', string='Categoria KB',
        help='Categoria di riferimento per questo processo.')

    # Fallback per extra futuri
    config_json = fields.Text(
        string='Configurazione aggiuntiva (JSON)',
        help='Campo libero per extra futuri. Non parsato oggi.')

    notes = fields.Text(string='Note')
