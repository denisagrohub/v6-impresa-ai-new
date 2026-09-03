#!/usr/bin/env bash
# genera .claude-tasks/TASK-1..5.md per Claude Code
set -e
cd /home/erpv6admin/erpv6-src
mkdir -p .claude-tasks

cat > .claude-tasks/TASK-1-home.md <<'EOF'
# TASK 1 - Home: hero, DSCR umano, Kairos animato
## FATTI VERIFICATI (Fase 0, non ricontrollare)
- Repo /home/erpv6admin/erpv6-src, app apps/impresa. NON toccare apps/bandi, apps/agrohub, apps/performance.
- Tailwind 3.4.4 (rounded-sm, shadow-sm). Design tokens: apps/impresa/tokens-impresa.md.
- Componenti shared pronti: components/shared/MetodoLine.tsx, StateBadge.tsx, BlurLock.tsx - USALI.
- DSCR 3,18x CONFERMATO reale, gia presente in app/page.tsx.
- IN PRODUZIONE il caso compare come "azienda cliente": VIOLA il vincolo - correggere in
  "il nostro stesso progetto agricolo" (Tosi Mati e progetto interno, MAI cliente terzo).
- Kairos ISTANTANEO: score arriva nella risposta dell'ultima answerInterview (setScore in
  InterviewTreeFlow righe 128-135). Animazione di atterraggio = a completamento intervista.
- lib/lead-scoring.ts e scoring COMMERCIALE consulenti, NON il Kairos utente: non toccarlo.
## VINCOLI ASSOLUTI
- ZERO statistiche finte: se manca il dato, campo vuoto + commento TODO(real-data).
- ZERO successi simulati: conferma UI solo se l'operazione e realmente riuscita.
- terracotta SOLO su CTA/linea metodo; MAI nella sezione DSCR/giudizio.
## Cosa fare (app/page.tsx + components/home/KairosMatrix.tsx)
1. Leggi page.tsx PER INTERO prima di toccare: merge chirurgico, NON sovrascrittura.
   Preserva integrazione con @erpv6/ui e icone lucide esistenti.
2. Palette: hero navy #0F1E3C, sezioni alternate crema #F7F3ED, CTA terracotta #D4703A.
3. Sezione DSCR in QUESTO ordine: (a) giudizio umano grande con StateBadge ("Pronta per una
   banca" / "Ci siamo quasi" / "Serve lavoro prima di presentarti"); (b) frase-traduzione:
   "Per ogni euro di debito, l'azienda ne genera 3,18 per ripagarlo - le banche cercano
   almeno 1,2."; (c) acronimo DSCR piccolo con tooltip "cos'e".
4. MetodoLine variant="scroll" attraverso i 4 step (Diagnosi, Struttura finanziaria,
   Accesso ai fondi, Validazione), che continua verso la sezione DSCR/Kairos.
5. Correggi Tosi Mati in "il nostro stesso progetto agricolo".
## ACCETTAZIONE
npx tsc --noEmit pulito; npm run build ok; focus-visible ring sulle CTA; zero numeri inventati.
EOF

cat > .claude-tasks/TASK-2-intervista.md <<'EOF'
# TASK 2 - Intervista: fix bug "Altro" + checklist laterale
## FATTI VERIFICATI
- Riusare components/interview/InterviewTreeFlow.tsx, app/api/interview-tree/, app/api/leads/route.ts.
  VIETATO creare percorsi paralleli.
## BUG (sezione 3.1 del prompt)
Selezione "Altro" non mostra il campo testo. Individua la causa (stato di visibilita non
collegato al click su quell'opzione) e correggi. Domanda+campo = blocco atomico (stessa
animazione, nessun salto). Verifica END-TO-END su localhost:3000 che la risposta arrivi a Odoo.
## CHECKLIST (sezione 3.2)
Checklist laterale che si popola in tempo reale con nome+valore di ogni dato:
- Primo blocco (nome, azienda) crea il lead via API esistente, campi spuntati subito.
- AGGIORNAMENTO OTTIMISTICO CON ROLLBACK: spunta istantanea, salvataggio in parallelo;
  se la chiamata fallisce QUEL campo perde la spunta e mostra "non salvato, riprova".
  MAI spunta verde su un dato non arrivato a Odoo.
- Icona sui campi che concorrono al punteggio Kairos.
## ACCETTAZIONE
tsc + build puliti; bug verificato manualmente end-to-end; nessuna spunta senza conferma API.
EOF

cat > .claude-tasks/TASK-3-attesa-output.md <<'EOF'
# TASK 3 - Attesa, tre liste, ponte pagamento
## ATTESA
- MetodoLine variant="loop" sotto il quadrante Kairos gia fermo.
- VIETATA barra percentuale. Micro-copy rotante ogni 2-3s: "Stiamo leggendo i tuoi dati...",
  "Stiamo confrontando con casi simili al tuo...", "Stiamo verificando ogni numero prima
  di mostrartelo...".
- Oltre ~18s: "Ci vuole qualche minuto in piu del solito - ti mandiamo il risultato
  completo via email appena pronto, puoi chiudere questa pagina tranquillamente."
## OUTPUT TRE LISTE
- criticita e azioni_urgenti: SEMPRE visibili per intero, MAI sfocate.
- opportunita: blur SOLO dal secondo elemento in poi per item, prima riga visibile.
  Usa components/shared/BlurLock.tsx.
- Item con scadenza o rischio reale: MAI in opportunita, nessuna eccezione.
## PAGAMENTO (ponte)
- Stripe Payment Link (NO checkout custom): crea branch/route di sblocco con token
  non enumerabile, scadenza 30 giorni, report pre-generato PRIMA dell'invio email.
- Chiedi all'utente il Payment Link reale quando arrivi a questo punto.
## ACCETTAZIONE
tsc + build; nessun item con scadenza sfocato; attesa senza barra percentuale.
EOF

cat > .claude-tasks/TASK-4-circuit.md <<'EOF'
# TASK 4 - admin/circuit/page.tsx: Variante 3 "Foglio schematico"
## FATTI VERIFICATI
- Pagina reale: 1851 righe, createNode (r.587), deleteNode (r.640), format_mismatch
  (r.61, 1067, 1274). firma_soddisfatta NON esiste nel codice: prevederla come campo
  opzionale nei tipi (firma_soddisfatta?: boolean), pronta per il futuro.
## DESIGN TOKENS (mockup Variante 3, strumento interno: palette fredda VOLUTA)
bg #eef1f4, superficie #fff, linea #c3ccd4, grafite #2b3440, ciano #1a7fa8,
ambra #c07f00, rosso #c23b3b, verde #3d8f5f. Segoe UI + monospace.
Griglia canvas 24px, nodi 190px, layout 220px / fluido / 300px.
## SCOPE
1. Applica palette/tipografia/densita Variante 3.
2. Callout ANCORATO AL NODO (non banner in cima): su format_mismatch=true e
   firma_soddisfatta===false. Bordo 1.5px rosso, header rosso pieno con id+ora,
   dettaglio sotto, posizionato vicino al nodo.
3. Inspector destro a TAB (Proprieta / I/O / Storico). Verifica prima cosa c'e oggi.
## VIETATO
- Toccare logica di editing (createNode/deleteNode/archi) o chiamate API.
- Clonare pixel-per-pixel il mockup: adatta ai dati reali.
## ACCETTAZIONE
Editing, gerarchia V1, cross-reference V4 funzionano ESATTAMENTE come prima.
Test visivo callout su nodo reale con format_mismatch=true; test visivo che il callout sia posizionato vicino al nodo.
EOF

cat > .claude-tasks/TASK-5-pagine.md <<'EOF'
# TASK 5 - Pagine secondarie (stesso sistema visivo, contenuti reali)
Le pagine in app/chi-siamo, app/servizi, app/servizi/finanziamenti,
app/casi-studio, app/contatti, app/blog sono scaffoldate con robots noindex:
RIMUOVI il noindex SOLO quando la pagina e completa e verificata.
## Istruzioni per pagina
- chi-siamo: MetodoLine come timeline founder, NON bio statiche affiancate.
- servizi: bento grid a blocchi di dimensioni diverse, NON 3 card identiche;
  icone-metodo coerenti con la home.
- servizi/finanziamenti: MAI gauge di probabilita di approvazione senza modello
  statistico reale. Usare StateBadge con stati qualitativi onesti.
- casi-studio: schema prima/dopo (critico verso positivo). Tosi Mati = "il nostro
  stesso progetto agricolo", MAI "azienda cliente".
- contatti: nessun trattamento speciale; conferma di successo SOLO se il lead e
  realmente arrivato in Odoo (risposta API verificata).
- blog: tipografia pulita, minimo colore, nessun sistema di stati.
## VIETATO
Statistiche finte ("350+ business plan", "45M euro", "98% soddisfazione") anche
come "da confermare dopo". Se manca il dato: campo vuoto + commento TODO(real-data).
## ACCETTAZIONE
tsc + build puliti; nessun numero inventato; ogni pagina completa o ancora noindex.
EOF

echo "5 task generati in .claude-tasks/"
echo "Prossimo passo: apri Claude Code e digita: leggi ed esegui .claude-tasks/TASK-1-home.md"