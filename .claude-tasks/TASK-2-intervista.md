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
