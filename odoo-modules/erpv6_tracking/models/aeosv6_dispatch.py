from odoo import _
from odoo.exceptions import UserError

from odoo.addons.erpv6_core_dispatch.registry import register_process


def _run_create_tracking_lot(env, node, input_data):
    """Motore IPO (Denis, 30/08/2026, prompt #17: sposta da erpv6_core_engine/
    models/core_node.py -- sblocca §O, chiude il ciclo erpv6_tracking<->
    erpv6_core_engine). Vive qui perche' erpv6_tracking possiede davvero
    erpv6.tracking.lot/.config, non erpv6_core_engine -- si registra da se'
    via erpv6_core_dispatch invece di essere importato/dipeso dal modulo
    orchestratore. Comportamento identico a prima dello spostamento: non
    reimplementa la logica, avvolge erpv6.tracking.lot.create_batch_lot()/
    create_definitive_lot(), che leggono la sigla azienda da res.company.
    company_code (vedi tracking_lot._get_company_code) e sollevano errore
    esplicito se manca. Input: {'lot_type': 'batch'|'definitive',
    'config_id': int, 'quantity': float opzionale, 'batch_lot_id': int
    opzionale (solo per 'definitive'), 'notes': str opzionale}. Output:
    {'success', 'lot_id', 'code', 'lot_type'}."""
    lot_type = input_data.get('lot_type')
    if lot_type not in ('batch', 'definitive'):
        raise UserError(_("Input mancante o non valido: 'lot_type' deve essere 'batch' o 'definitive'."))
    config_id = input_data.get('config_id')
    if not config_id:
        raise UserError(_("Input mancante: 'config_id' (erpv6.tracking.config gia' esistente)."))
    config = env['erpv6.tracking.config'].browse(int(config_id))
    if not config.exists():
        raise UserError(_("Configurazione tracciamento #%s non trovata.") % config_id)

    Lot = env['erpv6.tracking.lot']
    quantity = input_data.get('quantity', 1.0)
    notes = input_data.get('notes')
    if lot_type == 'batch':
        lot = Lot.create_batch_lot(config_id=config.id, quantity=quantity, notes=notes)
    else:
        batch_lot_id = input_data.get('batch_lot_id')
        lot = Lot.create_definitive_lot(
            config_id=config.id,
            batch_lot_id=int(batch_lot_id) if batch_lot_id else None,
            quantity=quantity, notes=notes,
        )
    return {'success': True, 'lot_id': lot.id, 'code': lot.code, 'lot_type': lot_type}


register_process(
    'create_tracking_lot',
    '[IPO] Crea lotto di tracciamento (sigla azienda da res.company)',
    'ipo', _run_create_tracking_lot,
)
