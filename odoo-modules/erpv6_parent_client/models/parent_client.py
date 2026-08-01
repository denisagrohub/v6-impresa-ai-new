from odoo import models, api, _
from odoo.exceptions import UserError
import logging
import json
import hashlib
from datetime import timedelta

_logger = logging.getLogger(__name__)

try:
    import requests
    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False
    _logger.error("Modulo 'requests' non installato. Installare con: pip install requests")


class Erpv6ParentClient(models.AbstractModel):
    _name = 'erpv6.parent.client'
    _description = 'Client astratto per comunicazione con parent SaaS'

    @api.model
    def _get_parent_config(self):
        """
        Recupera configurazione parent da ir.config_parameter.
        :return: dict con 'url' e 'api_key'
        """
        url = self.env['ir.config_parameter'].sudo().get_param('erpv6.parent_url')
        api_key = self.env['ir.config_parameter'].sudo().get_param('erpv6.parent_api_key')
        
        if not url or not api_key:
            raise UserError(_(
                "Configurazione parent mancante! Impostare 'erpv6.parent_url' e 'erpv6.parent_api_key' nei parametri di sistema."
            ))
        
        return {'url': url.rstrip('/'), 'api_key': api_key}

    @api.model
    def _generate_cache_key(self, endpoint, params=None):
        """
        Genera una chiave cache univoca da endpoint+parametri.
        :param endpoint: stringa endpoint (es. '/api/v1/saas/verticals')
        :param params: dict parametri opzionali
        :return: stringa hash
        """
        key_string = f"{endpoint}"
        if params:
            key_string += f"_{json.dumps(params, sort_keys=True)}"
        return hashlib.sha256(key_string.encode()).hexdigest()[:64]

    @api.model
    def fetch(self, endpoint, params=None, cache_key=None, ttl_hours=24, category=None):
        """
        Effettua una chiamata HTTP al parent con gestione cache.
        
        :param endpoint: endpoint relativo (es. '/api/v1/saas/verticals')
        :param params: dict parametri query opzionali
        :param cache_key: chiave cache personalizzata (se None, viene generata)
        :param ttl_hours: TTL della cache in ore (default 24)
        :param category: categoria per raggruppare cache
        :return: dict con struttura:
                 {'data': ..., 'from_cache': bool, 'stale': bool}
        :raises UserError: se la chiamata fallisce E non esiste cache
        """
        if not HAS_REQUESTS:
            raise UserError(_("Modulo 'requests' non disponibile. Contattare l'amministratore."))
        
        # Genera o usa cache_key fornito
        if cache_key is None:
            cache_key = self._generate_cache_key(endpoint, params)
        
        # Cerca cache esistente
        cache_rec = self.env['erpv6.parent.cache'].search([('cache_key', '=', cache_key)], limit=1)
        
        # Se cache esiste ed è valida, ritorna subito
        if cache_rec and cache_rec.is_valid():
            _logger.debug(f"Cache HIT (valida) per key {cache_key[:16]}...")
            return {
                'data': cache_rec.get_data(),
                'from_cache': True,
                'stale': False
            }
        
        # Cache non valida o inesistente: tenta chiamata HTTP
        config = self._get_parent_config()
        url = f"{config['url']}{endpoint}"
        headers = {
            'Authorization': f"Bearer {config['api_key']}",
            'Content-Type': 'application/json'
        }
        
        try:
            response = requests.get(url, params=params, headers=headers, timeout=10)
            response.raise_for_status()
            data = response.json()
            
            # Aggiorna o crea cache
            values = {
                'cache_key': cache_key,
                'content': json.dumps(data),
                'fetched_at': fields.Datetime.now(),
                'ttl_hours': ttl_hours,
            }
            if category:
                values['category'] = category
            
            if cache_rec:
                cache_rec.write(values)
            else:
                cache_rec = self.env['erpv6.parent.cache'].create(values)
            
            _logger.debug(f"Cache MISS - fetch effettuato per key {cache_key[:16]}...")
            return {
                'data': data,
                'from_cache': False,
                'stale': False
            }
            
        except requests.exceptions.RequestException as e:
            _logger.warning(f"Errore di rete nel fetch da parent ({endpoint}): {e}")
            
            # Se esiste cache scaduta, fallback su quella (stale)
            if cache_rec:
                _logger.info(f"Fallback su cache scaduta (stale) per key {cache_key[:16]}...")
                return {
                    'data': cache_rec.get_data(),
                    'from_cache': True,
                    'stale': True
                }
            
            # Nessuna cache disponibile: errore bloccante
            raise UserError(_(
                "Impossibile contattare il parent (%s). Verificare la connessione e la configurazione.\n"
                "Nessuna cache disponibile per questo endpoint."
            ) % str(e))
