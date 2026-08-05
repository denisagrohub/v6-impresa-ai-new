from odoo import models, fields, api, _
from odoo.exceptions import UserError
import logging

_logger = logging.getLogger(__name__)


class NamingCandidate(models.Model):
    _name = 'erpv6.naming.candidate'
    _description = 'Candidato per Naming del Brand'
    _order = 'memorability_score desc, name'

    brand_project_id = fields.Many2one(
        'erpv6.brand.project',
        string='Progetto Brand',
        required=True,
        ondelete='cascade'
    )
    name = fields.Char(string='Nome Candidato', required=True)
    rationale = fields.Text(string='Razionale')
    memorability_score = fields.Integer(
        string='Punteggio Memorabilità (1-10)',
        default=5
    )
    domain_available = fields.Selection([
        ('unknown', 'Da verificare'),
        ('available', 'Disponibile'),
        ('taken', 'Non disponibile'),
    ], string='Disponibilità Dominio', default='unknown')
    is_selected = fields.Boolean(string='Selezionato', default=False)


class BrandProjectNaming(models.Model):
    _inherit = 'erpv6.brand.project'

    def action_generate_naming_candidates(self, count=10):
        """
        Genera candidati per il naming tramite erpv6.omni_bridge.execute_ai_task.
        task_type='naming_generation' (deve essere configurata in erpv6_omni_bridge).
        """
        self.ensure_one()
        
        # Costruisci il contesto per l'AI
        context_data = {
            'project_name': self.name,
            'sector': self.partner_id.company_type if self.partner_id else 'generico',
            'target': 'professionisti',  # Default, potrebbe essere esteso
        }
        
        prompt = f"""Genera {count} nomi creativi per un brand con queste caratteristiche:
- Progetto: {self.name}
- Settore: {context_data['sector']}
- Target: {context_data['target']}

Per ogni nome fornisci:
1. Il nome proposto
2. Un razionale (perché è efficace)
3. Un punteggio di memorabilità da 1 a 10

Restituisci SOLO un JSON array nel formato:
[
    {{"name": "NomeBrand", "rationale": "Spiegazione...", "memorability_score": 8}},
    ...
]
"""
        
        # Chiama l'omni_bridge
        bridge = self.env['erpv6.omni.bridge']
        result = bridge.execute_ai_task(
            task_type='naming_generation',
            prompt=prompt,
            payload={
                'messages': [
                    {'role': 'system', 'content': 'Sei un esperto di naming e branding. Restituisci solo JSON valido.'},
                    {'role': 'user', 'content': prompt}
                ],
                'model': 'gpt-4-turbo',
                'temperature': 0.8,
            },
            context={'brand_project_id': self.id}
        )
        
        if not result.get('success'):
            raise UserError(_('Errore nella generazione dei naming: %s') % result.get('error', 'Errore sconosciuto'))
        
        # Estrai i dati dalla risposta AI
        try:
            ai_response = result.get('data', {})
            choices = ai_response.get('choices', [])
            if not choices:
                raise UserError(_('Nessuna risposta valida dall\'AI'))
            
            content = choices[0].get('message', {}).get('content', '{}')
            # Potrebbe essere necessario pulire il contenuto se include markdown
            import json
            import re
            # Rimuovi eventuali backticks markdown
            content_clean = re.sub(r'```json\s*|\s*```', '', content.strip())
            candidates_data = json.loads(content_clean)
        except Exception as e:
            _logger.error(f"Errore nel parsing della risposta AI: {e}")
            raise UserError(_('Errore nel parsing della risposta AI: %s') % str(e))
        
        # Crea i record erpv6.naming.candidate
        created_count = 0
        for cand in candidates_data:
            if isinstance(cand, dict) and 'name' in cand:
                self.env['erpv6.naming.candidate'].create({
                    'brand_project_id': self.id,
                    'name': cand.get('name', ''),
                    'rationale': cand.get('rationale', ''),
                    'memorability_score': min(10, max(1, cand.get('memorability_score', 5))),
                })
                created_count += 1
        
        # Aggiorna lo stato del progetto
        self.write({'status': 'candidates_generated'})
        
        return {
            'type': 'ir.actions.client',
            'tag': 'display_notification',
            'params': {
                'title': _('Naming Generati'),
                'message': _('Creati {} candidati naming per "{}"').format(created_count, self.name),
                'type': 'success',
                'sticky': False,
            }
        }

