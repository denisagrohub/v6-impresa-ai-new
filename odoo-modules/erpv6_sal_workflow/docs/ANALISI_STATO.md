# erpv6_sal_workflow — Analisi modulo

Analisi generata il 2026-08-15, basata su lettura completa del codice sorgente.

## Modelli esposti

| Modello | Campi principali | Stato |
|---|---|---|
| `pi.sal.workflow` | `project_id` (Many2one `project.project`), `sal_number`, `description`, `amount` (Monetary), `status` (Selection: draft/submitted/approved/invoiced/paid/rejected), `approved_by_client`, `approval_date`, `approval_notes`, `invoice_id` (Many2one `account.move`), `payment_id`, `payment_date`, `blockchain_hash`, `blockchain_tx_id`, `blockchain_verified` | Ha logica di business reale (workflow completo con integrazione fatturazione e blockchain), ma **nome tecnico incoerente**: il modello si chiama `pi.sal.workflow`, non `erpv6.sal.workflow` come ci si aspetterebbe dal nome del modulo. Sembra codice riadattato da un altro progetto (`pi_sal_workflow`) senza completare la migrazione dei nomi. |

## Metodi pubblici pensati per essere chiamati da altri moduli

- `action_submit_to_client()`, `action_approve_by_client()`, `action_reject_by_client(reason)`, `action_create_invoice()`, `action_mark_paid()`: metodi pubblici reali sul modello, pensati per pulsanti UI o chiamate da frontend/portale cliente.
- **Nessuna view esiste per esporli**: `views/erpv6_sal_workflow_views.xml` contiene solo un placeholder (`<!-- Placeholder per erpv6_sal_workflow_views -->`), nessun `<record>` di tipo `ir.ui.view` o `ir.actions.act_window`. Questi metodi non sono raggiungibili da nessuna UI Odoo standard oggi.
- Nessun altro modulo del repository referenzia `pi.sal.workflow` o `erpv6_sal_workflow` (verificato con grep incrociato su `odoo-modules/`) — modulo completamente isolato, non consumato da nessuno.

## Punti di estensione noti

- Non ci sono pattern di estensione generici (nessun `res_model`/`res_id`, nessun campo libero per verticali): il modulo è specifico e verticale per sua natura (workflow SAL - Stato Avanzamento Lavori - per Business Plan), coerente con l'essere fuori da `erpv6_methodology`/`erpv6_kb`.
- Integrazione con blockchain via chiamata HTTP POST a `{web.base.url}/api/blockchain/register` (endpoint Next.js) — punto di aggancio verso il frontend, ma senza retry/verifica robusta (fallimento silenzioso, solo loggato in `ir.logging`).
- Non pertinente ai principi motore/conoscenza o all'orchestrazione Kaizen/Opportunity/Bandi del CLAUDE.md — questo modulo non tocca quell'area.

## Stato reale (verificato il 2026-08-15)

- Installato sul DB `erpv6` del VPS: `state=installed`.
- **Drift di versione repo/VPS**: il `__manifest__.py` locale dichiara `'version': '1.0.0'` — formato non standard per un modulo Odoo 18 (dovrebbe essere `18.0.x.y.z` come tutti gli altri moduli erpv6_*), mentre il database sul VPS mostra `latest_version: 18.0.1.0.0` per questo modulo. Questo significa che Odoo ha registrato una versione diversa da quella dichiarata nel file attualmente nel repo — o il file è stato modificato dopo l'ultima installazione/aggiornamento sul VPS, o la versione è stata normalizzata da Odoo stesso. Da verificare con un aggiornamento esplicito se si vuole allineare.
- **Bug reale verificato nel codice**: `action_submit_to_client()` chiama `self.env.ref('pi_sal_workflow.sal_submission_email')` — questo XML ID appartiene a un modulo `pi_sal_workflow` che **non esiste da nessuna parte nel repository** (grep su tutto `odoo-modules/` non trova nulla). `env.ref()` senza `raise_if_not_found=False` solleva un'eccezione se l'XML ID non esiste: questo metodo, se mai chiamato, andrà in errore.
- `security/ir.model.access.csv` contiene **solo l'intestazione, nessuna riga di regola di accesso**: il modello `pi.sal.workflow` non ha alcuna regola ACL definita. In Odoo questo significa che nessun utente non-superuser può leggere/scrivere/creare record di questo modello attraverso l'ORM standard (fallirà con `AccessError`), salvo operazioni via `sudo()`.
- Nessun controller/API espone questo modulo — non raggiungibile da `erpv6_api_gateway` né da altri moduli.

### Debiti noti / TODO

- Nessuna vista reale (solo placeholder XML) — il modulo non ha interfaccia utente funzionante nonostante la logica di business sia implementata.
- Nessuna regola di accesso (`ir.model.access.csv` vuoto) — modello inaccessibile ai normali utenti.
- Riferimento a XML ID di un modulo esterno inesistente (`pi_sal_workflow.sal_submission_email`) — crash garantito se `action_submit_to_client()` viene invocato.
- Nome tecnico del modello (`pi.sal.workflow`) incoerente con il nome del modulo e con la convenzione `erpv6.*` usata ovunque nel resto del progetto.
- Nessun test automatico.
- Modulo completamente isolato: non referenziato da nessun altro modulo né esposto via API — probabilmente inutilizzato in pratica nonostante sia "installed" sul VPS.
