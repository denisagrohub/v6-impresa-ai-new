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
