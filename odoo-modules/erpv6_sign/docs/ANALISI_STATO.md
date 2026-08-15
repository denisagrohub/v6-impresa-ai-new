# erpv6_sign — Analisi modulo

Analisi generata il 2026-08-15, basata su lettura completa del codice sorgente.

## Modelli esposti

| Modello | Campi principali | Stato |
|---|---|---|
| `erpv6.sign.config` | `name`, `opensign_url` (default `http://localhost:3000`), `api_key`, `active` | Configurazione, singolo record atteso (cercato con `search([('active','=',True)], limit=1)`) |
| `erpv6.sign.request` | `name`, `contract_id` (Many2one `erpv6.contract`), `document_id` (Many2one `erpv6.typst.document`), `partner_id` (firmatario, required), `status` (Selection: draft/sent/viewed/signed/expired/declined), `external_id`, `request_url`, `sent_at`/`viewed_at`/`signed_at`, `signature_hash`, `signed_document` (Binary) | Logica di business reale: integrazione con servizio esterno OpenSign |
| `erpv6.sign.log` | `request_id`, `action`, `details`, `create_date` | Log di audit, sola lettura per utenti normali |
| `erpv6.sign.install.wizard` (TransientModel) | `state`, `log` | Wizard "installazione OpenSign" — **vedi debiti, è un placeholder che non installa nulla** |

## Metodi pubblici pensati per essere chiamati da altri moduli

- `erpv6.sign.request.action_send_to_sign()`: invia il documento a OpenSign via HTTP POST, aggiorna stato e crea log. Richiamabile da bottone UI.
- `erpv6.sign.request.action_check_status()`: polling dello stato su OpenSign, scarica il documento firmato quando pronto. Richiamabile da bottone UI o da cron (nessun cron trovato nel modulo, quindi oggi è solo manuale/UI).
- `OpenSignController./api/opensign/callback` (`type='json', auth='public'`): endpoint pubblico per ricevere callback da OpenSign e aggiornare lo stato della richiesta — punto di integrazione webhook reale.
- `install_opensign_wizard.action_install()`: **non fa nulla di reale** (vedi Debiti).
- Nessun altro modulo del repository chiama direttamente questi metodi (verificato con grep) — l'unico consumer previsto è l'interazione umana via UI o il webhook OpenSign stesso.

## Punti di estensione noti

- Dipendenze dichiarate coerenti con l'architettura: `erpv6_core`, `erpv6_contract`, `erpv6_typst` — il modulo si aggancia a documenti generati da `erpv6_typst` (`document_id`) e a contratti (`contract_id`), rispettando la separazione di responsabilità.
- `erpv6.sign.config.opensign_url` di default punta a `http://localhost:3000` — valore di sviluppo lasciato come default in produzione; va verificato che sia sempre sovrascritto da una config reale.
- Non pertinente ai principi Kaizen/Opportunity/Bandi/Validation del CLAUDE.md.

## Stato reale (verificato il 2026-08-15)

- Installato sul DB `erpv6` del VPS: `state=installed`, `latest_version: 18.0.1.0.0` — coincide con `version` nel `__manifest__.py` locale. Nessun drift.
- `document_id.file_content` (Binary su `erpv6.typst.document`) viene letto in `action_send_to_sign()` con `base64.b64decode(...).decode('latin-1')` per inserirlo in un payload JSON — pattern fragile per contenuto binario (un PDF), la decodifica `latin-1` di byte binari arbitrari può produrre dati corrotti o characters non validi lato ricevente; il modo standard sarebbe inviare la stringa base64 così com'è, senza decodificarla a testo. Non verificabile a runtime senza eseguire il modulo, ma il pattern è a rischio.
- Nessuna cartella `tests/`.

### Debiti noti / TODO

- **`InstallOpenSignWizard.action_install()` è un placeholder**: si limita a loggare `'Installazione OpenSign avviata'`, cambiare `state` a `done` e mostrare una notifica di successo — non esegue nessuna installazione reale (nessuna chiamata Docker/API/subprocess). Il nome e la UI del wizard promettono un'azione che il codice non compie.
- Pattern di codifica binaria fragile in `action_send_to_sign()` (vedi sopra) — potenziale causa di documenti corrotti inviati a OpenSign.
- Nessun test automatico.
- Nessun meccanismo di retry/backoff sulle chiamate HTTP a OpenSign (`requests.post`/`.get` con solo `timeout`, eccezioni catturate genericamente e trasformate in `UserError`).
