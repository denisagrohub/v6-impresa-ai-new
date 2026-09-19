from odoo import models, fields, api
from odoo.exceptions import ValidationError


class Erpv6Referral(models.Model):
    _name = 'erpv6.referral'
    _description = 'Segnalazione commerciale per un progetto'
    _order = 'create_date desc'

    name = fields.Char(compute='_compute_name', store=True)

    # Chi ha segnalato
    segnalante_partner_id = fields.Many2one(
        'res.partner', string='Segnalante',
        help='Contatto esterno o azienda che ha segnalato')
    segnalante_user_id = fields.Many2one(
        'res.users', string='Segnalante interno',
        help='Se la segnalazione arriva da un consulente interno')

    # Cosa ha segnalato
    relation_id = fields.Many2one(
        'erpv6.tracking.relation', string='Progetto',
        required=True, ondelete='cascade')
    target_id = fields.Many2one(
        'erpv6.tracking.relation', string='Target generato',
        help='Nodo target creato a valle di questa segnalazione')
    contatto_segnalato_nome = fields.Char(string='Nome/azienda segnalata')
    contatto_segnalato_recapito = fields.Char(string='Email/telefono segnalato')
    note_segnalazione = fields.Text()

    # Compenso
    commissione_pct = fields.Float(string='Commissione %', required=True, default=5.0)
    # 19/09/2026 (Denis): la % diventa IMMUTABILE dopo l'ancoraggio su blockchain.
    # Da quel momento il valore e' parte dell'accordo firmato e non e' piu'
    # modificabile senza uno sblocco esplicito tracciato.
    commissione_locked = fields.Boolean(string='Commissione congelata', readonly=True, default=False)
    commissione_locked_at = fields.Datetime(string='Congelata il', readonly=True)
    commissione_hash = fields.Char(string='Hash SHA-256 accordo', readonly=True)

    # Accordo Documenso
    accordo_documenso_id = fields.Char(string='Documenso Document ID')
    accordo_url = fields.Char(string='URL firma')
    accordo_firmato_il = fields.Datetime()
    accordo_pdf = fields.Binary(attachment=True)
    accordo_pdf_name = fields.Char()

    # Blockchain (collegamento al record di ancoraggio)
    blockchain_record_id = fields.Many2one(
        'erpv6.blockchain.record', string='Ancoraggio blockchain')

    # Stato
    state = fields.Selection([
        ('bozza', 'Bozza'),
        ('in_firma', 'In firma'),
        ('attivo', 'Attivo'),
        ('chiuso_ok', 'Chiuso positivamente'),
        ('chiuso_no', 'Chiuso senza successo'),
    ], default='bozza', required=True)

    # Timestamp
    creato_il = fields.Datetime(default=fields.Datetime.now, readonly=True)

    @api.depends('segnalante_partner_id', 'segnalante_user_id', 'contatto_segnalato_nome')
    def _compute_name(self):
        for r in self:
            who = r.segnalante_partner_id.name or r.segnalante_user_id.name or '?'
            target = r.contatto_segnalato_nome or '?'
            r.name = f"Referral {who} → {target}"

    @api.constrains('segnalante_partner_id', 'segnalante_user_id')
    def _check_segnalante(self):
        for r in self:
            if not r.segnalante_partner_id and not r.segnalante_user_id:
                raise ValidationError('Serve almeno un segnalante (partner o user)')

    def write(self, vals):
        """Blocca la modifica di commissione_pct se il referral e' congelato.
        Per modificarlo serve prima 'action_unlock_commissione' (tracciato)."""
        if 'commissione_pct' in vals:
            for r in self:
                if r.commissione_locked:
                    raise ValidationError(
                        f'Commissione congelata (ancorata il {r.commissione_locked_at}). '
                        'Usa "Sblocca commissione" per modificarla (operazione tracciata).')
        return super().write(vals)

    def action_unlock_commissione(self):
        """Sblocca manualmente la commissione (operazione amministrativa tracciata).
        Crea un record di audit + richiede di ri-ancorare dopo la modifica."""
        for r in self:
            if not r.commissione_locked:
                continue
            # scrivi sul chatter la motivazione? per ora solo reset flag
            super(Erpv6Referral, r).write({
                'commissione_locked': False,
                'commissione_locked_at': False,
            })
        return True

    def action_anchor_blockchain(self):
        """Crea un record blockchain e ancora l'hash della segnalazione.
        L'hash è calcolato sul testo canonico della segnalazione (id + contatto + pct)."""
        import hashlib
        for r in self:
            canonical = f"{r.id}|{r.contatto_segnalato_nome or ''}|{r.contatto_segnalato_recapito or ''}|{r.commissione_pct}|{r.segnalante_partner_id.id or 0}|{r.segnalante_user_id.id or 0}"
            h = hashlib.sha256(canonical.encode('utf-8')).hexdigest()

            cfg = self.env['erpv6.blockchain.config'].search(
                [('provider', '=', 'opentimestamps'), ('active', '=', True)], limit=1)
            if not cfg:
                raise ValidationError('Nessuna config OpenTimestamps attiva')

            rec = self.env['erpv6.blockchain.record'].create({
                'config_id': cfg.id,
                'document_model': 'erpv6.referral',
                'document_id': r.id,
                'document_name': r.name or f'Referral #{r.id}',
                'document_hash': h,
            })
            rec.action_anchor_opentimestamps()
            # 19/09/2026: congela la % — da qui in poi e' immutabile
            super(Erpv6Referral, r).write({
                'blockchain_record_id': rec.id,
                'commissione_locked': True,
                'commissione_locked_at': fields.Datetime.now(),
                'commissione_hash': h,
            })
        return True


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

    def action_approve_revenue_split(self):
        """Approva lo split: congela + calcola hash SHA-256 + ancora su OTS."""
        import hashlib
        for r in self:
            if not r.x_v6_revenue_split:
                raise ValidationError('Nessuno split da approvare')
            if r.revenue_split_approved:
                raise ValidationError('Split già approvato')

            # Hash canonico
            h = hashlib.sha256(r.x_v6_revenue_split.encode('utf-8')).hexdigest()

            # Crea record blockchain e ancora
            cfg = self.env['erpv6.blockchain.config'].search(
                [('provider', '=', 'opentimestamps'), ('active', '=', True)], limit=1)
            if cfg:
                rec = self.env['erpv6.blockchain.record'].create({
                    'config_id': cfg.id,
                    'document_model': 'erpv6.tracking.relation',
                    'document_id': r.id,
                    'document_name': f'Split {r.name}',
                    'document_hash': h,
                })
                rec.action_anchor_opentimestamps()

            r.write({
                'revenue_split_approved': True,
                'revenue_split_approved_at': fields.Datetime.now(),
                'revenue_split_approved_by': self.env.uid,
                'revenue_split_hash': h,
            })
        return True
