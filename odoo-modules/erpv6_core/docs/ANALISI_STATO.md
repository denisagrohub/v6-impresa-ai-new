# erpv6_core — Analisi modulo

Analisi generata il 2026-08-15, basata su lettura del codice sorgente reale.

## Modelli esposti

| Modello | Campi principali | Note |
|---|---|---|
| `erpv6.base` | `name` (required), `active` | Modello concreto minimale. **Unico modello di questo file effettivamente ereditato altrove** (da `erpv6_api_gateway/models/api_gateway.py`, `_inherit = 'erpv6.base'`) |
| `erpv6.abstract.model` | `name`, `active`, `description`; override vuoti di `create`/`write` (chiamano solo `super()`, nessuna logica aggiuntiva) | **AbstractModel non ereditato da nessun altro modulo** (grep su tutto il repo: zero occorrenze di `_inherit` verso `erpv6.abstract.model`) — codice morto allo stato attuale |
| `erpv6.version.mixin` (in `models/mixin.py`) | `version` (Integer), `change_notes`, `author_id`, `version_history`; metodo `_increment_version(notes)` | AbstractModel mixin per versionamento. Ereditato da `erpv6.kb` in `erpv6_kb` (unico consumer trovato) |
| `erpv6.core.tracked` (in `models/tracked_mixin.py`) | `active`; eredita `mail.thread` | AbstractModel mixin di tracciabilità. Ereditato da 3 modelli in `erpv6_bandi` (`bando`, `bando_match`, `bando_application`) |

Nota sui nomi file vs nomi tecnici: il file `mixin.py` contiene il modello `erpv6.version.mixin` (non un modello chiamato genericamente "mixin"), e `tracked_mixin.py` contiene `erpv6.core.tracked`. I nomi file non corrispondono 1:1 ai nomi tecnici dei modelli — utile saperlo per non cercare `erpv6.mixin` come nome modello.

## Metodi pubblici pensati per essere chiamati da altri moduli

- `erpv6.version.mixin._increment_version(notes=None)` — pensato per essere richiamato da modelli che ereditano il mixin. Effettivamente usato: `erpv6_kb/models/kb_knowledge.py` lo chiama internamente (`rec._increment_version(...)`) nel proprio `write()`, quando il contenuto cambia.
- Nessun altro metodo pubblico rilevante: `erpv6.base` e `erpv6.abstract.model` hanno solo `create`/`write` che chiamano `super()` senza aggiungere comportamento — non sono veri "motori", sono scheletri.
- Il modulo non espone metodi di orchestrazione o business logic: è puramente infrastrutturale (base class + mixin).

## Punti di estensione noti

- Questo è il modulo base dichiarato come dipendenza da **24 altri moduli** (tutti gli `erpv6_*` tranne pochissime eccezioni) — è il vero "motore a-settoriale" fondante del progetto, coerente col principio CLAUDE.md di riusabilità trasversale.
- `erpv6.core.tracked` è il pattern di estensione corretto per aggiungere tracciabilità (chatter + campo `active`) senza duplicare codice — usato da `erpv6_bandi`, ma **non da `erpv6_methodology`, `erpv6_kb` o altri modelli "motore"** che invece implementano `active`/tracking ad-hoc: incoerenza nell'adozione del mixin, non un problema del modulo core in sé.
- `erpv6.abstract.model` sembra un tentativo di fornire una base AbstractModel più ricca di `erpv6.base` (con `description` e override di `create`/`write` pronti per essere estesi), ma non è mai stato adottato — è un punto di estensione dichiarato ma inutilizzato.
- Coerente col principio motore/conoscenza: il modulo non contiene nulla di specifico per verticale o settore, è puro scaffolding trasversale.

## Stato reale (verificato il 2026-08-15)

- Verificato con query reale sul DB `erpv6` del VPS: `erpv6_core` risulta `state=installed`, `latest_version=18.0.1.0.0`.
- Il `version` nel `__manifest__.py` locale (`18.0.1.0.0`) coincide con la versione installata: nessun drift rilevato.
- Uso reale confermato: 24 moduli lo dichiarano in `depends` (elenco completo via grep: erpv6_methodology, erpv6_parent_client, erpv6_validation, erpv6_omni_bridge, erpv6_accounting, erpv6_bandi, erpv6_tracking, erpv6_api_gateway, erpv6_sign, erpv6_marketing, erpv6_blockchain, erpv6_color, erpv6_consulting, erpv6_booking, erpv6_sal_workflow, erpv6_setup_wizard, erpv6_kb, erpv6_library, erpv6_brand, erpv6_package, erpv6_crypto, erpv6_saas, erpv6_deep_source, erpv6_integrity, erpv6_contract) — di fatto è il modulo più centrale del progetto.
- Solo `erpv6.base` e i due mixin (`version.mixin`, `core.tracked`) hanno consumer reali verificati con grep; `erpv6.abstract.model` risulta senza consumer.
- Nessuna cartella `tests/`.

### Debiti noti / TODO

- `erpv6.abstract.model` è codice morto (nessun `_inherit` lo referenzia in tutto il repo) — da rimuovere o da chiarire il suo scopo futuro.
- Coesistenza di 3 pattern diversi per "modello base V6" (`erpv6.base`, `erpv6.abstract.model`, `erpv6.core.tracked`) senza una linea guida esplicita su quando usare quale — rischio di frammentazione futura se nuovi moduli scelgono pattern diversi ad-hoc.
- Nessun test automatico su un modulo da cui dipendono 24 altri moduli — la superficie di rischio in caso di regressione è ampia.
