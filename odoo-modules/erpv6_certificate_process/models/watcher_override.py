# pylint: disable=import-error
"""Override watcher crediti: itera su processi attivi.

05/10/2026 (C-processi-1): sostituisce _cron_watcher_credit_emails
hardcoded su progetto 89 con un loop sui processi
erpv6.certificate.process (is_active=True).

Idempotenza: resta basata su ir.attachment.is_credit_processed
(introdotta in C-crediti-1b).
"""
import logging
from datetime import timedelta

from odoo import api, fields, models

_logger = logging.getLogger(__name__)


# Mappa process_code -> certificate_type su erpv6.credit.portfolio
# (selection piu' ristretta di process_code).
PROCESS_TO_CERT_TYPE = {
    'credit_tax_ade': 'credit_tax',
    'tee_gme': 'tee',
    'go_gme': 'tee',  # fallback: GO condivide struttura TEE
}


class Erpv6CreditPortfolioWatcherOverride(models.Model):
    _inherit = 'erpv6.credit.portfolio'

    @api.model
    def _cron_watcher_credit_emails(self):
        """Watcher generico: itera su processi attivi.

        Sostituisce la versione hardcoded su progetto 89 (C-crediti-1b).
        """
        Process = self.env['erpv6.certificate.process'].sudo()
        processes = Process.search([('is_active', '=', True)])
        if not processes:
            _logger.info('Watcher: 0 processi attivi')
            return 0

        _logger.info(
            'Watcher: %d processi attivi da processare', len(processes))

        created_total = []
        for process in processes:
            try:
                created = self._process_watcher_for(process)
                created_total.extend(created)
            except Exception as e:
                _logger.warning(
                    'Watcher: processo %s fallito: %s', process.name, e)

        if created_total:
            self._notify_credit_watcher(created_total)

        _logger.info(
            'Watcher: %d portfolio totali creati', len(created_total))
        return len(created_total)

    @api.model
    def _process_watcher_for(self, process):
        """Esegue watcher per un singolo processo."""
        alias = process.alias_in or (
            process.relation_id.email_alias or '')
        if not alias:
            _logger.info(
                'Watcher: processo %s senza alias, skip', process.name)
            return []

        atts = self._attachments_for_process(process, alias)
        if not atts:
            return []

        parser = self._get_parser(process.parser_key)
        mandatario = self.env.user.partner_id
        created = []

        for att in atts:
            try:
                result = parser.parse_attachment(att.id)
                if not result or 'error' in result:
                    _logger.info(
                        'Watcher: skip att %d (%s)',
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

                cert_type = PROCESS_TO_CERT_TYPE.get(
                    process.process_code, 'credit_tax')

                p = self.create({
                    'name': portfolio_name[:200],
                    'cedente_id': cedente.id if cedente else False,
                    'mandatario_id': mandatario.id,
                    'relation_id': process.relation_id.id,
                    'certificate_type': cert_type,
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
                })
                att.is_credit_processed = True
                created.append(p)
                # 05/10/2026: crea evento timeline sul progetto
                email_subj = None
                email_from = None
                if msg:
                    email_subj = msg.subject
                    email_from = msg.email_from
                self._create_timeline_event(
                    process, p, att,
                    email_subject=email_subj, email_from=email_from)
                _logger.info(
                    'Watcher: creato portfolio %d + evento timeline (processo %s)',
                    p.id, process.process_code)
            except Exception as e:
                _logger.warning(
                    'Watcher: parse fail att %d: %s', att.id, e)
                att.is_credit_processed = True
                continue

        return created

    @api.model
    def _create_timeline_event(self, process, portfolio, attachment, email_subject=None, email_from=None):
        """Crea un erpv6.deal.event sulla timeline del progetto.

        05/10/2026: il watcher creava portfolio ma NON li rendeva
        visibili nella timeline del progetto. Questo metodo colma il
        gap: ogni cassetto ricevuto -> 1 evento documento_ricevuto.
        """
        try:
            Event = self.env['erpv6.deal.event'].sudo()
            cedente = portfolio.cedente_id.name if portfolio.cedente_id else portfolio.name
            tot = portfolio.total_amount or 0.0
            # 05/10/2026 (C-attribution-1c): se il portfolio ha un
            # portatore, lo mostro nel titolo dell'evento timeline.
            portatore = None
            if 'brought_by_partner_id' in portfolio._fields and portfolio.brought_by_partner_id:
                portatore = portfolio.brought_by_partner_id.name
            if portatore:
                title = '\U0001F4C1 Cassetto %s — portato da %s' % (
                    cedente or 'Sconosciuto', portatore)
            else:
                title = '\U0001F4C1 Cassetto ricevuto: %s' % (cedente or 'Sconosciuto')
            desc_lines = [
                '%d righe  |  EUR %s' % (
                    len(portfolio.line_ids),
                    format(tot, ',.2f').replace(',', 'X').replace('.', ',').replace('X', '.')),
                'PDF: %s' % (attachment.name or '-'),
                'Portfolio: #%d' % portfolio.id,
            ]
            if email_from:
                desc_lines.append('Da: %s' % email_from)
            if email_subject:
                desc_lines.append('Oggetto: %s' % email_subject)
            Event.create({
                'relation_id': process.relation_id.id,
                'event_type': 'documento_ricevuto',
                'title': title[:200],
                'description': '\n'.join(desc_lines),
                'event_date': fields.Datetime.now(),
                'visibility': 'consultant',
                'is_auto': True,
                'source_attachment_id': attachment.id,
                'source_url': '/admin/credit-portfolios/%d' % portfolio.id,
                'created_by_id': self.env.user.partner_id.id,
            })
        except Exception as e:
            _logger.warning(
                'Credit watcher: evento timeline fallito per portfolio %d: %s',
                portfolio.id, e)

    @api.model
    def _attachments_for_process(self, process, alias):
        """Ritorna attachment PDF non processati legati al processo.

        Catena reale (osservata C-crediti-1b):
          ir.attachment.res_model = 'erpv6.winwin.email.log'
          ir.attachment.res_id    = <email.log.id>
        Fallback: res_model='mail.message' via M2M message_ids.
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

        Log = self.env['erpv6.winwin.email.log'].sudo()
        logs = Log.search([
            '|',
            ('matched_alias', '=', alias),
            ('relation_id', '=', process.relation_id.id),
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
    def _get_parser(self, parser_key):
        """Ritorna il parser da usare in base a parser_key.

        Oggi solo 'ade_pdf' (o vuoto) -> credit.parser.
        Futuri: 'gme_pdf' -> erpv6.tee.parser.
        """
        if parser_key == 'gme_pdf':
            # fallback a credit.parser se il parser GME non esiste
            if 'erpv6.tee.parser' in self.env:
                return self.env['erpv6.tee.parser']
        return self.env['erpv6.credit.parser']
