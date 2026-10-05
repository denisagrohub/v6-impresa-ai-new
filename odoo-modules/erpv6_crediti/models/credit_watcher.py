# pylint: disable=import-error
"""Watcher email -> portfolio automatico (C-crediti-1b).

05/10/2026: cron ogni 15 min. Cerca PDF su email legate al
progetto 89 (matched_alias='acquisizione-certificati' OR
relation_id=89), parsa con credit.parser, crea portfolio.

Catena di collegamento (R.2 C-crediti-1b):
  ir.attachment.res_model = 'mail.message'
  ir.attachment.res_id    = <mail.message.id>
  mail.message.model      = 'erpv6.winwin.email.log'
  mail.message.res_id     = <winwin.email.log.id>
  winwin.email.log.matched_alias = 'acquisizione-certificati'
"""
import logging
from datetime import timedelta

from odoo import api, fields, models

_logger = logging.getLogger(__name__)


class Erpv6CreditPortfolioWatcher(models.Model):
    _inherit = 'erpv6.credit.portfolio'

    @api.model
    def _get_project_89_alias(self):
        rel = self.env['erpv6.tracking.relation'].sudo().browse(89)
        return rel.email_alias or ''

    @api.model
    def _attachments_from_alias_89(self, alias):
        """Ritorna ir.attachment id candidati:
        PDF non processati, legati a email con matched_alias=alias
        oppure a email.log con relation_id=89.

        05/10/2026: catena reale osservata sui cassetti AdE:
          ir.attachment.res_model = 'erpv6.winwin.email.log'
          ir.attachment.res_id    = <email.log.id>
        (NON passa da mail.message). Gestisco anche il caso
        alternativo 'mail.message' via M2M, per robustezza.
        """
        Att = self.env['ir.attachment'].sudo()
        cutoff = fields.Datetime.now() - timedelta(days=30)
        candidates = Att.search([
            ('mimetype', '=', 'application/pdf'),
            ('is_credit_processed', '=', False),
            ('res_model', 'in',
             ['mail.message', 'erpv6.winwin.email.log']),
            ('create_date', '>=', cutoff),
        ])
        if not candidates:
            return Att

        # Email.log rilevanti: matched_alias=alias OR relation_id=89
        Log = self.env['erpv6.winwin.email.log'].sudo()
        if not alias:
            logs = Log.search([('relation_id', '=', 89)])
        else:
            logs = Log.search([
                '|',
                ('matched_alias', '=', alias),
                ('relation_id', '=', 89),
            ])
        if not logs:
            return Att

        log_ids = set(logs.ids)
        msg_ids = set(logs.mapped('message_ids').ids)

        def _match(a):
            if a.res_model == 'erpv6.winwin.email.log':
                return a.res_id in log_ids
            if a.res_model == 'mail.message':
                return a.res_id in msg_ids
            return False

        return candidates.filtered(_match)

    @api.model
    def _cron_watcher_credit_emails(self):
        """Cerca nuove email su alias 89, parsa PDF allegati,
        crea portfolio. Idempotente via is_credit_processed."""
        alias = self._get_project_89_alias()
        _logger.info('Credit watcher: alias=%r', alias)

        atts = self._attachments_from_alias_89(alias)
        if not atts:
            _logger.info('Credit watcher: 0 nuovi attachment')
            return 0

        parser = self.env['erpv6.credit.parser']
        created = []
        mandatario = self.env.user.partner_id

        for att in atts:
            try:
                result = parser.parse_attachment(att.id)
                if not result or 'error' in result:
                    _logger.info(
                        'Credit watcher: skip att %d (%s)',
                        att.id, (result or {}).get('error', 'no result'))
                    att.is_credit_processed = True
                    continue

                cedente = self._match_cedente(result.get('cedente_nome'))
                nome = result.get('cedente_nome') or att.name or 'Senza nome'
                data = result.get('data_estratto') or ''
                portfolio_name = nome if not data else '%s — %s' % (nome, data)

                msg = None
                if att.res_model == 'mail.message' and att.res_id:
                    msg = self.env['mail.message'].sudo().browse(att.res_id)

                vals = {
                    'name': portfolio_name[:200],
                    'cedente_id': cedente.id if cedente else False,
                    'mandatario_id': mandatario.id,
                    'relation_id': 89,
                    'source_attachment_id': att.id,
                    'source_email_id': msg.id if msg else False,
                    'file_pdf': att.datas,
                    'file_pdf_name': att.name,
                    'utenza_lavoro': result.get('utenza'),
                    'cf_commercialista': result.get('cf_commercialista'),
                    'state': 'parsed' if cedente else 'draft',
                    'line_ids': [(0, 0, {
                        'codice': l['codice'],
                        'descrizione': l.get('descrizione'),
                        'tipologia': l.get('tipologia') or 'altro',
                        'anno': l['anno'],
                        'importo': l['importo'],
                        'categoria_cedibilita': l.get('categoria_cedibilita'),
                    }) for l in result.get('linee', [])],
                }
                p = self.create(vals)
                att.is_credit_processed = True
                created.append(p)
                _logger.info(
                    'Credit watcher: creato portfolio %d per att %d',
                    p.id, att.id)
            except Exception as e:
                _logger.warning(
                    'Credit watcher: parse fail att %d: %s', att.id, e)
                att.is_credit_processed = True
                continue

        if created:
            self._notify_credit_watcher(created)

        _logger.info('Credit watcher: %d portfolio creati', len(created))
        return len(created)

    @api.model
    def _notify_credit_watcher(self, portfolios):
        """Notifica Telegram a Denis (chat_id 97483233)."""
        try:
            config = self.env['erpv6.agent.telegram.config'].sudo().search(
                [('is_active', '=', True)], limit=1)
            if not config:
                _logger.info('Credit watcher: nessuna config Telegram')
                return
            n = len(portfolios)
            lines = ['\U0001F4C1 %d nuovo/i cassetto/i crediti' % n]
            for p in portfolios[:5]:
                tot = p.total_amount or 0.0
                ced = p.cedente_id.name if p.cedente_id else '(draft)'
                lines.append('- %s: %d righe, EUR %.2f' % (
                    ced, p.total_lines, tot))
            config.send_message(
                text='\n'.join(lines),
                chat_id_override='97483233')
        except Exception as e:
            _logger.warning('Credit watcher: Telegram fail: %s', e)
