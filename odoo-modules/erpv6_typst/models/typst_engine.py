from odoo import api, fields, models, _
from odoo.exceptions import UserError
import logging

_logger = logging.getLogger(__name__)


class TypstEngine(models.Model):
    _name = 'erpv6.typst.engine'
    _description = 'Motore Typst'

    name = fields.Char(default='Typst Engine')
    active = fields.Boolean(default=True)
    typst_path = fields.Char(
        string='Percorso Typst',
        default='typst',
        help='Percorso al binario typst (es: /usr/local/bin/typst)'
    )
    
    @api.model
    def check_typst_installed(self):
        """Verifica se Typst è installato"""
        import subprocess
        
        try:
            result = subprocess.run(
                ['typst', '--version'],
                capture_output=True,
                text=True,
                timeout=5
            )
            return result.returncode == 0
        except:
            return False
    
    @api.model
    def generate_document(self, template_id, res_model, res_id, data=None):
        """Genera un documento da un template"""
        template = self.env['erpv6.typst.template'].browse(template_id)
        
        if not template.exists():
            raise UserError(_('Template non trovato'))
        
        # Crea il documento
        document = self.env['erpv6.typst.document'].create({
            'name': f'{template.name} - {res_model} #{res_id}',
            'template_id': template_id,
            'res_model': res_model,
            'res_id': res_id,
            'render_data': data or {},
        })

        # Genera il PDF
        document.action_render()

        return document

    @api.model
    def preview_source(self, source, data=None):
        """Compila un sorgente Typst al volo e ritorna PDF in bytes.
        NON salva nulla nel DB. Usato dall'editor per preview live.

        Ritorna:
            {'ok': True, 'pdf': bytes, 'duration_ms': int}
        oppure
            {'ok': False, 'errors': [{'line': int, 'column': int, 'message': str}],
             'raw_stderr': str, 'duration_ms': int}
        """
        import tempfile, subprocess, os, json, shutil, time, re
        if source is None:
            source = ''

        start = time.time()
        tmp_dir = tempfile.mkdtemp(prefix='erpv6_typst_preview_')
        typst_file = os.path.join(tmp_dir, 'document.typ')
        data_file = os.path.join(tmp_dir, 'data.json')
        pdf_file = os.path.join(tmp_dir, 'document.pdf')

        try:
            with open(typst_file, 'w', encoding='utf-8') as f:
                f.write(source)
            with open(data_file, 'w', encoding='utf-8') as f:
                json.dump(data or {}, f, ensure_ascii=False)

            # 26/09/2026: inietta logo.png + brand.json per template brandizzati
            self._inject_brand_assets(tmp_dir)

            result = subprocess.run(
                ['typst', 'compile', typst_file, pdf_file],
                capture_output=True,
                text=True,
                timeout=60,
            )
            duration_ms = int((time.time() - start) * 1000)

            if result.returncode != 0:
                errors = self._parse_typst_errors(result.stderr or '')
                return {
                    'ok': False,
                    'errors': errors,
                    'raw_stderr': result.stderr or '',
                    'duration_ms': duration_ms,
                }

            with open(pdf_file, 'rb') as f:
                pdf_bytes = f.read()

            warnings = self._parse_typst_warnings(result.stderr or '')
            return {
                'ok': True,
                'pdf': pdf_bytes,
                'warnings': warnings,
                'duration_ms': duration_ms,
            }
        except subprocess.TimeoutExpired:
            return {
                'ok': False,
                'errors': [{'line': 0, 'column': 0, 'message': 'Timeout compilazione (>60s)'}],
                'raw_stderr': 'Timeout',
                'duration_ms': int((time.time() - start) * 1000),
            }
        except Exception as e:
            return {
                'ok': False,
                'errors': [{'line': 0, 'column': 0, 'message': str(e)}],
                'raw_stderr': str(e),
                'duration_ms': int((time.time() - start) * 1000),
            }
        finally:
            shutil.rmtree(tmp_dir, ignore_errors=True)

    @api.model
    def compile_check(self, source, data=None):
        """Come preview_source ma non genera PDF: ritorna solo
        {ok, errors, warnings}. Piu' veloce per check live."""
        result = self.preview_source(source, data)
        return {
            'ok': result.get('ok', False),
            'errors': result.get('errors', []),
            'warnings': result.get('warnings', []),
            'duration_ms': result.get('duration_ms', 0),
        }

    @api.model
    def _parse_typst_errors(self, stderr):
        """Estrae errori strutturati dal stderr di typst compile.
        Formato:
            error: <message>
              --> document.typ:LINE:COL
              |
            LINE | <code>
              |      ^^^
        Ritorna [{line, column, message}, ...]
        """
        import re
        errors = []
        if not stderr:
            return errors

        # Pattern: error: msg ... --> document.typ:LINE:COL
        pattern = re.compile(
            r'error:\s*(.+?)(?:\n[\s\S]*?-->\s*document\.typ:(\d+):(\d+))?',
            re.MULTILINE,
        )
        # Approccio piu' robusto: split per 'error:'
        blocks = re.split(r'\nerror:\s*', '\n' + stderr)
        for block in blocks:
            block = block.strip()
            if not block:
                continue
            # Prima riga = messaggio
            lines = block.split('\n')
            msg = lines[0].strip()
            line_num = 0
            col_num = 0
            for l in lines[1:]:
                m = re.search(r'document\.typ:(\d+):(\d+)', l)
                if m:
                    line_num = int(m.group(1))
                    col_num = int(m.group(2))
                    break
            errors.append({'line': line_num, 'column': col_num, 'message': msg})

        if not errors and stderr.strip():
            errors.append({'line': 0, 'column': 0, 'message': stderr.strip()[:500]})
        return errors

    @api.model
    def _parse_typst_warnings(self, stderr):
        """Estrae warning dal stderr (warning: ...)."""
        import re
        warnings = []
        if not stderr:
            return warnings
        blocks = re.split(r'\nwarning:\s*', '\n' + stderr)
        for block in blocks:
            block = block.strip()
            if not block:
                continue
            lines = block.split('\n')
            msg = lines[0].strip()
            line_num = 0
            for l in lines[1:]:
                m = re.search(r'document\.typ:(\d+):(\d+)', l)
                if m:
                    line_num = int(m.group(1))
                    break
            warnings.append({'line': line_num, 'message': msg})
        return warnings


    @api.model
    def _inject_brand_assets(self, tmp_dir):
        """Copia logo.png + brand.json nella tmp_dir per la compilazione Typst."""
        import os as _os, json as _json, base64 as _b64, logging as _log
        _logger = _log.getLogger(__name__)

        # Fix: env.company in shell è vuoto o IT Company (default Odoo).
        # Cerchiamo il company con brand configurato o per nome 'V6 Impresa'.
        # 26/09/2026: priorità al company "V6 Impresa" (non IT Company default).
        # Cerca prima per nome, poi fallback su env.company.
        company = self.env['res.company'].sudo().search([
            ('name', 'ilike', 'V6 Impresa'),
        ], limit=1, order='id asc')
        if not company:
            company = self.env.company
        if not company:
            _logger.warning('_inject_brand_assets: nessun company trovato')
            return
        _logger.info('_inject_brand_assets: uso company %s (id=%s)', company.name, company.id)

        _logger.info(
            '_inject_brand_assets: company=%s logo_len=%s tmp_dir=%s',
            company.name, len(company.logo or ''), tmp_dir,
        )

        try:
            if company.logo:
                with open(_os.path.join(tmp_dir, 'logo.png'), 'wb') as f:
                    f.write(_b64.b64decode(company.logo))
            brand = {
                'name': company.name or 'V6 Impresa',
                'tagline': getattr(company, 'x_v6_tagline', None) or 'Consulenza B2B',
                'primary_color': getattr(company, 'x_v6_primary_color', None) or '#0f172a',
                'secondary_color': getattr(company, 'x_v6_secondary_color', None) or '#1a7fa8',
                'accent_color': getattr(company, 'x_v6_accent_color', None) or '#ea580c',
                'text_color': getattr(company, 'x_v6_text_color', None) or '#1a1a1a',
                'font_body': getattr(company, 'x_v6_font_body', None) or 'Inter',
                'font_heading': getattr(company, 'x_v6_font_heading', None) or 'Inter',
                'vat': company.vat or '',
                'street': company.street or '',
                'city': company.city or '',
                'zip': company.zip or '',
                'email': getattr(company, 'x_v6_contact_email', None) or company.email or '',
                'phone': company.phone or '',
                'website': getattr(company, 'website', None) or 'v6impresa.it',
            }
            brand_path = _os.path.join(tmp_dir, 'brand.json')
            with open(brand_path, 'w', encoding='utf-8') as f:
                _json.dump(brand, f, ensure_ascii=False, indent=2)
            _logger.info('_inject_brand_assets: scritti logo.png + brand.json in %s', tmp_dir)
        except Exception as e:
            _logger.exception('_inject_brand_assets FALLITO: %s', e)

