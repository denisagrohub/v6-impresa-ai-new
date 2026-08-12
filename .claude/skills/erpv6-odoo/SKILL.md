---
name: erpv6-odoo
description: Regole operative per lavorare sui moduli Odoo del progetto erpv6 e sul VPS che li ospita — flusso promote_module.sh, percorsi reali del VPS, gestione password del database, e i divieti su fattorie_della_fenice e docker compose config. Usa questa skill ogni volta che modifichi un modulo in odoo-modules/, tocchi il docker-compose.yml o odoo.conf su /opt/erpv6, o esegui comandi contro un database Odoo.
---

# erpv6 — Operatività Odoo/VPS

## Regola fondamentale — Verifica, non narrazione

Non dichiarare mai un modulo "corretto", "pronto" o "funzionante" senza aver eseguito `promote_module.sh` e aver visto l'output reale. Un riassunto testuale di cosa dovrebbe funzionare non è una verifica. Il progetto ha già avuto un'esperienza negativa con un altro strumento AI che produceva report PASS/FAIL fabbricati senza eseguire codice reale — non ripetere quel pattern.

Flusso obbligatorio per ogni modifica a un modulo:

1. Modifica i file dentro `odoo-modules/<modulo>/` (mai direttamente in `custom-addons/`)
2. Esegui `./promote_module.sh <modulo>`
3. Riporta all'utente l'esito **copiando l'output reale dello script**, non un riassunto
4. Se lo script fallisce, mostra l'errore reale (traceback Odoo) e correggi — non ripetere il tentativo con piccole variazioni casuali, capisci prima la causa

## Ambiente VPS reale — valori confermati (audit 11/08/2026)

- `custom-addons` reale in produzione: **`/opt/erpv6/custom-addons`** — qualsiasi riferimento a `/mnt/extra-modules` trovato in vecchie versioni del `docker-compose.yml` su GitHub è disallineato dalla realtà del VPS, non fidarti del repo pubblico per questo dettaglio.
- Database di staging/test in uso oggi: **`erpv6`**.
- Servizi Docker: `odoo` e `odoo-postgres`, definiti in `/opt/erpv6/docker-compose.yml`.
- Root SSH è disabilitato (`PermitRootLogin no`). L'utente operativo è `erpv6admin` (sudo + docker).

## Password del database

La password del database si cambia in `/opt/erpv6/config/odoo.conf` (campo `db_password`), non nel file `.env`. Se `odoo.conf` ha già un valore esplicito, quello vince sempre sulla variabile d'ambiente — cambiare solo `.env` non ha alcun effetto.

Dopo una modifica a `.env`, `docker compose restart` NON rilegge il file — serve `docker compose up -d --force-recreate <servizio>`.

## Divieto — `docker compose config`

Mai eseguire `docker compose config` per verificare una variabile d'ambiente: stampa i secrets in chiaro nel terminale. Per controllare che una password sia stata scritta correttamente, usare solo la lunghezza: `grep VARIABILE file | awk -F= '{print length($2)}'`.

## Divieto — `fattorie_della_fenice`

⚠️ `fattorie_della_fenice` è un database di **PRODUZIONE ATTIVO** (rete d'impresa agricola, dati reali) — NON è legacy, NON va mai toccato, modificato, o usato per test, in nessuna circostanza. Qualsiasi comando che opera su un database deve sempre specificare esplicitamente `erpv6`, mai eseguire comandi che agiscono "su tutti i database" senza controllo.
