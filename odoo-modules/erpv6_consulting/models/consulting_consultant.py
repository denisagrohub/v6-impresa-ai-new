from odoo import api, fields, models


class ConsultingConsultant(models.Model):
    _name = 'erpv6.consulting.consultant'
    _description = 'Consulente'
    # 10/09/2026: nessun campo 'name'/_rec_name era mai stato definito -
    # ovunque Odoo dovesse mostrare questo record come testo (Many2one
    # in un altro modello, come erpv6.booking.token.consultant_id) cadeva
    # sul fallback tecnico "nome.modello,id" (es. "erpv6.consulting.
    # consultant,1") invece del nome della persona - scoperto costruendo
    # la vista Call Prenotate. related+store cosi' resta un campo reale
    # ricercabile/ordinabile, non solo un display_name calcolato al volo.
    name = fields.Char(related='partner_id.name', store=True, string='Nome')
    _rec_name = 'name'

    partner_id = fields.Many2one('res.partner', string='Persona', required=True)
    brand_id = fields.Many2one('erpv6.consulting.brand', string='Brand', required=True)
    hourly_rate = fields.Float('Tariffa Oraria')
    commission_rate = fields.Float('Provvigione (%)')
    is_active = fields.Boolean('Attivo', default=True)
    fiscal_code = fields.Char('Codice Fiscale')
    vat_number = fields.Char('Partita IVA')
    zone = fields.Char('Zona Geografica')
    languages = fields.Char('Lingue Parlate', help='Es: IT, EN, DE')
    specialties = fields.Char('Specializzazioni', help='Es: Fiscale, Psicologico')
    conversion_rate = fields.Float('Tasso Conversione (%)')
    # 10/09/2026 (Denis, sulle pagine pubbliche che linkavano tutte
    # "/booking/1" scritto a mano: "deve andare ad un qualsiasi altro
    # consulente diverso da me solo se io non ho slot") - il consulente
    # con questo flag e' il primo scelto da /api/v1/booking/
    # resolve-consultant; un altro consulente ATTIVO con almeno un token
    # disponibile e' il fallback, solo se questo non ne ha. Al massimo un
    # consulente dovrebbe averlo True per volta (nessun vincolo SQL: e'
    # una scelta editoriale, non un invariante tecnico).
    is_default_public_contact = fields.Boolean(
        'Contatto Pubblico Predefinito',
        help="Consulente mostrato per primo sulle pagine pubbliche di prenotazione, "
             "se ha almeno uno slot disponibile.")

    @api.onchange('brand_id')
    def _onchange_brand_id(self):
        if self.brand_id and not self.hourly_rate:
            self.hourly_rate = self.brand_id.default_hourly_rate
            self.commission_rate = self.brand_id.default_commission_rate
