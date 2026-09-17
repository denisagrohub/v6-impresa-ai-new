# Report sessione — 9/10 settembre 2026

Repo: `erpv6-src`, branch `main` (tutto già pushato e deployato).
Commit di riferimento finale: `644b305`.

---

## 1. Stripe — webhook e configurazione

**Fatto e verificato dal vivo:**
- Trovato e corretto: `web.base.url` era `http://` invece di `https://`, causava il rifiuto di Stripe nella creazione del webhook ("URLs in livemode must begin with https://").
- Causa reale trovata dopo: mancava `proxy_mode = True` in `/opt/erpv6/config/odoo.conf` — Odoo non si fidava dell'header `X-Forwarded-Proto` di Caddy. Aggiunto, Odoo riavviato.
- Webhook creato con successo, `stripe_webhook_secret` popolato sul provider (id 20, `state=enabled`).
- Registro pagamenti (journal "Stripe", `BNK1`) verificato collegato correttamente.

**Non verificato:** un pagamento Stripe reale con carta vera end-to-end (solo simulato/verificata la meccanica, vedi punto 6).

---

## 2. Rebrand EAOSv6 (modulo `erpv6_whitelabel`)

**Fatto:**
- Rinominato "ERPV6" → "EAOSv6" in tutte le stringhe del modulo (titoli, footer login, dialog di errore, email, tour, chat AI, ecc.) — lasciata intatta solo l'attribuzione legale "Powered by Odoo Community Edition" in Impostazioni > Informazioni.
- Fix crash reale (OwlError `ColorList`): widget sbagliato (`color_picker` invece di `color`) nella vista elenco White Label.
- **Dopo la richiesta di verifica sulla pagina di pagamento**: trovati e corretti altri due "Odoo" visibili non coperti dal rebrand iniziale — badge "Fornito da [logo Odoo]" nella sidebar portale e "Crea un sito web gratuito" (`web.brand_promotion_message`). **Primo tentativo di fix ha causato un errore 500 reale** (rottura di una formattazione Python nel template originale Odoo) — trovato nei log e corretto subito, verificato che la pagina torna 200.
- Branch `feature/eaosv6-whitelabel-rebrand` mergiato in `main`.

**Aperto / non toccato (decisione esplicita, da confermare):**
- Il **titolo delle pagine portale** (es. "Sales Order | V6 Impresa") mostra il nome azienda reale "V6 Impresa", non "Odoo" ma nemmeno "EAOSv6" — non l'ho cambiato perché è un nome aziendale legittimo già configurato, cambiarlo tocca il campo `name` della company (effetto su fatture, tutto il sistema). **Da decidere con Denis.**
- **"OdooBot"** (nome del partner di sistema `base.partner_root`, usato per i messaggi automatici in TUTTO il gestionale) — lasciato invariato di proposito: rinominarlo avrebbe effetto ovunque nel sistema, non solo sulla pagina segnalata. **Da decidere con Denis.**
- Logo/icona nella navbar del backend Odoo (componente OWL, non testo) — mai personalizzato, segnalato come task a parte fin dall'inizio.

---

## 3. Circuito Win-Win — nuove pagine (Parte A-D)

**Fatto e verificato dal vivo (build reali + curl su produzione):**
- **Parte A** — pagina pubblica `/partnership` (candidatura partnership) + modello `erpv6.partnership.candidacy` + notifica reale a Denis + coda nella tab Amministrazione. Testato end-to-end con dati reali poi ripuliti.
- **Parte B** — routing prodotto→consulente (`erpv6.landing.product.route`, menu "Routing Prodotti" sotto Produzione): se una landing porta un `?source=`, il lead viene assegnato DIRETTAMENTE al consulente configurato, saltando l'auto-assegnazione. Verificato con test reali (poi ripuliti).
- **Parte C** — rotazione claim in homepage (componente `ClaimRotator`, navigazione manuale, mai a tempo).
- **Parte D** — 8 landing di prodotto: Business Plan, Analisi Aziendale, Ricambio Generazionale, Acquisto TEE, ESG, Team Building, Formazione Aziendale, Kaizen & Lean.

**Aperto:**
- **`erpv6.landing.product.route` è vuota** — nessun prodotto ha ancora un consulente reale assegnato. Il CTA "Prenota una call" di tutte le 8 landing punta a `/contatti` (nessun `consultantId` inventato). **Da fare quando Denis assegna i consulenti per prodotto.**

---

## 4. SEO

**Fatto e verificato dal vivo:**
- **Bug critico trovato**: le 8 nuove landing + `/partnership` + (scoperto dopo) `/business-plan-pmi`, `/business-plan-startup`, `/project-finance` (già esistenti da prima) NON erano in `PUBLIC_PATHS` nel middleware — un visitatore anonimo/Googlebot veniva rimandato a `/login`. Corretto.
- `robots.txt` e `sitemap.xml` non esistevano affatto (redirect a `/login` anche loro) — creati.
- `metadataBase` + Open Graph/Twitter di default aggiunti al layout globale (mancavano).
- Metadata (title/description) aggiunti a: `/casi-studio`, `/chi-siamo`, `/metodo`, `/contatti`, `/intervista`.
- `/llms.txt` creato (indice del sito per assistenti AI, convenzione llmstxt.org) — verificato che nessun crawler AI sia bloccato da `robots.txt` e che il contenuto sia nell'HTML grezzo (SSR, non solo dopo JS).

**Aperto / non auditato:**
- Metadata non verificati/non aggiunti per: `/premium`, `/brand`, `/project-finance` (le 8 landing di prodotto e `/business-plan` hanno già metadata propri).
- Nessuna immagine Open Graph reale (1200×630) — servirebbe un asset disegnato apposta, non inventato qui.
- Nessun dato strutturato JSON-LD (Organization/Service schema) — non costruito, possibile miglioramento futuro.

---

## 5. Menu, pagine vecchie, Blog

**Fatto e verificato dal vivo:**
- Rimosse le emoji dal menu (💎🎨 su "Pacchetti"/"Brand"), aggiunto link "Blog".
- **Valutazione e ritiro** di `/business-plan-pmi` e `/business-plan-startup`: contenevano dati/testimonianze inventate, form mai collegato a Odoo, prezzi fissi senza corrispondenza reale. **Primo tentativo di redirect era solo lato client** (nessun header `Location`, non seguito da curl/Googlebot) — trovato e corretto con un redirect HTTP reale (308) in `next.config.js`, verificato con curl.
- Nuovo `/blog` + `/blog/[slug]` con 2 articoli reali (DSCR, Kaizen) — contenuto educativo, nessun dato di marketing inventato.

**Aperto:** nessuno noto in quest'area.

---

## 6. Pagamento reale Win-Win (€49) — la parte più grossa

**Trovato inizialmente:** lo sblocco del report a 49€ era un semplice `setUnlocked(true)` lato client — **zero pagamento**, nessuna integrazione Stripe da nessuna parte. Il backend mandava comunque tutti i dati completi ad ogni chiamata (ispezionabili dal tab Network prima ancora di "sbloccare").

**Costruito (riusando il sistema di pagamento nativo Odoo, nessun codice Stripe scritto a mano, su richiesta esplicita di Denis "usa il sistema Odoo"):**
- Prodotto reale "Report Win-Win" — **40,16€ netto + IVA 22% = 49,00€ esatti** (calcolato a ritroso su richiesta di Denis: prezzo IVA inclusa, verificato che il totale torni esattamente 49,00€).
- `erpv6.winwin.report.token` esteso con `sale_order_id` / `is_paid` (vero, da `sale_order.state`) + `action_get_payment_url()` → crea/riusa un `sale.order` e ritorna l'URL portale Odoo nativo (`/my/orders/<id>`).
- `require_signature=False` (il passo "firma" non ha senso per un report digitale — trovato e tolto dopo il primo test).
- Backend (`winwin_report_api.py`): `/status` ritorna `is_paid` reale; `/data` toglie davvero `roadmap` se non pagato (prima veniva mandata comunque); nuovo endpoint `/pay`.
- Frontend: rimosso lo sblocco finto, il bottone avvia ora il pagamento vero (redirect al portale Odoo).
- **Redirect automatico dopo pagamento** (richiesto da Denis): banner + redirect a 10 secondi verso `/report/[token]`, solo se l'ordine è confermato e collegato a un report Win-Win. Verificato simulando la conferma sull'ordine di test (poi riportato a "draft" per non lasciare un finto pagamento nel sistema).

**Verificato dal vivo:**
- Pagina portale raggiungibile (200), form Stripe reale presente (chiave pubblica live vera, importo esatto in centesimi, provider "stripe" enabled) + opzione bonifico bancario.
- Redirect a 10 secondi: banner e script confermati nell'HTML reale (test poi annullato).

**⚠️ NON verificato — il test più importante che manca:**
Un **pagamento reale end-to-end con carta vera** (o a costo zero con sconto) non è mai stato completato. Ho verificato la meccanica (creazione ordine, pagina raggiungibile, form Stripe presente, redirect funzionante se simulato) ma **mai il ciclo completo**: click "paga" → conferma Stripe reale → webhook → conferma automatica ordine → sblocco vero del report. Questo è il test che avevi proposto tu con lo sconto.

**Come completarlo:** ordine di test **#29** (token id 6) pronto — apri l'ordine in Odoo, metti uno sconto/prezzo a 0 sulla riga, apri il link pagamento, completa il pagamento a 0€, verifica che il report si sblocchi davvero e che il redirect scatti.

**Altro aperto:**
- Il carrello Odoo (`require_payment=True`) resta pensato per UN prodotto alla volta (il report), non un vero carrello multi-prodotto — coerente con "solo la parte del carrello" richiesto, ma da estendere se in futuro servirà vendere più prodotti insieme.
- Bottone portale dice ancora "Accetta e paga" anche senza firma richiesta (cosmetica, non corretta).

---

## 7. Bug email progetto (dashboard + Odoo backend)

**Trovato e corretto:**
- Menu **"Progetti (Relay Email)"** nell'app Project mostrava da sempre i Progetti, mai le email (nome fuorviante, non una regressione) — rinominato in "Progetti" + aggiunto link diretto "Email Progetti" nello stesso punto.
- Le email nella dashboard OWL (tab "progetti" e "relazioni") erano solo testo statico, nessun click possibile — ora cliccabili, aprono la scheda Odoo reale.

**Aperto:**
- Aprendo un **Progetto direttamente** dalla sua scheda Odoo (`erpv6.tracking.relation` form), le email collegate NON sono embedded lì — mai stato costruito. Oggi si vedono solo dal menu "Email Progetti" (elenco piatto) o dalla dashboard OWL (ora cliccabile). Se serve vederle direttamente sulla scheda del progetto, è un pezzo di lavoro a parte.

---

## 8. Altro trovato ma non toccato

- **Progetto Vercel duplicato/orfano**: `v6-impresa-ai-new` (stesso repo, build sempre in errore da mesi, nessun dominio reale collegato) — quello vero è `denisagrohub-v6-impresa-ai-new` (alias `www.v6impresa.it`). Non ho toccato/pulito quello orfano, solo identificato per evitare confusione futura.
- Il mockup `/checkout/[id]` (SAL progetti consulenza, JSON locale su disco, nessuna vera integrazione Stripe) resta così com'è — è un caso diverso dal pagamento Win-Win, fuori scope di questo giro.

---

## 9. Navigazione — dopo la tua verifica dal vivo

Avevi segnalato "vedo ancora la versione vecchia". **Verificato con curl sui log reali: il deploy era già l'ultimo** (l'HTML conteneva già tutte le 8 pagine nuove) — non era un problema di deploy/cache lato server. La causa vera: le 8 landing di prodotto non erano linkate **da nessuna parte nel menu**, solo raggiungibili cliccando le CTA della rotazione in homepage.

**Fatto (commit `644b305`, verificato con build reale):**
- Nuovo dropdown **"Prodotti"** nel menu (desktop e mobile) con tutte le 8 landing.
- Pulsante **"Torna alla home"** esplicito in cima a ogni landing di prodotto.
- Rotazione homepage ora **automatica** (8 secondi), con pausa al passaggio del mouse/tastiera — su tua richiesta esplicita, inverte la regola "mai automatica" data in origine (motivata dal tempo di lettura di un dato tipo DSCR). Le frecce/pallini restano comunque utilizzabili.

**Se dopo questo deploy vedi ancora contenuto vecchio**: quasi certamente cache del TUO browser, non del sito — prova un refresh forzato (Ctrl+Shift+R / Cmd+Shift+R) o una finestra in incognito.

---

## Riepilogo priorità aperte

1. **Test reale del pagamento Win-Win** (con lo sconto, ordine #29) — il pezzo più importante da chiudere.
2. Decidere: "V6 Impresa" vs "EAOSv6" nel titolo delle pagine portale, e se rinominare "OdooBot" di sistema.
3. Assegnare consulenti reali alle 8 landing di prodotto (`erpv6.landing.product.route`), oggi vuota.
4. Eventuale embedding delle email direttamente sulla scheda Progetto in Odoo.
5. Metadata SEO ancora mancanti su `/premium`, `/brand`, `/project-finance`; immagine OG reale; JSON-LD.
