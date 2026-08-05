from odoo import models, fields, api, _
from odoo.exceptions import UserError
import logging
import base64
import hashlib

_logger = logging.getLogger(__name__)


class BrandProjectLogo(models.Model):
    _inherit = 'erpv6.brand.project'

    def _get_deterministic_shape(self, name):
        """
        Restituisce una forma geometrica deterministica basata sul nome.
        Usa l'hash del nome per scegliere in modo riproducibile.
        """
        if not name:
            return 'circle'
        
        hash_val = int(hashlib.md5(name.encode()).hexdigest(), 16)
        shapes = ['circle', 'hexagon', 'square', 'triangle']
        return shapes[hash_val % len(shapes)]

    def _generate_svg_monogram(self, name, palette):
        """
        Genera un SVG algoritmico con monogramma (iniziali) su forma geometrica.
        Usa colori dalla palette.
        """
        if not name:
            name = 'BRAND'
        
        # Estrai iniziali (max 3)
        initials = ''.join([word[0].upper() for word in name.split()[:3]])
        if len(initials) < 2 and len(name) >= 2:
            initials = name[:2].upper()
        initials = initials[:3]
        
        # Colori dalla palette
        primary = palette.get('primary', '#333333') if palette else '#333333'
        secondary = palette.get('secondary', '#666666') if palette else '#666666'
        accent = palette.get('accent', '#FF5722') if palette else '#FF5722'
        
        shape = self._get_deterministic_shape(name)
        
        # Genera SVG in base alla forma
        if shape == 'circle':
            shape_elem = f'<circle cx="100" cy="100" r="80" fill="{primary}"/>'
        elif shape == 'hexagon':
            points = "100,20 170,60 170,140 100,180 30,140 30,60"
            shape_elem = f'<polygon points="{points}" fill="{primary}"/>'
        elif shape == 'square':
            shape_elem = f'<rect x="30" y="30" width="140" height="140" rx="10" fill="{primary}"/>'
        elif shape == 'triangle':
            points = "100,30 170,170 30,170"
            shape_elem = f'<polygon points="{points}" fill="{primary}"/>'
        else:
            shape_elem = f'<circle cx="100" cy="100" r="80" fill="{primary}"/>'
        
        svg_content = f'''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
    <!-- Sfondo -->
    <rect width="200" height="200" fill="#ffffff"/>
    
    <!-- Forma base -->
    {shape_elem}
    
    <!-- Monogramma -->
    <text x="100" y="115" font-family="Arial, sans-serif" font-size="40" font-weight="bold" 
          fill="{secondary}" text-anchor="middle" dominant-baseline="middle">
        {initials}
    </text>
    
    <!-- Accento decorativo -->
    <circle cx="150" cy="50" r="8" fill="{accent}"/>
</svg>
'''
        return svg_content.encode('utf-8')

    def action_generate_logo_draft(self):
        """
        Genera una bozza di logo SVG algoritmico (NON via AI).
        Usa forme geometriche semplici parametrizzate dal selected_name e selected_palette.
        Salva come erpv6.library.document con category='brand_logo'.
        """
        self.ensure_one()
        
        if not self.selected_name:
            raise UserError(_('È necessario impostare un "Nome Brand Selezionato" prima di generare il logo.'))
        
        # Genera SVG
        svg_data = self._generate_svg_monogram(self.selected_name, self.selected_palette)
        
        # Crea il documento nella library
        filename = f"logo_bozza_{self.selected_name.replace(' ', '_').lower()}.svg"
        
        library_doc = self.env['erpv6.library.document'].create({
            'project_id': self.lead_id.id if self.lead_id else False,
            'name': f"Bozza Logo - {self.selected_name}",
            'category': 'brand_logo',
            'origin': 'generated',
            'brand_project_id': self.id,
            'is_final_client_facing': False,
            'file': base64.b64encode(svg_data),
            'file_name': filename,
        })
        
        # Aggiorna il riferimento al logo sul brand project
        self.write({'selected_logo_asset_id': library_doc.id})
        
        return {
            'type': 'ir.actions.client',
            'tag': 'display_notification',
            'params': {
                'title': _('Logo Bozza Generato'),
                'message': _('SVG algoritmico creato per "{}"').format(self.selected_name),
                'type': 'success',
                'sticky': False,
            }
        }

    def action_generate_logo_ai(self):
        """
        Genera un logo tramite AI usando erpv6.omni_bridge.execute_ai_task.
        task_type='logo_generation_ai' (deve essere configurata in erpv6_omni_bridge).
        Richiede un provider con provider_type='image'.
        """
        self.ensure_one()
        
        if not self.selected_name:
            raise UserError(_('È necessario impostare un "Nome Brand Selezionato" prima di generare il logo AI.'))
        
        # Verifica se esiste un provider 'image'
        image_provider = self.env['erpv6.omni.provider'].search(
            [('provider_type', '=', 'image'), ('is_active', '=', True)],
            limit=1
        )
        
        if not image_provider:
            # DUBBIO: Nessun provider image trovato - segnalo invece di inventare credenziali
            _logger.warning(
                "Nessun provider AI di tipo 'image' configurato. "
                "È necessario configurare un provider (es. DALL-E, Midjourney API, Stable Diffusion) "
                "con provider_type='image' per usare la generazione logo AI."
            )
            raise UserError(_(
                "Nessun provider di generazione immagini configurato. "
                "Contattare l'amministratore per aggiungere un provider AI con provider_type='image' "
                "(es. DALL-E, Stable Diffusion) nelle configurazioni OmniBridge."
            ))
        
        # Costruisci il prompt per l'AI
        palette_desc = ""
        if self.selected_palette:
            colors = [f"{k}: {v}" for k, v in self.selected_palette.items()]
            palette_desc = f" Usa questa palette colori: {', '.join(colors)}."
        
        prompt = f"""Crea un logo professionale per un brand chiamato "{self.selected_name}".
Il logo deve essere:
- Moderno e memorabile
- Adatto a uso web e stampa
- Con testo leggibile del nome del brand
{palette_desc}

Restituisci l'immagine in formato PNG o SVG."""
        
        # Chiama l'omni_bridge
        bridge = self.env['erpv6.omni.bridge']
        result = bridge.execute_ai_task(
            task_type='logo_generation_ai',
            prompt=prompt,
            payload={
                'prompt': prompt,
                'model': 'dall-e-3',
                'size': '1024x1024',
                'n': 1,
            },
            context={'brand_project_id': self.id}
        )
        
        if not result.get('success'):
            raise UserError(_('Errore nella generazione AI del logo: %s') % result.get('error', 'Errore sconosciuto'))
        
        # Estrai l'immagine dalla risposta AI
        try:
            ai_response = result.get('data', {})
            image_data = None
            if 'data' in ai_response and len(ai_response['data']) > 0:
                img_info = ai_response['data'][0]
                if 'b64_json' in img_info:
                    image_data = base64.b64decode(img_info['b64_json'])
                elif 'url' in img_info:
                    import requests
                    resp = requests.get(img_info['url'], timeout=30)
                    resp.raise_for_status()
                    image_data = resp.content
            
            if not image_data:
                raise UserError(_('Nessuna immagine restituita dall\'AI'))
            
        except Exception as e:
            _logger.error(f"Errore nel recupero immagine AI: {e}")
            raise UserError(_('Errore nel recupero dell\'immagine AI: %s') % str(e))
        
        # Crea il documento nella library
        filename = f"logo_ai_{self.selected_name.replace(' ', '_').lower()}.png"
        
        library_doc = self.env['erpv6.library.document'].create({
            'project_id': self.lead_id.id if self.lead_id else False,
            'name': f"Logo AI - {self.selected_name}",
            'category': 'brand_logo',
            'origin': 'generated',
            'brand_project_id': self.id,
            'is_final_client_facing': False,
            'file': base64.b64encode(image_data),
            'file_name': filename,
        })
        
        # Aggiorna il riferimento al logo sul brand project
        self.write({'selected_logo_asset_id': library_doc.id})
        
        return {
            'type': 'ir.actions.client',
            'tag': 'display_notification',
            'params': {
                'title': _('Logo AI Generato'),
                'message': _('Logo creato tramite AI per "{}"').format(self.selected_name),
                'type': 'success',
                'sticky': False,
            }
        }
