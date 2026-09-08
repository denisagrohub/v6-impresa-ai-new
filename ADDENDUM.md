
## S. Relazione Win-Win — template Typst, estensione KB e interventista approfondita
(sessione [data], decisioni con Denis)

S.1  Decisioni design relazione win-win: ~6 pagine, palette fissa brand
     (blu #16324F + rame #B0764A, scelta Ox Alpha), solo logo nostro,
     titolo nostro, quadrante kairos come grafica, tipografia sobria
     d'elite. Struttura: 1 copertina / 2 sintesi+kairos / 3 azioni
     win-win / 4 criticita' e azioni da evitare / 5 prossimi passi /
     6 chiusura. Copertina: PRIMO BLOCCO consegnato e approvato.
S.2  KB win-win (id 482) ESTESA (ok Denis): JSON + criticita[] e
     azioni_da_evitare[], stessa anti-allucinazione (basata_su,
     flagged_missing_data).
S.3  DISC: sempre output, MAI client-facing. Input per progetto,
     tempistiche e fasi d'intervento.
S.4  Nuove domande (ramo post-BANT, zero impatto BANT/kairos):
     (a) focus progetto: implementazione / risparmio energetico /
     efficienza interna / altro (benchmark di mercato);
     (b) principale fragilita' aziendale.
S.5  Intervista approfondita (Denis): pulsante NON nella guidata ma
     sulla PAGINA DEI RISULTATI dove appare la relazione win-win.
     Domanda 1: fissiamo subito call gratuita col NOME del consulente
     assegnato ("a voce ci si capisce meglio") -> appuntamento.
     Domanda 2: tutte le info ORA + consegna veloce VS tempo per analisi
     specifiche del caso. IL SISTEMA NON DECIDE: sono due modalita'
     di relazione scelte dal cliente (veloce vs profonda).
S.6  typst_template_proposal NON ha typst_source: il win-win e' il
     PRIMO template grafico vero. required_fields: client_info, kairos,
     azioni_winwin, criticita, azioni_da_evitare, sintesi.
S.7  Motore AIPO unico metodo_execute: win-win e BP = stesso Motore,
     input diversi. _run_metodo_ai ha gia' la forma (config dict):
     trasformazione in Motore dichiarato, non riscrittura.
S.8  BLOCCHI GRAFICI RIUSABILI (Denis): ogni blocco Typst (copertina,
     quadrante, schede...) vive come componente in library; i template
     sono SEQUENZE di blocchi (import Typst), il prodotto finale e'
     composizione di prodotti minori con sequenza logica. Il win-win e'
     il primo prodotto composto: i suoi blocchi nascono genericizzati
     per riuso (BP li riusa senza riscriverli).
S.9  Backlog: lista KB Denis (da incollare) + riordino tassonomia
     kb_type (9 voci eterogenee sotto metodo_v6) DOPO la catena win-win.

## T. Fondamento AEOSv6 — quattro gruppi e consegna centralizzata (Denis)

T.1  Il sistema ragiona su QUATTRO gruppi ben definiti: MOTORE
     (trasformazioni esecutive, firmano input/output) / CONOSCENZA
     (KB: saper-decidere) / AZIONE (Circuiti, Fasi, Gate) / GRAFICA
     (blocchi typst, template composti). Nulla fuori dai gruppi,
     nulla sparso nei moduli.
T.2  Conoscenza e Grafica vivono nel SISTEMA CENTRALIZZATO (KB/library).
     I moduli sono SOLO veicoli di consegna: all'installazione il
     contenuto viene copiato sul sistema centralizzato e TOLTO dal
     modulo. Il modulo trasporta, il centrale possiede, il modulo si
     svuota. (Correzione a S.8, formulata da Odoo vecchio.)
T.3  Blocchi grafici win-win: installati DIRETTAMENTE in library come
     record (decisione Denis: ora si fa cosi'; l'autoinstallazione via
     hook si implementa dal SECONDO modulo, quando si generalizza).
T.4  Regola di confine KB/library: la KB decide (prompt, regole), la
     library disegna e conserva (blocchi, template, documenti finali).
     Il motore typst esegue ma non possiede nulla.

T.5  Progetto contenitore "AEOSv6 - Inserimenti Diretti di Sistema"
     (crm.lead dedicato, idempotente): tutti gli artefatti NON-cliente
     (blocchi grafici, componenti, template di sistema) si registrano
     in library con project_id = quel progetto. Archiviandolo, gli
     inserimenti diretti escono dalla vista operativa restando in
     library. Convenzione di sistema, vale per tutti i moduli futuri.
T.6  Blocchi grafici win-win installati in library come
     erpv6.library.document (category='other' temporaneo; da
     generalizzare con selection dedicata 'graphic_block' al secondo
     modulo; is_final=False sempre - niente blockchain per i blocchi).
     Sorgenti di lavoro anche in /tmp/blocchi_winwin/.
T.6b  CONSTATATO 03/09/2026: progetto contenitore creato (crm.lead
      id 150), quattro blocchi grafici registrati in library come
      erpv6.library.document (id 76-79, category='other',
      origin='internal_upload', is_final=False, file presente su
      tutti). Metodo di inserimento diretto: script python via
      `docker exec -i odoo odoo shell -d erpv6 --no-http
      --stop-after-init < script.py` (niente incolla interattivo:
      genera SyntaxError a pezzi). Lezione tecnica: Environment si
      crea con api.Environment(cr, SUPERUSER_ID, {}); commit con
      env.cr.commit(); rollback con env.cr.rollback().
T.6 COMPLETATO 03/09/2026 - Composizione template da blocchi library:
      - Nuovo modello erpv6.typst.template.block (erpv6_typst, dipendenza
        da erpv6_library): lega template <-> erpv6.library.document, con
        vincolo unique(template_id, library_document_id).
      - Override get_typst_source(): template con blocchi = sorgenti dei
        blocchi IN SEQUENZA PRIMA + main (typst_source) DOPO. Ordine
        essenziale: le #let di Typst valgono solo "da li' in poi", quindi
        palette/funzioni devono precedere il main. Nessuna copia: i
        blocchi sono letti da library al momento del render (T.2).
      - Convenzione dati motore: il main apre con
        #let data = json("data.json") - TUTTI i parametri passano da data.
      - Template WW-STD-001 "Relazione Win-Win Standard" (categoria
        'relazione'), blocchi library 76-79 legati (seq 10-40).
      - FIX AI BLOCCHI (scritti da memoria, primo render reale li ha
        corretti): quadrante-kairos: dx/dy sono di place() non di rect()
        (place(dx:, dy:, rect(...))); scheda-azione: text(justify) non
        esiste -> par(justify: true). Fix applicati al blocco in library,
        template e motore INTOCCATI: fix centrale, vale ovunque.
      - COLLAUDO OK: erpv6.typst.document id 683, status ready, pdf True.
        Primo PDF composto end-to-end da blocchi library.
LEZIONE  03/09/2026: ~/erpv6-src/odoo-modules NON e' cio' che Odoo carica;
      il runtime legge /mnt/custom-addons nel container - ogni modifica va
      propagata con docker cp PRIMA di -u. Sintomo: upgrade "pulito" ma
      modello nuovo assente (KeyError su env['...']). Anche l'heredoc
      '<< EOF' via incolla si tronca: preferire script via pipe o python.
T.6e  CONSTATATO: PDF collaudo = 3 pagine reali (pypdf nel container),
      come da disegno: copertina / quadrante Kairos / schede azione.
T.6e  CONSTATATO: PDF collaudo = 3 pagine reali (pypdf nel container),
      come da disegno: copertina / quadrante Kairos / schede azione.
T.6d  VERIFICA FINALE 03/09/2026: PDF collaudo estratto su disco host
      (/tmp/winwin_collaudo.pdf, doc id 683, ~24KB). Nota: page_count sul
      modello non viene popolato dal motore (resta 0 anche a render ok) -
      piccolo difetto da sistemare in erpv6_typst quando si tocca quel
      modulo (lettura pagine post-compilazione, es. pypdf).
      Prossimi passi concordati: 1) prodotto 'Relazione Win-Win' in
      erpv6.prodotto.consulenza (3 fasi, fase documento -> WW-STD-001);
      2) ponte sale.order (inesistente, da costruire); 3) sicurezza.
