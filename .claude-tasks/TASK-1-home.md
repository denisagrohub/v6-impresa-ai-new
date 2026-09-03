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
