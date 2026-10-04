# pylint: disable=import-error
"""Parser PDF AdE — crediti fiscali (C-crediti-1)."""
import base64
import io
import logging
import re

from odoo import api, models

_logger = logging.getLogger(__name__)


class Erpv6CreditParser(models.AbstractModel):
    _name = 'erpv6.credit.parser'
    _description = 'Parser PDF cassetto fiscale AdE'

    TRIBUTI = {
        '6925': 'bonus_facciate',
        '7702': 'ecobonus',
        '7701': 'sismabonus',
        '6914': 'superbonus',
        '6932': 'superbonus',
        '7039': 'intermediari',
    }

    CEDIBILITA_PATTERNS = [
        ('chiunque e poi tre volte', 'chiunque_3volte'),
        ('tre volte a soggetti qualificati', '3volte_qualificati'),
        ('2 volte a soggetti qualificati', '2volte_qualificati'),
        ('una volta a soggetti qualificati', '1volta_qualificati'),
        ('piu volte a chiunque', 'piu_volte_chiunque'),
        ('una volta a chiunque', '1volta_chiunque'),
        ('una volta a intermediari', '1volta_intermediari'),
    ]

    @api.model
    def _extract_text(self, pdf_bytes):
        try:
            from PyPDF2 import PdfReader
        except ImportError:
            from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(pdf_bytes))
        return '\n'.join(p.extract_text() or '' for p in reader.pages)

    @api.model
    def _parse_importo_it(self, s):
        return float(s.replace('.', '').replace(',', '.'))

    @api.model
    def _parse_header(self, text):
        out = {'cf_commercialista': None, 'utenza': None,
               'cedente_nome': None, 'commercialista_nome': None}
        m = re.search(r'Utente:\s*([A-Z0-9]{16})', text)
        if m:
            out['cf_commercialista'] = m.group(1)
            after = text[m.end():].lstrip()
            first_line = after.split('\n')[0].strip() if after else ''
            if first_line and first_line.isupper():
                out['commercialista_nome'] = first_line
        m = re.search(r'Utenza di lavoro\s*:\s*(\d+)', text)
        if m:
            out['utenza'] = m.group(1)
            # 04/10/2026: il cedente e' il testo tra il numero utenza e
            # 'Esci' (o 'Ti trovi'). PyPDF2 puo' spezzarlo su piu' righe
            # o fondere 'Esci' sulla stessa riga. Normalizzo whitespace.
            rest = text[m.end():]
            # Taglia a 'Esci' o 'Ti trovi'
            cut = re.search(r'Esci|Ti trovi', rest)
            if cut:
                candidate = rest[:cut.start()]
            else:
                candidate = rest[:300]
            # Normalizza whitespace
            candidate = re.sub(r'\s+', ' ', candidate).strip()
            # Pulisci eventuale unicode icon (Wingdings/U+E000-U+F8FF)
            candidate = re.sub(r'[\uE000-\uF8FF]', '', candidate).strip()
            if candidate:
                out['cedente_nome'] = candidate[:200]
        return out

    @api.model
    def _parse_sections(self, text):
        parts = re.split(r'(Codice tributo\s+\d+)', text)
        sections = []
        for i in range(1, len(parts), 2):
            header = parts[i]
            body = parts[i + 1] if i + 1 < len(parts) else ''
            m = re.match(r'Codice tributo\s+(\d+)', header)
            if not m:
                continue
            codice = m.group(1)
            body_lines = body.split('\n')
            first = body_lines[0] if body_lines else ''
            first_clean = first.lstrip('- ').strip()
            credito_idx = first_clean.lower().find('credito')
            if credito_idx > 0:
                descr = first_clean[:credito_idx].strip()
            elif first_clean:
                descr = first_clean[:80]
            else:
                descr = ''

            prev = parts[i - 1] if i - 1 >= 0 else ''
            prev_lines = [l.strip() for l in prev.split('\n') if l.strip()]
            cat = None
            for line in reversed(prev_lines[-3:]):
                line_low = line.lower()
                for pat, key in self.CEDIBILITA_PATTERNS:
                    if pat in line_low:
                        cat = key
                        break
                if cat:
                    break

            linee = []
            for mm in re.finditer(r'\b(\d{4})\s+([\d\.]+,\d{2})', body):
                anno = int(mm.group(1))
                if 2020 <= anno <= 2040:
                    try:
                        importo = self._parse_importo_it(mm.group(2))
                    except ValueError:
                        continue
                    linee.append({'anno': anno, 'importo': importo})

            sections.append({
                'codice': codice,
                'descrizione': descr[:200],
                'tipologia': self.TRIBUTI.get(codice, 'altro'),
                'categoria_cedibilita': cat,
                'linee': linee,
            })
        return sections

    @api.model
    def parse_pdf(self, pdf_data_b64):
        if not pdf_data_b64:
            return {'error': 'PDF vuoto'}
        try:
            raw = base64.b64decode(pdf_data_b64)
        except Exception as e:
            return {'error': 'Base64 non valido: %s' % e}
        if not raw.startswith(b'%PDF'):
            return {'error': 'File non PDF'}
        try:
            text = self._extract_text(raw)
        except Exception as e:
            _logger.exception('Errore estrazione testo PDF')
            return {'error': 'Estrazione PDF fallita: %s' % e}
        if 'cessione crediti' not in text.lower():
            return {'error': 'PDF non riconosciuto come cassetto AdE'}
        header = self._parse_header(text)
        sections = self._parse_sections(text)
        linee = []
        for s in sections:
            for l in s['linee']:
                linee.append({
                    'codice': s['codice'],
                    'descrizione': s['descrizione'],
                    'tipologia': s['tipologia'],
                    'categoria_cedibilita': s['categoria_cedibilita'],
                    'anno': l['anno'],
                    'importo': l['importo'],
                })
        _logger.info(
            'Credit parser: PDF %d bytes -> %d sezioni, %d righe',
            len(raw), len(sections), len(linee))
        return {
            'cf_commercialista': header['cf_commercialista'],
            'utenza': header['utenza'],
            'cedente_nome': header['cedente_nome'],
            'commercialista_nome': header['commercialista_nome'],
            'sezioni': sections,
            'linee': linee,
        }

    @api.model
    def parse_attachment(self, attachment_id):
        att = self.env['ir.attachment'].browse(attachment_id)
        return self.parse_pdf(att.datas)
