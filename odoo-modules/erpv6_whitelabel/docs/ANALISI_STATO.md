# erpv6_whitelabel — Analisi modulo

Analisi generata il 2026-08-15, basata su lettura completa del codice sorgente.

## Modelli esposti

| Modello | Campi principali | Stato |
|---|---|---|
| `erpv6.whitelabel.config` | `name`, `sequence`, `company_id`, `code` (identificativo brand, univoco), `domain`, `company_name`, `logo`/`logo_small`/`favicon` (Binary), `primary_color`/`secondary_color`/`success_color`/`warning_color`/`danger_color`, `font_family`, `border_radius`, `welcome_message`, `footer_text`, `support_email`/`support_phone`, `hide_odoo_branding`, `custom_css`, `active` | Logica reale di configurazione multi-brand |
| `res.company` (estensione) | `whitelabel_config_id` (One2many), `brand_primary_color`/`brand_secondary_color`/`brand_logo` (campi `related` verso la config) | Estensione di comodo, nessuna logica propria |
| `erpv6.whitelabel.mail_template_patch` (AbstractModel, nessuna tabella) | metodo `apply_erpv6_branding()` | Patch dei template email core (`auth_signup`, `portal`) — tecnica documentata nel codice per bypassare la protezione `noupdate="1"` di Odoo sui record core |

## Metodi pubblici pensati per essere chiamati da altri moduli

- `erpv6.whitelabel.config.get_active_config(code, domain, company_id)` (`@api.model`): risoluzione della configurazione attiva con ordine di priorità code → domain → company_id (legacy) → creazione di default. Pensato per essere chiamato sia da controller interni sia potenzialmente da altri moduli.
- `get_white_label_data()`: serializza la config per il frontend.
- `action_preview()`: **bottone UI che referenzia un modello inesistente** — vedi Debiti.
- `erpv6.whitelabel.mail_template_patch.apply_erpv6_branding()`: chiamato da `<function>` in `data/mail_template_overrides.xml` (non letto riga per riga in questa analisi, ma citato nel commento della classe) — tecnica per forzare l'aggiornamento di template email core protetti da `noupdate`.
- **API REST reale**: `controllers/whitelabel_config.py` espone `/api/whitelabel/config` (pubblico), `/api/whitelabel/update` (autenticato), `/web/white_label_assets` (pubblico, genera CSS dinamico) — consumate dal frontend Next.js multi-brand.
- Nessun altro modulo Odoo del repository dipende da `erpv6_whitelabel` (verificato con grep sui manifest) — è consumato solo dal frontend via le API REST proprie.

## Punti di estensione noti

- `code` (Char libero, univoco) è il vero punto di estensione per il multi-brand: nuovi brand/domini si aggiungono creando record, non modificando codice — coerente col principio motore/conoscenza.
- Fallback a `company_id` per compatibilità legacy, ma la ricerca prioritaria è per `code`/`domain` — buona evoluzione verso un modello multi-brand indipendente dalla company Odoo.
- Non pertinente ai principi Kaizen/Opportunity/Bandi/Validation del CLAUDE.md.

## Stato reale (verificato il 2026-08-15)

- Installato sul DB `erpv6` del VPS: `state=installed`, `latest_version: 18.0.1.0.0` — coincide con `version` nel `__manifest__.py` locale. Nessun drift.
- **Bug reale verificato**: `action_preview()` in `whitelabel_config.py` (riga 127-137) restituisce un'action con `res_model: 'erpv6.whitelabel.preview'`. Questo modello **non esiste da nessuna parte nel modulo** (verificato con grep su tutta la cartella `erpv6_whitelabel/`) — se il bottone collegato a questo metodo viene premuto in UI, Odoo restituirà un errore "modello non trovato".
- Modulo attivamente mantenuto: la cronologia commit recente del repository include fix di branding ripetuti su questo modulo (`1d22e2f fix: branding erpv6_whitelabel — navbar illeggibile, PWA install card`, oltre a fix precedenti su permessi fotocamera e tour onboarding) — segno di un modulo in uso reale e iterato, a differenza di altri moduli "installed" ma mai popolati.
- Nessuna cartella `tests/`.

### Debiti noti / TODO

- **`action_preview()` punta a un modello inesistente (`erpv6.whitelabel.preview`)** — bottone non funzionante, da implementare o rimuovere.
- Nessun test automatico.
- `/api/whitelabel/update` (route `auth='user'`) accetta una lista aperta di campi (`allowed_fields`) senza controllo esplicito di autorizzazione oltre l'autenticazione base — chiunque sia autenticato può modificare la configurazione white label attiva della propria company; da verificare se questo è il comportamento voluto o se serve un controllo di ruolo più stringente (es. solo admin/manager).
