# erpv6_product_pricing — Analisi modulo

Analisi generata il 2026-08-15, basata su lettura del codice sorgente e su verifica
aggregata dello stato di installazione sul database `erpv6` del VPS.

## Modelli esposti

Nessun modello proprio. Il modulo estende (`_inherit`) `product.template` (modello nativo Odoo) aggiungendo:

| Campo | Tipo | Note |
|---|---|---|
| `x_setup_fee` | Monetary | Quota di setup una tantum, separata dal prezzo di vendita ricorrente (`list_price`) |
| `x_commission_percentage` | Float (5,2) | Commissione variabile — dichiarata esplicitamente nel `help` come "a titolo informativo: non incide sul prezzo di listino" |

È il modulo più piccolo tra quelli analizzati in questo batch: 1 file di modello (14 righe), 1 vista, nessun file di sicurezza (non necessario: eredita i permessi standard di `product.template`, non introduce un modello nuovo).

## Metodi pubblici pensati per essere chiamati da altri moduli

Nessuno. Il modulo non definisce alcun metodo — solo 2 campi aggiuntivi su `product.template`. Non c'è nulla da chiamare, solo dati da leggere.

## Punti di estensione noti

- `x_commission_percentage` dichiara esplicitamente nel proprio `help` text di essere puramente informativo e di non incidere sui calcoli — comportamento onesto e coerente col codice: nessuna logica di calcolo lo consuma da nessuna parte nel repo.
- `x_setup_fee` invece è descritto come "distinto dal prezzo di vendita ricorrente", il che implica un intento di essere sommato/gestito separatamente in fase di vendita — ma **nessun modulo nel repo legge questo campo** (verificato con grep incrociato su tutto `odoo-modules/`): non è ancora agganciato a nessun flusso di vendita (`sale.order`, `erpv6_contract`, ecc.). È un campo dati pronto per essere usato, non ancora consumato.
- Modulo "motore generico a-settoriale" dichiarato tale nel manifest — coerente: non contiene alcuna regola di settore, solo 2 campi neutri.
- Non pertinente ai principi di orchestrazione Kaizen/Opportunity/Bandi/Validation del CLAUDE.md.

## Stato reale (verificato il 2026-08-15)

- Installato sul VPS (db `erpv6`): `state=installed`, `latest_version=18.0.1.0.0`. Coincide col `version` nel `__manifest__.py` locale — nessun drift.
- **Nessun modulo nel repo dipende da `erpv6_product_pricing`** (verificato con grep su tutti i `__manifest__.py`) — è isolato, i suoi 2 campi non sono ancora letti da `erpv6_contract`, `erpv6_package` o dal flusso di vendita standard.
- Nessuna cartella `tests/`.

### Debiti noti / TODO

- `x_setup_fee` non è ancora collegato a nessuna logica di calcolo prezzo/preventivo altrove nel repo, nonostante l'intento dichiarato nel manifest — al momento è solo un campo visibile e compilabile sulla scheda prodotto, senza effetto downstream.
- Nessun test automatico (comunque proporzionato alla dimensione minima del modulo).
