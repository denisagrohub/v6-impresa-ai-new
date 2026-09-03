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
