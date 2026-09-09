from odoo import _, api, models
from odoo.exceptions import UserError

REFERRAL_TAG_NAME = 'Referral (Win-Win)'


class Erpv6ResUsersAdminDashboard(models.Model):
    """Estensione minima di res.users per la quarta tab 'Amministrazione'
    della dashboard OWL (07/09/2026, prompt 'Dashboard: quarta tab
    Amministrazione, solo group_system'). Il check di visibilita' e'
    SEMPRE lato server (is_admin_user, chiamato dal componente OWL prima
    di decidere se mostrare la tab) - mai un nascondimento solo-frontend,
    aggirabile da chiunque apra la console del browser. Vive qui
    (erpv6_winwin_renderdata) perche' res.users e' nativo Odoo: nessun
    rischio di dipendenza circolare con aeosv6_relation/aeosv6_booking."""
    _inherit = 'res.users'

    @api.model
    def is_admin_user(self):
        return self.env.user.has_group('base.group_system')

    @api.model
    def get_admin_dashboard_data(self):
        """Dato per la tab Amministrazione (mai chiamato dal frontend se
        is_admin_user() e' False, ma ri-controllato anche qui: un
        endpoint @api.model e' comunque raggiungibile da chiunque sappia
        l'URL, il controllo server-side deve valere sempre, non solo
        quando il componente si comporta bene)."""
        if not self.is_admin_user():
            raise UserError(_("Solo un amministratore puo' accedere a questi dati."))

        Consultant = self.env['erpv6.consulting.consultant'].sudo()
        existing_partner_ids = Consultant.search([]).mapped('partner_id').ids

        candidati = self.sudo().search([
            ('share', '=', False),
            ('partner_id', 'not in', existing_partner_ids or [0]),
        ])
        Brand = self.env[Consultant._fields['brand_id'].comodel_name].sudo()
        brands = Brand.search([])

        Tag = self.env['res.partner.category'].sudo()
        referral_tag = Tag.search([('name', '=', REFERRAL_TAG_NAME)], limit=1)
        Referrals = self.env['res.partner'].sudo()
        referrals = Referrals.search([('category_id', 'in', referral_tag.ids)]) if referral_tag else Referrals

        # 09/09/2026 (prompt "Candidatura partnership + routing token
        # prodotto + rotazione claim homepage", Parte A punto 4): coda
        # candidature dentro la stessa tab Amministrazione gia'
        # esistente, stesso controllo server-side is_admin_user() sopra -
        # nessuna azione automatica oltre al cambio stato manuale
        # (action_set_state_from_dashboard).
        Candidacy = self.env['erpv6.partnership.candidacy'].sudo()
        candidacies = Candidacy.search([])

        return {
            'users': [{'id': u.id, 'name': u.name} for u in candidati],
            'brands': [{'id': b.id, 'name': b.name} for b in brands],
            'consultants': [
                {'id': c.id, 'name': c.partner_id.name, 'brand': c.brand_id.name}
                for c in Consultant.search([])
            ],
            'referrals': [{'id': r.id, 'name': r.name, 'email': r.email or ''} for r in referrals],
            'candidacies': [
                {
                    'id': c.id, 'name': c.name, 'company_name': c.company_name or '',
                    'email': c.email, 'phone': c.phone or '', 'proposal': c.proposal or '',
                    'state': c.state, 'create_date': c.create_date and c.create_date.isoformat() or '',
                }
                for c in candidacies
            ],
        }


class Erpv6ConsultingConsultantAdmin(models.Model):
    """Creazione consulente dalla tab Amministrazione (Fase 2 del prompt):
    seleziona un res.users interno GIA' ESISTENTE (mai crea credenziali
    d'accesso, fuori scope esplicito) e collega/crea il record di
    business erpv6.consulting.consultant."""
    _inherit = 'erpv6.consulting.consultant'

    @api.model
    def action_create_from_dashboard(self, user_id, brand_id):
        if not self.env.user.has_group('base.group_system'):
            raise UserError(_("Solo un amministratore puo' creare un consulente."))
        user = self.env['res.users'].sudo().browse(int(user_id))
        if not user.exists():
            raise UserError(_("Utente non trovato."))
        if not brand_id:
            raise UserError(_("Seleziona un brand."))
        existing = self.sudo().search([('partner_id', '=', user.partner_id.id)], limit=1)
        if existing:
            raise UserError(_(
                "Esiste gia' un consulente collegato a %s (id %s) - "
                "nessun duplicato creato."
            ) % (user.name, existing.id))
        consultant = self.sudo().create({
            'partner_id': user.partner_id.id,
            'brand_id': int(brand_id),
        })
        return {'id': consultant.id, 'name': consultant.partner_id.name}


class ResPartnerReferralAdmin(models.Model):
    """Registrazione referral dalla tab Amministrazione (Fase 3 del
    prompt): un res.partner esistente (trovato per nome/email) o creato
    al volo, taggato con la categoria REFERRAL_TAG_NAME per poterlo
    ritrovare/elencare. Non crea nessun Arco erpv6.tracking.relation -
    quello resta l'azione separata "aggiungi referral a un progetto",
    gia' discussa altrove e non nello scope di questo lavoro."""
    _inherit = 'res.partner'

    @api.model
    def action_create_referral(self, name, email=None, phone=None):
        if not self.env.user.has_group('base.group_system'):
            raise UserError(_("Solo un amministratore puo' registrare un referral."))
        name = (name or '').strip()
        if not name:
            raise UserError(_("Il nome e' obbligatorio."))

        Tag = self.env['res.partner.category'].sudo()
        tag = Tag.search([('name', '=', REFERRAL_TAG_NAME)], limit=1)
        if not tag:
            tag = Tag.create({'name': REFERRAL_TAG_NAME})

        domain = [('name', '=', name)]
        if email:
            domain = ['|', ('name', '=', name), ('email', '=', email)]
        existing = self.sudo().search(domain, limit=1)
        if existing:
            if tag.id not in existing.category_id.ids:
                existing.write({'category_id': [(4, tag.id)]})
            return {'id': existing.id, 'name': existing.name, 'created': False}

        partner = self.sudo().create({
            'name': name,
            'email': email or False,
            'phone': phone or False,
            'category_id': [(4, tag.id)],
        })
        return {'id': partner.id, 'name': partner.name, 'created': True}
