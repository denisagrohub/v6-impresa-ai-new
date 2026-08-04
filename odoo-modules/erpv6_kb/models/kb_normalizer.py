from odoo import api, fields, models, _
import json, re, logging
_logger = logging.getLogger(__name__)
class Erpv6KbNormalizer(models.Model):
    _name = 'erpv6.kb.normalizer'
    _description = 'Motore di Normalizzazione KB'
    @api.model
    def normalize(self, kb_id, raw_input=None):
        kb = self.env['erpv6.kb'].browse(kb_id)
        if not kb: return {'error': 'KB non trovata'}
        content = raw_input or kb.get_content_for_ai(ai_name='kb_normalizer')
        if not content: return {'error': 'Contenuto vuoto'}
        concepts = self._extract_concepts(content, kb)
        normalized = {
            'id': kb.id, 'title': concepts.get('title', kb.name),
            'description': concepts.get('description', kb.description or ''),
            'category': kb.category_id.name or 'general',
            'tags': concepts.get('tags', []), 'content': content,
            'rules': concepts.get('rules', []),
            'parent_id': self._find_parent(concepts, kb), 'weight': concepts.get('weight', 5),
            'version': kb.version
        }
        kb.write({'normalized_data': json.dumps(normalized, indent=2)})
        self._link_hierarchy(kb, normalized)
        return {'success': True, 'normalized': normalized}
    def _extract_concepts(self, content, kb):
        concepts = {'title': kb.name, 'description': kb.description or '', 'tags': [], 'rules': [], 'weight': 5}
        lines = content.split('\n')
        for line in lines[:3]:
            line = line.strip()
            if line and len(line) > 5:
                if not concepts['title'] or concepts['title'] == kb.name:
                    concepts['title'] = line[:100]
                break
        keywords = ['fiscale','agricolo','food','ristorazione','benessere','psicologia','colori','metodi','regole','storytelling','commerciale','norma','agevolazione']
        for kw in keywords:
            if kw.lower() in content.lower(): concepts['tags'].append(kw)
        rule_patterns = [(r'se\s+([^,.]+)', 'condition'), (r'allora\s+([^,.]+)', 'action')]
        for pattern, rule_type in rule_patterns:
            for match in re.findall(pattern, content, re.IGNORECASE):
                if match.strip(): concepts['rules'].append({'type': rule_type, 'value': match.strip()})
        concepts['weight'] = min(10, max(1, int(len(content) / 500) + 1))
        return concepts
    def _find_parent(self, concepts, kb):
        category_map = {
            'fiscale': self.env['erpv6.kb'].search([('name','ilike','Fiscalità Base')], limit=1),
            'agricolo': self.env['erpv6.kb'].search([('name','ilike','Agricoltura Base')], limit=1),
            'food': self.env['erpv6.kb'].search([('name','ilike','Food Base')], limit=1),
            'benessere': self.env['erpv6.kb'].search([('name','ilike','Benessere Base')], limit=1),
            'psicologia': self.env['erpv6.kb'].search([('name','ilike','Psicologia Base')], limit=1),
            'colori': self.env['erpv6.kb'].search([('name','ilike','Matrice Colori')], limit=1),
        }
        return category_map.get(kb.kb_type, None)
    def _link_hierarchy(self, kb, normalized):
        parent = self._find_parent(normalized, kb)
        if parent: kb.parent_id = parent.id
        tags = normalized.get('tags', [])
        if tags:
            children = self.env['erpv6.kb'].search([('id','!=',kb.id),('kb_type','=',kb.kb_type),('active','=',True)])
            for child in children:
                child_tags = child.tag_ids.mapped('name')
                if any(t in tags for t in child_tags):
                    child.parent_id = kb.id
