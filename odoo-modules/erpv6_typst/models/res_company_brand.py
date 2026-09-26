from odoo import api, fields, models


class ResCompany(models.Model):
    _inherit = 'res.company'

    # 26/09/2026: campi brand per il motore Typst.
    # Usati da _generate_pdf_with_typst e preview_source per iniettare
    # colori + logo in ogni PDF generato.
    x_v6_primary_color = fields.Char(
        string='Colore primario', default='#0f172a',
        help='Colore principale del brand (hex, es. #0f172a)')
    x_v6_secondary_color = fields.Char(
        string='Colore secondario', default='#1a7fa8',
        help='Colore secondario/accento (hex)')
    x_v6_accent_color = fields.Char(
        string='Colore accento', default='#ea580c',
        help='Colore di evidenziazione (hex)')
    x_v6_text_color = fields.Char(
        string='Colore testo', default='#1a1a1a',
        help='Colore del testo principale (hex)')
    x_v6_font_body = fields.Char(
        string='Font corpo', default='Inter',
        help='Font per il testo (deve essere installato in Typst)')
    x_v6_font_heading = fields.Char(
        string='Font titoli', default='Inter',
        help='Font per i titoli')
    x_v6_tagline = fields.Char(
        string='Tagline', default='Consulenza B2B',
        help='Sottotitolo mostrato sotto il logo')

    x_v6_contact_email = fields.Char(
        string='Email contatto documenti', default='consulenza@v6impresa.it',
        help='Email mostrata nei documenti (footer, contatti). '
             'Non usata per notifiche automatiche.')
