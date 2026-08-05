from odoo import models, api, _
from odoo.exceptions import UserError
import logging

_logger = logging.getLogger(__name__)


class BrandProjectPalette(models.Model):
    _inherit = 'erpv6.brand.project'

    def action_generate_palette(self, disc_profile=None, target=None):
        """
        Genera la palette colori usando erpv6.kb.engine._process_colors().
        
        Il metodo riutilizza la logica esistente in erpv6_kb/models/kb_engine.py.
        Cerca una KB di tipo 'colori' e chiama il processore appropriato.
        
        :param disc_profile: Profilo DISC (es. 'D', 'I', 'S', 'C')
        :param target: Target di riferimento (es. 'professionisti', 'giovani', ecc.)
        """
        self.ensure_one()
        
        # Se non forniti, usa valori default o dal progetto
        if disc_profile is None:
            disc_profile = 'C'  # Default
        if target is None:
            target = 'professionisti'  # Default
        
        # Cerca una KB di tipo 'colori'
        kb_colori = self.env['erpv6.kb'].search(
            [('kb_type', '=', 'colori')],
            limit=1
        )
        
        if not kb_colori:
            # DUBBIO: Nessuna KB 'colori' trovata - segnalo invece di crearne una vuota
            _logger.warning(
                "Nessuna Knowledge Base di tipo 'colori' trovata. "
                "È necessario creare e popolare una KB con kb_type='colori' contenente "
                "le mappature disc_palettes e target_palettes per generare palette colori."
            )
            raise UserError(_(
                "Nessuna Knowledge Base 'colori' configurata. "
                "Contattare l'amministratore per creare una KB di tipo 'colori' "
                "con le mappature DISC -> palette colori."
            ))
        
        # Chiama il motore KB
        input_data = {
            'disc': disc_profile,
            'target': target,
            'sector': self.partner_id.company_type if self.partner_id else 'generico',
        }
        
        engine = self.env['erpv6.kb.engine']
        result = engine.process(kb_colori.id, input_data)
        
        # Il risultato di _process_colors() è {'palette': {...}}
        palette = result.get('palette', {})
        
        if not palette:
            _logger.warning(f"Palette vuota generata per DISC={disc_profile}, target={target}")
            palette = {
                'primary': '#333333',
                'secondary': '#666666',
                'accent': '#FF5722',
            }  # Fallback minimale
        
        # Salva la palette sul brand_project
        self.write({'selected_palette': palette})
        
        return {
            'type': 'ir.actions.client',
            'tag': 'display_notification',
            'params': {
                'title': _('Palette Generata'),
                'message': _('Palette colori generata per "{}"').format(self.name),
                'type': 'success',
                'sticky': False,
            }
        }

