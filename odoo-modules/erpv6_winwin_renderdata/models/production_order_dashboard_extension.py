from odoo import api, models


class Erpv6ProductionOrder(models.Model):
    """Estende erpv6.production.order con i dati per la vista 'I miei
    progetti' della dashboard OWL del consulente (06/09/2026, prompt
    'Trigger progetto + Dashboard consulente + Email per-progetto').

    Filtro esplicito su lead_id.user_id = utente corrente invece di un
    ir.rule nuovo (Fase 0/2 del prompt: verificare se serve un ir.rule
    esplicito) - erpv6.production.order e' letto qui con sudo() perche' il
    dominio stesso (lead_id.user_id = self.env.user.id, valore lato
    server mai manipolabile dal chiamante) e' gia' il filtro di sicurezza:
    un ir.rule aggiuntivo applicherebbe la STESSA condizione due volte
    senza cambiare cosa e' visibile."""
    _inherit = 'erpv6.production.order'

    @api.model
    def get_miei_progetti(self):
        orders = self.sudo().search([('lead_id.user_id', '=', self.env.user.id)], order='id desc')
        Relation = self.env['erpv6.tracking.relation'].sudo()
        Token = self.env['erpv6.winwin.report.token'].sudo()
        EmailLog = self.env['erpv6.winwin.email.log'].sudo()
        result = []
        for order in orders:
            root = Relation.search(
                [('production_order_id', '=', order.id), ('parent_id', '=', False)], limit=1)
            report_token = Token.search([('production_order_id', '=', order.id)], order='id desc', limit=1)
            emails = []
            if root:
                logs = EmailLog.search([('relation_id', '=', root.id)], order='create_date desc', limit=20)
                emails = [{
                    'id': l.id,
                    'sender_email': l.sender_email or '',
                    'name': l.name or '',
                    'create_date': l.create_date.isoformat() if l.create_date else False,
                } for l in logs]
            rd = order.winwin_render_data_final or {}
            result.append({
                'unread_count': root.get_unread_notification_count() if root else 0,
                'relation_root_id': root.id if root else False,
                'id': order.id,
                'azienda': order.lead_id.name or '',
                'tipo_progetto': order.interview_tipo_progetto or '',
                'bant': {
                    'budget': order.interview_budget or '',
                    'tempistiche': order.interview_tempistiche or '',
                    'tipo_progetto': order.interview_tipo_progetto or '',
                    'destinatario': order.interview_destinatario or '',
                    'fatturato': order.interview_fatturato or '',
                },
                'quadrante': (rd.get('etichetta_azienda') or '').replace('_', ' '),
                'impatto': rd.get('impatto'),
                'prontezza': rd.get('prontezza'),
                'criticita': rd.get('criticita') or [],
                'azioni_urgenti': rd.get('azioni_urgenti') or [],
                'has_report': bool(rd),
                'report_token': report_token.token if report_token else False,
                'report_stato': report_token.stato if report_token else False,
                'email_alias': ('%s@v6impresa.it' % root.email_alias) if (root and root.email_alias) else False,
                'emails': emails,
                'disc_status': 'non_ancora_raccolto',
            })
        return result
