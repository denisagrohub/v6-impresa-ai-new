from odoo import api, fields, models


class SignConfig(models.Model):
    _name = 'erpv6.sign.config'
    _description = 'Configurazione Firma Elettronica (Documenso)'

    name = fields.Char(string='Nome', default='Configurazione Documenso')
    documenso_url = fields.Char(
        string='URL Documenso',
        default='http://documenso:3000',
        help="Base URL usata da Odoo per le chiamate API server-to-server verso "
             "Documenso, senza il suffisso /api/v2. Di proposito è l'indirizzo "
             "interno della rete Docker (http://documenso:3000, stesso network "
             "erpv6_default) e NON l'URL pubblico https://firma.v6sviluppoimpresa.it: "
             "verificato che il container odoo non riesce a raggiungere l'IP "
             "pubblico del proprio host (hairpin NAT non abilitato - stesso "
             "problema, non specifico di Documenso, riproducibile anche verso "
             "erp.v6sviluppoimpresa.it). Gli URL di firma mostrati ai firmatari "
             "restano invece pubblici: sono generati da Documenso stesso "
             "(NEXT_PUBLIC_WEBAPP_URL) e restituiti già pronti in 'request_url', "
             "non ricostruiti da questo URL.",
    )
    api_key = fields.Char(
        string='API Key',
        help="Chiave dell'API pubblica Documenso v2 (header 'Authorization: api_xxx'). "
             "Generata da Documenso in Settings > API Tokens, oppure via tRPC "
             "apiToken.create se non si ha accesso alla UI. Usata per TUTTE le chiamate "
             "in uscita verso Documenso (creazione/invio/lettura envelope).",
    )
    webhook_secret = fields.Char(
        string='Webhook Secret',
        help="Segreto condiviso indipendente dalla API Key: Documenso lo invia "
             "nell'header 'X-Documenso-Secret' di ogni chiamata webhook in ingresso "
             "verso Odoo (es. evento DOCUMENT_COMPLETED). Il controller webhook lo "
             "confronta per autenticare Documenso verso di noi (l'API Key autentica "
             "noi verso Documenso: sono due segreti a senso opposto, non intercambiabili). "
             "Il webhook con questo secret va registrato manualmente via tRPC autenticato "
             "(/api/trpc/webhook.createWebhook con cookie di sessione + header x-team-id) "
             "perché la gestione webhook non è esposta sull'API pubblica /api/v2 con API Key. "
             "IMPORTANTE: registrare il webhook con l'URL INTERNO Docker "
             "(http://odoo:8069/api/documenso/webhook), NON con l'URL pubblico "
             "(https://erp.v6sviluppoimpresa.it/...) -- stesso problema di hairpin NAT "
             "documentato sopra per documenso_url, ma nella direzione opposta (il "
             "container documenso non riesce a raggiungere l'IP pubblico del proprio "
             "host per consegnare la chiamata webhook: verificato dal vivo il "
             "18/08/2026, consegne fallite con 'status 0' finché l'URL non è stato "
             "corretto in quello interno).",
    )
    active = fields.Boolean(string='Attivo', default=True)

    def _api_base(self):
        """URL base dell'API pubblica v2 di Documenso (es. https://host/api/v2)."""
        self.ensure_one()
        return (self.documenso_url or '').rstrip('/') + '/api/v2'

    def _api_headers(self):
        self.ensure_one()
        return {'Authorization': self.api_key or ''}
