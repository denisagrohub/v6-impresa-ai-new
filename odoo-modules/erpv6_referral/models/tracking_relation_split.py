import logging

from odoo import api, fields, models, _
from odoo.exceptions import ValidationError

_logger = logging.getLogger(__name__)

class Erpv6TrackingRelationReferralExtension(models.Model):
    _inherit = 'erpv6.tracking.relation'

    referral_id = fields.Many2one(
        'erpv6.referral', string='Referral di origine',
        help='Se questo target è nato da una segnalazione commerciale.')
    x_v6_revenue_split = fields.Text(
        string='Ripartizione ricavi (JSON)',
        help="JSON con base compenso + beneficiari (consulenti/referral) + riserva V6.")
    revenue_split_approved = fields.Boolean(
        string='Split approvato', default=False, readonly=True,
        help='Una volta approvato, lo split è immutabile e ancorato su blockchain.')
    revenue_split_approved_at = fields.Datetime(readonly=True)
    revenue_split_approved_by = fields.Many2one('res.users', readonly=True)
    revenue_split_hash = fields.Char(readonly=True)

    # 23/09/2026: flusso accettazione consulente dello split.
    revenue_split_accepted_at = fields.Datetime(string='Split accettato il', readonly=True)
    revenue_split_accepted_by = fields.Many2one('res.users', string='Split accettato da', readonly=True)
    revenue_split_rejected_reason = fields.Text(string='Motivo rifiuto split')
    revenue_split_rejected_at = fields.Datetime(string='Split rifiutato il', readonly=True)
    revenue_split_notified_at = fields.Datetime(string='Notifica split inviata il', readonly=True)

    # 23/09/2026: stato a due livelli. 'bozza' = admin sta compilando;
    # 'in_firma' = hash+blockchain congelati, in attesa firme consulenti;
    # 'approvato' = tutti hanno firmato, definitivo; 'rifiutato' = un
    # consulente ha rifiutato (con motivazione obbligatoria) - admin puo'
    # modificare e rimandare.
    revenue_split_state = fields.Selection([
        ('bozza', 'Bozza'),
        ('in_firma', 'In firma'),
        ('approvato', 'Approvato'),
        ('rifiutato', 'Rifiutato'),
    ], string='Stato split', default='bozza', required=True, index=True)

    def _anchor_split_blockchain(self, hash_value):
        """Ancora l'hash della proposta split su blockchain (OTS/Bitcoin)."""
        for r in self:
            try:
                if 'erpv6.blockchain.record' not in self.env:
                    return
                BcRec = self.env['erpv6.blockchain.record'].sudo()
                cfg = self.env['erpv6.blockchain.config'].sudo().search(
                    [('active', '=', True)], limit=1)
                if not cfg:
                    _logger.warning('Nessuna blockchain.config attiva, skip anchor')
                    return
                rec = BcRec.create({
                    'config_id': cfg.id,
                    'document_id': r.id,
                    'document_model': 'erpv6.tracking.relation',
                    'document_name': f'Split V6 {r.name} (proposta)',
                    'document_hash': hash_value,
                })
                try:
                    rec.action_anchor_opentimestamps()
                except Exception:
                    _logger.exception('OTS anchor fallito per bcrec %s', rec.id)
            except Exception:
                _logger.exception('Blockchain anchor split fallito')

    def action_freeze_and_send_split(self):
        """23/09/2026: congela la PROPOSTA V6 (hash + blockchain) e invia
        le firme ai consulenti. Lo split NON e' definitivo finche' i
        consulenti non firmano. Stato passa a 'in_firma'."""
        import hashlib
        for r in self:
            if not r.x_v6_revenue_split:
                raise ValidationError('Nessuno split da congelare')
            if r.revenue_split_state == 'approvato':
                raise ValidationError('Split gia\' approvato definitivamente')
            # hash proposta
            h = hashlib.sha256(r.x_v6_revenue_split.encode('utf-8')).hexdigest()
            r.write({
                'revenue_split_hash': h,
                'revenue_split_approved_at': fields.Datetime.now(),
                'revenue_split_approved_by': self.env.uid,
                'revenue_split_state': 'in_firma',
            })
            # blockchain anchor proposta
            try:
                r._anchor_split_blockchain(h)
            except Exception:
                _logger.exception('Ancoraggio blockchain proposta fallito')
            # invia firme
            try:
                r.action_send_split_to_sign()
            except Exception:
                _logger.exception('Invio firme fallito')
        return True

    def action_approve_revenue_split(self):
        """DEPRECATO: mantieni per compatibilita' UI. Redirige a
        action_freeze_and_send_split. Non rende piu' definitivo."""
        return self.action_freeze_and_send_split()


    def write(self, vals):
        """23/09/2026: quando cambia x_v6_revenue_split, resetta accettazione
        precedente e invia firma accordo ai consulenti (best-effort)."""
        split_changed = 'x_v6_revenue_split' in vals
        res = super().write(vals)
        if split_changed:
            for rec in self:
                if not rec.x_v6_revenue_split:
                    continue
                try:
                    super().write({
                        'revenue_split_accepted_at': False,
                        'revenue_split_accepted_by': False,
                        'revenue_split_rejected_reason': False,
                        'revenue_split_rejected_at': False,
                        'revenue_split_approved': False,
                        'revenue_split_approved_at': False,
                        'revenue_split_approved_by': False,
                        'revenue_split_hash': False,
                        'revenue_split_notified_at': False,
                        'revenue_split_state': 'bozza',
                    })
                except Exception:
                    _logger.exception('Reset split accettazione fallito id=%s', rec.id)

                try:
                    result = rec.action_send_split_to_sign()
                    for m in (result.get('missing_data') or []):
                        pid = m.get('partner_id')
                        if not pid:
                            continue
                        partner = self.env['res.partner'].sudo().browse(pid)
                        if not partner.exists():
                            continue
                        try:
                            # 23/09/2026: magic link con scope limitato.
                            # Christian riceve link monouso che apre SOLO
                            # la pagina di compilazione dati fiscali (no
                            # accesso a dashboard completa).
                            from odoo.addons.erpv6_referral.models.system_mail_helper import (
                                send_system_mail, create_magic_link,
                            )
                            missing_str = ", ".join(m.get("missing", []))
                            magic_url = create_magic_link(
                                self.env, partner,
                                purpose='fiscal_data',
                                redirect_to='/profilo-fiscale',
                                hours=48,
                            )
                            if magic_url:
                                body_html = (
                                    f'<p>Ciao {partner.name or ""},</p>'
                                    f'<p>Sei stato inserito nello split V6 del progetto <b>{rec.name}</b>, '
                                    f'ma mancano dati fiscali per generare l\'accordo di firma.</p>'
                                    f'<p><b>Dati mancanti:</b> {missing_str}</p>'
                                    f'<p style="margin-top:1.5em;">'
                                    f'<a href="{magic_url}" '
                                    f'style="background:#0f172a;color:white;padding:10px 18px;'
                                    f'border-radius:6px;text-decoration:none;display:inline-block;">'
                                    f'Compila i tuoi dati fiscali</a></p>'
                                    f'<p style="color:#999;font-size:12px;">'
                                    f'Link valido 48 ore, monouso. Dopo il salvataggio la firma partirà automaticamente.</p>'
                                )
                            else:
                                body_html = (
                                    f'<p>Ciao {partner.name or ""},</p>'
                                    f'<p>Sei stato inserito nello split V6 del progetto <b>{rec.name}</b>, '
                                    f'ma mancano dati fiscali. Contatta V6 Impresa per completarli.</p>'
                                )
                            send_system_mail(
                                self.env,
                                partner.email,
                                f'Completa i tuoi dati per firmare lo split — {rec.name}',
                                body_html,
                                model='erpv6.tracking.relation',
                                res_id=rec.id,
                            )
                        except Exception:
                            _logger.exception('Notifica dati fiscali fallita per partner %s', pid)
                except Exception:
                    _logger.exception('Invio firma split fallito id=%s', rec.id)
        return res
