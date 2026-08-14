# Audit — Struttura res.company vs architettura whitelabel (erpv6)

Data: 2026-08-13
Database analizzato: `erpv6` (staging/produzione, VPS `/opt/erpv6`)
Tipo di intervento: **sola analisi, nessuna modifica al database o al codice**

## Contesto (fornito dall'utente)

- `Fattoria ai Tosi Mati` è un'azienda agricola con P.IVA propria, destinata a un database Odoo interamente separato (non `erpv6`, non `fattorie_della_fenice`). È **corretto** che non compaia tra le `res.company` di `erpv6`, o che compaia al più come contatto esterno.
- Le uniche `res.company` che **devono** avere una configurazione whitelabel dentro `erpv6` sono i brand di marketing/consulenza del gruppo: **V6 Impresa, V6 Performance, AgroHub Italia** (e futuri come V6 Bandi/Manuali).

## 1. res.company esistenti su erpv6

| id | name | parent_id | sequence | active |
|----|------|-----------|----------|--------|
| 1 | My Company (San Francisco) | — | — | true |
| 2 | My Company (Chicago) | — | 10 | true |
| 3 | IT Company | — | 10 | true |

**Nessuna gerarchia impostata**: `parent_id` è vuoto su tutte e tre le righe → sono tutte allo stesso livello, nessun padre/figlio.

**Nessuna di queste è un brand atteso.** Sono le company demo/default fornite di serie da Odoo (San Francisco, Chicago) più una company generica "IT Company", probabilmente creata durante il setup iniziale del database. **Nessuna company reale del gruppo (V6 Impresa, V6 Performance, AgroHub Italia) è stata ancora creata** su questo database.

## 2. Configurazioni whitelabel esistenti (erpv6.whitelabel.config)

**Nessuna — il modulo `erpv6_whitelabel` non è installato su `erpv6`.**

Verifiche effettuate:
- `ir_module_module` non contiene alcuna riga per `erpv6_whitelabel` (0 risultati) — il modulo non risulta nemmeno noto al registro moduli, non solo "non installato".
- La tabella `erpv6_whitelabel_config` **non esiste** nello schema del database (`information_schema.tables` — 0 risultati).
- `ir_model` non contiene alcun modello che matcha `%whitelabel%`.
- La cartella `/opt/erpv6/custom-addons/` **non contiene** `erpv6_whitelabel` — il modulo non è mai stato promosso/deployato su questo VPS (a differenza di altri moduli come `erpv6_product_pricing`, deployato oggi stesso).

Il codice del modulo esiste nel repository (`odoo-modules/erpv6_whitelabel/`) — modello `erpv6.whitelabel.config`, vincolo `unique(code)` su `code` confermato nel sorgente (`_sql_constraints = [('unique_brand_code', 'unique(code)', ...)]`, non su `company_id`), coerente con l'architettura descritta. C'è anche una modifica non committata in sospeso su `views/whitelabel_config_views.xml` (1 riga, git status del branch corrente) — non correlata a questo audit, segnalata solo per completezza.

## 3. Confronto company ↔ whitelabel

Non è possibile fare un confronto puntuale "record per record" perché il lato whitelabel è completamente assente (nessuna tabella, nessun dato). Il confronto si riduce quindi a:

- **Company presenti ma senza whitelabel**: My Company (SF), My Company (Chicago), IT Company — attese senza whitelabel, sono company demo/generiche non facenti parte dei brand di marketing. **Non è un problema secondo il criterio dato** (non sono V6 Impresa/Performance/AgroHub).
- **Whitelabel orfani (puntano a company inesistenti)**: n/a, nessun record whitelabel esiste.
- **Problema reale segnalato**: i tre brand di marketing che *devono* avere una company + whitelabel configurati — **V6 Impresa, V6 Performance, AgroHub Italia — non esistono ancora né come `res.company` né come `erpv6.whitelabel.config`** su questo database. Non è un disallineamento tra due strutture esistenti: è che l'intera architettura whitelabel (company dedicate + modulo installato + record di config) non è ancora stata messa in piedi su `erpv6`.
- Coerentemente con quanto atteso: nessuna traccia di "Fattoria ai Tosi Mati", "AgroHub", "V6 Impresa" o "V6 Performance" nemmeno come `res.partner` (contatto esterno) — verificato con ricerca case-insensitive sul nome, 0 risultati.

## 4. Gerarchia parent_id

**Non esiste alcuna gerarchia.** Le tre `res.company` presenti hanno tutte `parent_id` nullo — sono indipendenti, nessuna relazione padre/figlio impostata.

```
My Company (San Francisco)   [id=1, parent_id: —]
My Company (Chicago)         [id=2, parent_id: —]
IT Company                   [id=3, parent_id: —]
```

## Riepilogo

| Verifica | Esito |
|---|---|
| res.company con gerarchia | Nessuna — 3 company demo, tutte indipendenti |
| Modulo erpv6_whitelabel installato su erpv6 | **No** — assente da ir_module_module, tabella, e custom-addons |
| Company per i brand attesi (Impresa/Performance/AgroHub) | **Assenti** |
| Whitelabel config per i brand attesi | **Assenti** (conseguenza diretta: modulo non installato) |
| Fattoria ai Tosi Mati come company/whitelabel in erpv6 | Assente — **atteso e corretto** |
| Fattoria ai Tosi Mati come contatto esterno (res.partner) | Assente (non ancora inserita in alcuna forma) |

**Conclusione**: l'architettura whitelabel descritta (`unique(code)`, non `unique(company_id)`) è corretta e già scritta nel codice del modulo, ma **non è ancora operativa su `erpv6`**: il modulo non è mai stato deployato e nessuna delle company/brand attese esiste nel database. Non si tratta quindi di un disallineamento tra dati esistenti, ma di un setup iniziale ancora da fare (deploy modulo + creazione company + creazione config whitelabel per V6 Impresa, V6 Performance, AgroHub Italia).
