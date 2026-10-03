# C5 — Ciclo Kaizen da manual_report.create()

Data: 2026-10-03
HEAD: 99afc1f
Modalità: read-only

## Scopo

Tracciare cosa succede quando un utente crea un erpv6.kaizen.manual_report.
Il test C5-b ha rivelato notifica Telegram + errore Groq 413 sull'agente AI.

## Catena diretta (dentro create())

manual_report.create() esegue in ordine:
1. super().create(vals)              # insert DB
2. _log_to_heinrich()                # contatore Heinrich++
3. _create_detected_signal()         # detected_signal (origin=manuale)

### _log_to_heinrich
Chiama erpv6.heinrich.indicator.log_signal(res_model, res_id, severity, desc).
Get-or-create indicatore, incrementa contatore, appende nota.

### _create_detected_signal
Crea erpv6.kaizen.detected_signal con:
- signal_key = manual_report_<id>
- origin = segnalazione_manuale
- manual_report_id = self.id
Idempotente (search-first).

## Catena indiretta (cron)

Cron 70 (30 min): Rileva Segnali - NON processa manual_report
Cron 77 (24 h): Applica 12 Regole - Regola 4 produce proposta agente
Cron 73 (24 h): Agente AI - _cron_kaizen_agent_propose()
Cron 79 (3 min): Escalation Susanna - conferme scadute

## Chi manda "segnalazione presa in carico"

_notify_kaizen_signal_seen() in kaizen_rule_engine.py:185. Chiamato
da evaluate_12_rules() al primo giro del cron 77. Manda via
kaizen.notify_pending_confirmation() con canale:
- Discuss/chatter (sempre)
- Telegram (solo se user.im_status != 'online')

## Chi produce Groq 413

_cron_kaizen_agent_propose() in kaizen_agent.py:27 costruiva un
prompt con:
- 39 voci KB regole (~80.903 char)
- 10 memory entries (~5.367 char)
- Backlog Pareto completo

Totale ~88k char -> supera il limite Groq free (~32k token).

Fix C5-P3: rules -> Principio guida + 12 numerate, 500 char ciascuna;
memory -> 3 voci, 300 char; backlog -> top 5. Totale ~10.466 char.

## Duplicazione C5-b vs Kaizen nativo

Con C5-b, per 1 manual_report:
- erpv6.kaizen.manual_report: 1
- erpv6.kaizen.detected_signal: 1 (signal_key=manual_report_N)
- erpv6.heinrich.indicator: 1 (contatore++)
- erpv6.signal (C5-b hook): 1 (dedup=kaizen_manual:N)

Non e' duplicazione - e' sovrapposizione funzionale: entrambi
rappresentano lo stesso evento con semantiche diverse (sensor vs facciata).

## Analisi critica

### 1. Tre viste dello stesso evento
- manual_report (dato grezzo)
- detected_signal (motore regole)
- signal C5-b (facciata UI)

### 2. Ciclo Kaizen indipendente da C5-b
Il detected_signal esiste anche senza C5-b. Se l'utente vuole la
proposta AI, deve andare in /odoo/kaizen.

### 3. Catena orchestrata hardcoded
_next_chain_agent_code() in agent_proposal.py e' l'unico punto che
decide "chi viene dopo":
- claudio/alessandro -> terminali
- kaizen + parent=claudio -> alessandro (escalation)
- default -> claudio
Non configurabile. Modifica = deploy.

### 4. Agenti scrivono codice in autonomia (scoperta 03/10/2026)
Durante C5-P3 abbiamo trovato una modifica a erpv6_typst/models/
typst_document.py (probabilmente scritta da Claudio/Alessandro) con:
- campo res_model/res_id inesistenti su manual_report
- campo waste_type inesistente
- avrebbe causato NotNullViolation sul campo required related_record
Revertata. Implicazione: se gli agenti possono scrivere direttamente
sul codice sorgente senza gate umano, serve un controllo (nuovo branch
+ PR + review) - esattamente come per gli umani.

## Backlog aperto (per il master)

### C5-orchestrazione (Visione 2)
Rendere erpv6.signal il gate reale della catena:
- Accept signal -> autorizza/crea proposta Kaizen
- Ignore/Silence signal -> blocca il ciclo per quel pattern
- La conferma (B) diventa obsoleta
Richiede: modello erpv6.agent.chain_rule (tabella configurabile),
refactor _next_chain_agent_code(), UI editor catena.
Stima: 3-5 giorni.

### Agent-code-gate
Controllo sulle scritture di codice da parte degli agenti:
- Nuovo branch automatico (agent/claudio/<proposal_id>)
- PR + review obbligatoria
- No merge diretto su main
Stima: 1-2 giorni.

## Riferimenti

- odoo-modules/erpv6_kaizen/models/kaizen_manual_report.py
- odoo-modules/erpv6_kaizen/models/kaizen_detected_signal.py
- odoo-modules/erpv6_kaizen/models/kaizen_rule_engine.py
- odoo-modules/erpv6_kaizen/models/kaizen_agent.py
- odoo-modules/erpv6_agent/models/agent_proposal.py
- odoo-modules/erpv6_agent/models/agent_config.py
