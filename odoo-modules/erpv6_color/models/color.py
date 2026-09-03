from odoo import models, _


class BrandProjectPalette(models.Model):
    _inherit = 'erpv6.brand.project'

    def action_generate_palette(self, disc_profile=None, target=None):
        """Genera la palette colori DAVVERO chiamando il nodo Adaptive EOSv6
        (erpv6_core_engine.node_color_palette_generator, process_key=
        'kb_engine_process', rombo KB dinamico kb_type='colori') invece di
        duplicare qui la chiamata a erpv6.kb.engine -- decomposizione
        originale del 29/08/2026, prima vera sostituzione (non solo
        prototipo parallelo) dal 30/08/2026: l'Output Binding dichiarato sul
        nodo (output_binding_field='selected_palette', value_path=
        'result.palette') scrive DAVVERO self.selected_palette, non e' piu'
        un'assegnazione diretta qui. Se la KB manca o l'input e' incompleto
        (es. 'target' mancante per il kb_type risolto), run_process()
        solleva UserError dal Motore stesso (_run_kb_engine_process, via
        KB_ENGINE_REQUIRED_INPUTS) -- MAI dalla morsettiera (prompt #6):
        kb_engine_process ha zero righe in erpv6.core.process.input_spec per
        costruzione (la firma varia per kb_type risolto a runtime, vedi
        prompt #4), quindi la morsettiera non lo blocca mai, invariato.
        L'errore si propaga cosi' com'e': NESSUN fallback silenzioso a
        colori hardcoded (bug noto rimosso, non piu' mantenuto)."""
        self.ensure_one()
        if disc_profile is None:
            disc_profile = 'C'
        if target is None:
            target = 'professionisti'

        node = self.env.ref('erpv6_core_engine.node_color_palette_generator')
        node.run_process({
            'disc': disc_profile,
            'target': target,
            'sector': self.partner_id.company_type if self.partner_id else 'generico',
            'binding_record_id': self.id,
        })

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

