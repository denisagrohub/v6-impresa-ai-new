# erpv6_blockchain — Analisi modulo

Analisi generata il 2026-08-15 leggendo il codice sorgente reale del modulo.

## Modelli esposti

| Modello | Campi principali | Note |
|---|---|---|
| `erpv6.blockchain.config` | `name`, `network` (Selection: polygon/mumbai/ethereum/sepolia), `rpc_url`, `private_key` (cifrata automaticamente in create/write via `erpv6.crypto.engine`), `contract_address`, `gas_limit`, `active` | Logica reale di cifratura/decifratura chiave privata |
| `erpv6.blockchain.record` | `config_id`, `document_model`, `document_id`, `document_hash`, `lot_number`, `tx_hash`, `block_number`, `gas_used`, `gas_cost_eth`, `status` (pending/confirmed/failed), `error_message` | Vedi sotto: la certificazione reale su blockchain **non è implementata**, è simulata |

## Metodi pubblici pensati per essere chiamati da altri moduli

- **`get_decrypted_private_key()`** su `erpv6.blockchain.config`: decifra la chiave per uso interno (firma transazioni).
- **`action_certify()`** su `erpv6.blockchain.record`: **è il metodo core del modulo, ed è chiamato realmente da `erpv6_library/models/library_document.py`** (`action_certify_blockchain()` crea un `erpv6.blockchain.record` e chiama `.action_certify()` su di esso quando un documento è marcato `is_final_client_facing`) — quindi è un consumer esterno reale e verificato, non teorico.
- Nessun altro modulo referenzia questo modulo.

## Punti di estensione noti

- `document_model`/`document_id` è un pattern generico (link a qualsiasi record Odoo) — coerente con il principio di riusabilità trasversale.
- Non ci sono violazioni dei principi Kaizen/Bandi/Validation del CLAUDE.md — questo modulo non ha alcun rapporto con quell'area (certificazione documentale, dominio diverso).

## Stato reale (verificato il 2026-08-15)

- Verificato con query reale (aggregata) sul DB `erpv6` sul VPS: `state=installed`, `latest_version=18.0.2.0.0`. Coincide con la versione nel manifest locale — nessun drift.
- Dipendenza esterna Python dichiarata: `web3` (in `external_dependencies`).
- Nessuna cartella `tests/`.

### Debiti noti / TODO

- **Finding critico, verificato leggendo il codice**: `action_certify()` in `blockchain_record.py` **non esegue mai una transazione blockchain reale**. Dopo aver verificato la connessione RPC e caricato l'account dalla chiave privata, il codice scrive direttamente `tx_hash = '0x' + '0'*64` (commento nel codice: `# Placeholder`) e imposta `status = 'confirmed'`, con un commento esplicito `# Simulazione transazione (in produzione: chiama smart contract)`. Nessuna chiamata reale allo smart contract avviene. Dato che questo metodo è realmente invocato da `erpv6_library` per certificare documenti "client facing", **ogni documento certificato tramite questo flusso riceve un tx_hash fittizio identico (tutti zeri) e uno stato "Confermato" che non riflette nessuna transazione reale sulla blockchain.**
- **Bug reale, verificato**: il controller pubblico `GET /api/blockchain/verify/<tx_hash>` (`auth='public'`, quindi accessibile senza autenticazione) referenzia `record.timestamp` e `record.verification_url` — **nessuno dei due campi esiste** sul modello `erpv6.blockchain.record` (i campi reali sono `create_date`, non `timestamp`; non esiste alcun campo `verification_url`). Questa rotta genera un errore ogni volta che trova un record valido da restituire.
- **Bug reale, verificato — file di viste orfani**: la cartella `views/` contiene 4 file XML (`blockchain_config_views.xml`, `blockchain_record_views.xml`, `blockchain_views.xml`, `erpv6_blockchain_views.xml`), ma il manifest carica **solo** `views/blockchain_views.xml`. Di conseguenza: non esiste nessuna vista/form per `erpv6.blockchain.config` raggiungibile da UI (va creato via shell o accesso diretto al DB), e non esiste nessun `menuitem` caricato — l'azione `action_blockchain_record` esiste ma non è raggiungibile da nessun menu.
- **File dati orfano**: `data/default_config.xml` esiste nella cartella `data/` ma non è incluso nel manifest — non viene mai caricato, qualunque configurazione di default che dovesse contenere non viene applicata.
- Nessun test automatico.
