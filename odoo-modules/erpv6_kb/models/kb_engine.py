from odoo import api, fields, models, _
import json, logging
_logger = logging.getLogger(__name__)
class Erpv6KbEngine(models.Model):
    _name = 'erpv6.kb.engine'
    _description = 'Motore KB V6'
    name = fields.Char(default='KB Engine')
    active = fields.Boolean(default=True)
    @api.model
    def process(self, kb_id, input_data):
        kb = self.env['erpv6.kb'].browse(kb_id)
        if not kb: return self._handle_missing_kb(input_data)
        specificity = self._calculate_specificity(kb, input_data)
        if specificity < 0.3: return self._handle_generic_kb(kb, input_data, specificity)
        kb.action_log_usage('kb_engine')
        return self._process_kb(kb, input_data)
    def _process_kb(self, kb, input_data):
        content = kb.get_content_for_ai(ai_name='kb_engine')
        try: data = json.loads(content) if content else {}
        except: data = {}
        processors = {'psicologia': self._process_psychology, 'colori': self._process_colors,
                      'metodi': self._process_methods, 'regole': self._process_rules,
                      'storytelling': self._process_storytelling, 'commerciale': self._process_commercial}
        return processors.get(kb.kb_type, self._process_default)(kb, input_data, data)
    def _process_psychology(self, kb, input_data, data):
        profile = input_data.get('disc', 'C')
        profiles = data.get('profiles', {})
        return {'profile': profile, 'characteristics': profiles.get(profile, {}), 'recommendations': '...'}
    def _process_colors(self, kb, input_data, data):
        disc = input_data.get('disc', 'C')
        target = input_data.get('target', 'professionisti')
        disc_palette = data.get('disc_palettes', {}).get(disc, {})
        target_palette = data.get('target_palettes', {}).get(target, {})
        return {'palette': {**disc_palette, **target_palette}}
    def _process_methods(self, kb, input_data, data):
        method_type = input_data.get('method_type', 'v6')
        methods = data.get('methods', {})
        return {'method': method_type, 'result': methods.get(method_type, {})}
    def _process_rules(self, kb, input_data, data):
        rules = data.get('rules', [])
        return {'rules': rules, 'count': len(rules)}
    def _process_storytelling(self, kb, input_data, data):
        disc = input_data.get('disc', 'C')
        company = input_data.get('company', 'Azienda')
        templates = data.get('templates', {})
        template = templates.get(disc, templates.get('default', {}))
        return {'story': template.get('template', '').format(company=company), 'archetype': template.get('archetype', '')}
    def _process_commercial(self, kb, input_data, data):
        windows = data.get('windows', [])
        return {'windows': windows}
    def _process_default(self, kb, input_data, data):
        return {'id': kb.id, 'name': kb.name, 'content': data}
    def _handle_missing_kb(self, input_data):
        sector = input_data.get('sector', 'generico')
        request = self.env['erpv6.kb.request'].create_from_gap(
            sector, input_data.get('category', 'general'), input_data.get('tags', []),
            input_data, f"Nessuna KB per '{sector}'"
        )
        return {'fallback': True, 'message': 'Nessuna KB specifica', 'sector': sector, 'kb_request_id': request.id}
    def _handle_generic_kb(self, kb, input_data, specificity):
        sector = input_data.get('sector', 'generico')
        request = self.env['erpv6.kb.request'].create_from_gap(
            sector, kb.category_id.name, [], input_data,
            f"KB '{kb.name}' troppo generica per '{sector}'"
        )
        result = self._process_kb(kb, input_data)
        result['kb_request_id'] = request.id
        return result
    def _calculate_specificity(self, kb, input_data):
        sector = input_data.get('sector', '').lower()
        if not sector: return 0.5
        tags = kb.tag_ids.mapped('name')
        name = kb.name.lower()
        for tag in tags:
            if sector in tag.lower() or tag.lower() in sector: return 0.8
        if sector in name or name in sector: return 0.7
        if kb.category_id and sector in kb.category_id.name.lower(): return 0.5
        return 0.2
