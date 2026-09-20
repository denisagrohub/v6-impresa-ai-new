# 20/09/2026: campo email_slug per il dominio @v6impresa.it
# (alias consulente tipo "denis.deste@v6impresa.it").
# Lo slug viene generato automaticamente dal nome utente.
from odoo import api, fields, models
import re
import unicodedata


def _slugify(text):
    """Trasforma 'Denis D'Este' in 'denis.deste'."""
    if not text:
        return ''
    text = unicodedata.normalize('NFKD', text).encode('ascii', 'ignore').decode('ascii')
    text = text.lower()
    text = re.sub(r"[\s'`]+", '.', text)
    text = re.sub(r'[^a-z0-9.]+', '', text)
    text = re.sub(r'\.+', '.', text).strip('.')
    return text


class ResUsers(models.Model):
    _inherit = 'res.users'

    email_slug = fields.Char(
        string='Slug email V6',
        help="Local-part dell'alias @v6impresa.it. Es. 'denis.deste' "
             "per denis.deste@v6impresa.it. Generato dal nome, immutabile.")

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if not vals.get('email_slug'):
                name = vals.get('name') or ''
                base_slug = _slugify(name)
                if base_slug:
                    slug = base_slug
                    i = 2
                    while self.with_context(active_test=False).search_count([('email_slug', '=', slug)]) > 0:
                        slug = f'{base_slug}{i}'
                        i += 1
                    vals['email_slug'] = slug
        return super().create(vals_list)
