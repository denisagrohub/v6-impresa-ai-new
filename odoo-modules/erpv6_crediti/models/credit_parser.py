# pylint: disable=import-error
"""Parser PDF AdE — crediti fiscali (C-crediti-1).

04/10/2026: parser deterministico per il template AdE "Cessione
crediti". Regex calibrate sui PDF reali (Chimera, Eterna) quando
arrivano. Oggi placeholder: ritorna dict con 'error' per non
rompere il flusso UI.
"""
import base64
import logging

from odoo import api, models

_logger = logging.getLogger(__name__)


class Erpv6CreditParser(models.AbstractModel):
    _name = 'erpv6.credit.parser'
    _description = 'Parser PDF cassetto fiscale AdE'

    # 04/10/2026 (C-crediti-1): mapping codici tributo AdE -> tipologia.
    # Da completare quando avremo i PDF reali (manca 6932 superbonus
    # se presente nel cassetto, ecc.).
    TRIBUTI = {
        '6925': 'bonus_facciate',
        '7702': 'ecobonus',
        '7701': 'sismabonus',
        '6914': 'superbonus',
        '6932': 'superbonus',
        '7039': 'intermediari',
    }

    @api.model
    def parse_pdf(self, pdf_data_b64):
        """Parsa il PDF AdE. Ritorna dict con:
          {cedente_nome, cf_commercialista, utenza, data_estratto,
           linee: [{codice, descrizione, tipologia, anno, importo}]}

        Oggi PLACEHOLDER: il parser reale verra' implementato
        quando avremo i PDF di test (Chimera, Eterna).
        """
        if not pdf_data_b64:
            return {'error': 'PDF vuoto'}
        try:
            raw = base64.b64decode(pdf_data_b64)
        except Exception as e:
            return {'error': 'Base64 non valido: %s' % e}
        if not raw.startswith(b'%PDF'):
            return {'error': 'File non PDF'}
        _logger.info(
            "Credit parser: PDF ricevuto (%d bytes), placeholder",
            len(raw))
        return {
            'error': 'Parser non ancora implementato — PDF di '
                     'test non ancora ricevuti',
            'pdf_size': len(raw),
        }
