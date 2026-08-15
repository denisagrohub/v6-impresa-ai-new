# erpv6_crypto — Analisi modulo

Analisi generata il 2026-08-15, basata su lettura del codice sorgente reale.

## Modelli esposti

| Modello | Campi principali | Note |
|---|---|---|
| `erpv6.crypto.engine` | `name`, `active` | Nessuno stato persistente reale oltre `name`/`active`: la vera logica è nei metodi `@api.model` (vedi sotto). Dipende da libreria esterna `cryptography` (dichiarata in `external_dependencies`) |
| `erpv6.crypto.key` | `version`, `key_encrypted` (Binary, cifrata con master key), `key_type` (Selection primary/secondary), `valid_from`, `valid_to`, `is_active`. Vincolo SQL: `unique(version, key_type)` | Chiavi versionate, cifrate a riposo con una master key derivata via PBKDF2HMAC da `ir.config_parameter` |
| `erpv6.crypto.audit` | `user_id`, `operation` (Selection encrypt/decrypt/rotate), `context`, `data_length`, `ip_address`, `create_date` | Log di audit, scritto automaticamente da `crypto_engine` ad ogni operazione |

## Metodi pubblici pensati per essere chiamati da altri moduli

Questo è un vero motore, con API pubbliche chiaramente pensate per essere chiamate da fuori:

- `erpv6.crypto.engine.encrypt(data, context=None, double=False)` — cifra un dato (stringa, dict o list convertiti in JSON). Supporta doppia cifratura (`double=True`, due layer Fernet con chiavi diverse).
- `erpv6.crypto.engine.decrypt(encrypted_data, context=None)` — decifra un payload JSON prodotto da `encrypt`, gestendo sia cifratura singola che doppia.
- `erpv6.crypto.engine.rotate_keys()` — ruota alternativamente chiave primaria/secondaria, richiamato anche da cron (`erpv6_crypto/data/cron_data.xml`, ogni 6 ore).
- `erpv6.crypto.key.get_active_key_pair()` e `create_new_key(key_type)` — gestione chiavi, usati internamente da `crypto_engine` ma tecnicamente pubblici.

**Consumer reali confermati via grep incrociato**: `erpv6_omni_bridge/models/omni_provider.py`, `erpv6_bandi/models/bando_source.py`, `erpv6_blockchain/models/blockchain_config.py`, `erpv6_kb/models/kb_knowledge.py`, `erpv6_deep_source/models/deep_source_config.py` — tutti chiamano `self.env['erpv6.crypto.engine'].encrypt/decrypt`. È uno dei motori più effettivamente riusati del progetto.

## Punti di estensione noti

- Motore genuinamente generico e a-settoriale: cifra qualsiasi dato (stringa/dict/list) senza alcuna conoscenza del dominio chiamante — coerente al 100% col principio motore/conoscenza del CLAUDE.md.
- Il pattern doppia cifratura è già usato selettivamente da `erpv6_kb` (`double = kb_type in ('prompt', 'metodo_v6')`) — la scelta di quando applicare `double=True` è demandata al chiamante, non hardcoded nel motore: buon disaccoppiamento.
- La master password/salt vive in `ir.config_parameter` (`crypto.master_password`, `crypto.master_salt`) — è un punto di configurazione esterno al codice, corretto per un segreto, ma significa che **se `crypto.master_password` non è impostato, `_get_master_key()` solleva `UserError`** e l'intero motore si blocca (comportamento verificato nel codice, non ipotizzato).
- Non pertinente al modulo: le regole CLAUDE.md su kaizen/opportunity/bandi/validation non toccano questo motore trasversale.

## Stato reale (verificato il 2026-08-15)

- Verificato con query reale sul DB `erpv6` del VPS: `erpv6_crypto` risulta `state=installed`, `latest_version=18.0.1.0.0`.
- Il `version` nel `__manifest__.py` locale (`18.0.1.0.0`) coincide con la versione installata: nessun drift rilevato.
- Uso reale ampio e confermato: 5 moduli diversi lo richiamano attivamente nel codice (non solo dipendenza dichiarata), più `erpv6_omni_bridge`, `erpv6_blockchain`, `erpv6_kb`, `erpv6_deep_source` lo dichiarano in `depends`.
- Cron attivo (`ir_cron_rotate_keys`, ogni 6 ore) — è uno dei pochi moduli con automazione schedulata realmente configurata, non solo teorica.
- Nessuna cartella `tests/`.

### Debiti noti / TODO

- Nessun test automatico per un motore di sicurezza critico (cifratura/decifratura/audit) — rischio significativo dato il ruolo del modulo.
- `_get_master_key()` solleva eccezione bloccante se `crypto.master_password` non è configurato: non c'è un meccanismo di fallback o di controllo preventivo a livello di installazione — un deployment che dimentica di impostare il parametro rompe silenziosamente tutti i moduli che dipendono da crypto (kb, deep_source, bandi, omni_bridge, blockchain) solo al primo utilizzo effettivo, non all'avvio.
- Nessuna esposizione via API gateway (nessun controller in `erpv6_api_gateway` referenzia `erpv6.crypto.*`) — corretto per un motore di sicurezza, ma da confermare sia intenzionale.
