// NDA V6 — rev. 2 (testo Claude, in attesa avvocato)
#let data = json("data.json")
#let brand = json("brand.json")
#let f(k, d: "—") = data.at(k, default: d)

#set page(
  paper: "a4",
  margin: (top: 3.2cm, bottom: 2.5cm, left: 2.2cm, right: 2.2cm),
  numbering: "1 / 1",
  number-align: center,
  footer: context [
    #set text(size: 7pt, fill: rgb(brand.primary_color).lighten(40%))
    #line(length: 100%, stroke: 0.3pt + rgb(brand.secondary_color).lighten(30%))
    #v(0.2em)
    #grid(
      columns: (1fr, auto, 1fr),
      align: (left, center, right),
      [#brand.name · #brand.email],
      [#brand.website],
      [Pag. #counter(page).display("1 / 1", both: true)],
    )
  ],
)
#set text(size: 9.5pt, lang: "it", font: ("DejaVu Sans", "New Computer Modern"))
#set par(justify: true, leading: 0.78em)

#grid(
  columns: (auto, 1fr, auto),
  align: (left, horizon, right),
  gutter: 0.8em,
  [#image("logo.png", width: 3.2cm)],
  [],
  [
    #align(right)[
      #text(size: 8.5pt, weight: "bold", fill: rgb(brand.primary_color))[#brand.name]
      #linebreak()
      #text(size: 7.5pt, fill: gray)[#brand.tagline]
      #linebreak()
      #text(size: 7pt, fill: gray)[#brand.website]
    ]
  ],
)
#v(0.4em)
#line(length: 100%, stroke: 1.5pt + rgb(brand.secondary_color))
#v(1.8em)

#align(center)[
  #text(size: 9pt, fill: gray, tracking: 0.15em)[NON-DISCLOSURE AGREEMENT]
  #v(0.6em)
  #text(size: 19pt, weight: "bold", fill: rgb(brand.primary_color))[Accordo di Riservatezza]
  #v(0.3em)
  #text(size: 8pt, fill: gray)[Data: #f("data_stipula", d: "[DATA_STIPULA]") · rev. 2]
]
#v(1.5em)

#block(
  fill: rgb(brand.primary_color).lighten(97%),
  inset: 14pt, radius: 6pt,
  stroke: 0.5pt + rgb(brand.secondary_color).lighten(50%),
)[
  #text(size: 8pt, weight: "bold", fill: rgb(brand.secondary_color), tracking: 0.1em)[TRA]
  #v(0.5em)
  *V6 Impresa S.r.l.*, con sede legale in #f("v6_sede", d: "[V6_SEDE]"), iscritta al Registro delle Imprese di #f("v6_ri", d: "[V6_RI]") al n. #f("v6_piva", d: "[V6_PIVA]"), C.F./P.IVA #f("v6_piva", d: "[V6_PIVA]"), in persona del legale rappresentante pro tempore #f("v6_rappresentante", d: "[V6_RAPPRESENTANTE]") (di seguito *"V6"*);
  #v(0.5em)
  *E*
  #v(0.5em)
  *#f("controparte_nome", d: "[CONTROPARTE_NOME]")*, con sede/residenza in #f("controparte_indirizzo", d: "[CONTROPARTE_INDIRIZZO]"), C.F./P.IVA #f("controparte_piva", d: "[CONTROPARTE_PIVA]"), in persona di #f("controparte_rappresentante", d: "[CONTROPARTE_RAPPRESENTANTE]") (di seguito *"Controparte"*);
]

#v(0.5em)
#align(center)[#text(size: 8pt, fill: gray)[(V6 e Controparte, congiuntamente, le "Parti"; ciascuna, una "Parte")]]

#v(1.2em)

#text(size: 11pt, weight: "bold", fill: rgb(brand.primary_color))[Premesso che]
#v(0.4em)

(a) le Parti intendono valutare una possibile collaborazione commerciale, industriale o professionale avente ad oggetto #f("oggetto_collaborazione", d: "[OGGETTO_COLLABORAZIONE]") (la "Collaborazione");

#v(0.3em)

(b) nell'ambito di tale valutazione, ciascuna Parte potrà avere accesso a informazioni riservate dell'altra Parte;

#v(0.3em)

(c) le Parti intendono regolare i termini e le condizioni per la protezione di tali informazioni, nonché un canale di comunicazione dedicato che ne agevoli la tracciabilità.

#v(0.3em)

Tutto ciò premesso, si conviene quanto segue.

#v(1em)

#text(size: 11pt, weight: "bold", fill: rgb(brand.primary_color))[Art. 1 — Premesse e allegati]
#v(0.4em)

Le premesse e gli eventuali allegati costituiscono parte integrante e sostanziale del presente Accordo.

#v(1em)

#text(size: 11pt, weight: "bold", fill: rgb(brand.primary_color))[Art. 2 — Definizione di Informazioni Riservate]
#v(0.4em)

*2.1* Per "Informazioni Riservate" si intende qualunque informazione, dato, documento o materiale — di natura tecnica, industriale, commerciale, finanziaria, organizzativa, strategica, legale o di altra natura — comunicato da una Parte (la "Parte Divulgante") all'altra (la "Parte Ricevente"), in forma orale, scritta, elettronica, grafica o comunque percepibile, ivi inclusi a titolo esemplificativo e non esaustivo: dati su clienti e potenziali clienti, fornitori, partner commerciali; listini e condizioni economiche; piani industriali e strategie commerciali; know-how, metodologie, processi, formule, ricette, disegni, software, banche dati; dati personali di terzi ai sensi del Regolamento UE 2016/679.

#v(0.3em)

*2.2* Le Informazioni Riservate si considerano tali anche se comunicate senza alcuna dicitura di riservatezza, quando la loro natura riservata sia ragionevolmente desumibile dal contesto o dal contenuto.

#v(0.3em)

*2.3* Costituisce Informazione Riservata anche l'esistenza stessa e il contenuto delle trattative relative alla Collaborazione.

#v(1em)

#text(size: 11pt, weight: "bold", fill: rgb(brand.primary_color))[Art. 3 — Obblighi della Parte Ricevente]
#v(0.4em)

La Parte Ricevente si impegna a: a) mantenere la massima riservatezza sulle Informazioni Riservate, con un grado di diligenza non inferiore a quello adottato per le proprie informazioni di analoga rilevanza, e comunque non inferiore alla diligenza ordinaria richiesta dalla natura dell'attività (art. 1176, comma 2, c.c.); b) utilizzare le Informazioni Riservate esclusivamente ai fini della valutazione e dell'eventuale esecuzione della Collaborazione, e non per finalità concorrenziali o comunque diverse ("Divieto di Uso Improprio"); c) non divulgare, riprodurre, trascrivere o comunicare le Informazioni Riservate a terzi, in tutto o in parte, senza il preventivo consenso scritto della Parte Divulgante; d) limitare l'accesso alle Informazioni Riservate ai propri dipendenti, collaboratori, consulenti e amministratori che ne abbiano effettiva necessità, previa sottoscrizione da parte di questi ultimi di un impegno di riservatezza sostanzialmente equivalente, di cui la Parte Ricevente resta comunque responsabile in solido; e) informare senza ritardo la Parte Divulgante di ogni violazione, sospetta violazione, smarrimento o accesso non autorizzato di cui venga a conoscenza, adottando ogni misura idonea a limitarne le conseguenze.

#v(1em)

#text(size: 11pt, weight: "bold", fill: rgb(brand.primary_color))[Art. 4 — Esclusioni]
#v(0.4em)

Non costituiscono Informazioni Riservate le informazioni che la Parte Ricevente dimostri documentalmente: (a) essere o essere divenute di pubblico dominio senza violazione del presente Accordo; (b) essere già in proprio legittimo possesso, senza vincoli di riservatezza, prima della comunicazione; (c) essere state sviluppate autonomamente, senza utilizzo delle Informazioni Riservate, da personale che non vi abbia avuto accesso; (d) essere state lecitamente ricevute da un terzo non vincolato da obblighi di riservatezza; (e) dover essere divulgate per obbligo di legge o provvedimento di un'autorità competente, fermo restando che la Parte Ricevente dovrà, ove legalmente possibile, darne preventiva comunicazione alla Parte Divulgante e limitare la divulgazione a quanto strettamente richiesto.

#v(1em)

#text(size: 11pt, weight: "bold", fill: rgb(brand.primary_color))[Art. 5 — Durata degli obblighi di riservatezza]
#v(0.4em)

*5.1* Il presente Accordo ha efficacia dalla Data di Stipula e per la durata delle trattative relative alla Collaborazione.

#v(0.3em)

*5.2* Gli obblighi di riservatezza e di non uso di cui all'art. 3 permangono per 5 (cinque) anni dalla data di ciascuna comunicazione delle relative Informazioni Riservate.

#v(0.3em)

*5.3* In deroga al comma precedente, per le Informazioni Riservate che integrino segreti commerciali ai sensi degli artt. 98 e 99 del Codice della Proprietà Industriale (D.Lgs. 30/2005), gli obblighi permangono per tutto il tempo in cui tali informazioni conservino carattere di segretezza, indipendentemente dal termine di cui al comma 5.2.

#v(1em)

#text(size: 11pt, weight: "bold", fill: rgb(brand.primary_color))[Art. 6 — Non sollecitazione (Non-Solicitation)]
#v(0.4em)

*6.1* Per tutta la durata del presente Accordo e per i 24 (ventiquattro) mesi successivi alla sua cessazione, ciascuna Parte si impegna a non sollecitare, direttamente o indirettamente, dipendenti, collaboratori o consulenti chiave dell'altra Parte coinvolti nella Collaborazione, né a distogliere, per finalità concorrenti, i soggetti terzi reciprocamente presentati nell'ambito della stessa.

#v(0.3em)

*6.2* In caso di violazione, la Parte inadempiente corrisponderà all'altra, a titolo di penale, l'importo di #f("penale_non_sollecitazione", d: "[PENALE_NON_SOLLECITAZIONE]"), fatto salvo il risarcimento del maggior danno.

#v(1em)

#text(size: 11pt, weight: "bold", fill: rgb(brand.primary_color))[Art. 7 — Rimedi in caso di violazione]
#v(0.4em)

*7.1* Le Parti riconoscono che la violazione degli obblighi di riservatezza può cagionare un danno grave e non adeguatamente ristorabile per equivalente monetario. La Parte Divulgante avrà pertanto diritto di richiedere, in via cautelare e d'urgenza, l'inibitoria della condotta illecita e ogni provvedimento idoneo a farne cessare gli effetti (artt. 700 e ss. c.p.c.), oltre al risarcimento del danno.

#v(0.3em)

*7.2* In caso di violazione degli obblighi di cui all'art. 3, la Parte inadempiente corrisponderà alla Parte Divulgante, a titolo di penale per ogni violazione accertata, l'importo di #f("penale_riservatezza", d: "[PENALE_RISERVATEZZA]"), fatto salvo il risarcimento dell'eventuale maggior danno e il rimborso delle spese legali sostenute per l'accertamento e la repressione della violazione.

#v(1em)

#text(size: 11pt, weight: "bold", fill: rgb(brand.primary_color))[Art. 8 — Protezione dei dati personali (GDPR)]
#v(0.4em)

*8.1* Le Parti si impegnano a trattare i dati personali eventualmente comunicati in conformità al Regolamento UE 2016/679 (GDPR) e al D.Lgs. 196/2003 e s.m.i.

#v(0.3em)

*8.2* Ciascuna Parte agisce quale autonomo titolare del trattamento per le finalità del presente Accordo, adottando misure tecniche e organizzative adeguate e conservando i dati per il tempo strettamente necessario.

#v(0.3em)

*8.3* Ove necessario in ragione delle specifiche modalità di trattamento, le Parti si impegnano a sottoscrivere apposito accordo di nomina a responsabile del trattamento ex art. 28 GDPR.

#v(1em)

#text(size: 11pt, weight: "bold", fill: rgb(brand.primary_color))[Art. 9 — Restituzione o distruzione delle Informazioni Riservate]
#v(0.4em)

Su richiesta scritta della Parte Divulgante, e in ogni caso al termine delle trattative, la Parte Ricevente restituirà o distruggerà, a scelta della Parte Divulgante, tutte le Informazioni Riservate ricevute, comprese le copie, entro 10 (dieci) giorni lavorativi dalla richiesta, fornendo conferma scritta. Resta salva la facoltà di conservare copia ove richiesto da obblighi di legge o da policy interne di conservazione documentale, fermi restando gli obblighi di riservatezza.

#v(1em)

#text(size: 11pt, weight: "bold", fill: rgb(brand.primary_color))[Art. 10 — Nessun obbligo di contrarre; nessuna licenza]
#v(0.4em)

*10.1* Nessuna disposizione del presente Accordo obbliga le Parti a concludere la Collaborazione.

#v(0.3em)

*10.2* Nessuna disposizione del presente Accordo concede, implicitamente o esplicitamente, alcuna licenza o diritto di proprietà intellettuale/industriale sulle Informazioni Riservate, che restano di esclusiva proprietà della Parte Divulgante.

#v(1em)

#text(size: 11pt, weight: "bold", fill: rgb(brand.primary_color))[Art. 11 — Canale di comunicazione dedicato al Progetto]
#v(0.4em)

*11.1* Le Parti convengono che ogni comunicazione operativa relativa alla Collaborazione — scambi informativi, bozze contrattuali, corrispondenza negoziale, condivisione di documenti — dovrà essere inviata mantenendo in copia conoscenza (c.c.) l'indirizzo e-mail dedicato al progetto #f("progetto_email", d: "[PROGETTO_EMAIL]"), appositamente istituito per la presente Collaborazione, al fine di garantire tracciabilità e reciproca conoscenza dello stato delle trattative.

#v(0.3em)

*11.2* L'omesso inoltro in copia di una singola comunicazione non ne pregiudica di per sé la validità tra le Parti, ma potrà essere valutato, in caso di controversia relativa al presente Accordo, quale elemento indiziario a sfavore della Parte che se ne sia sistematicamente discostata.

#v(1em)

#text(size: 11pt, weight: "bold", fill: rgb(brand.primary_color))[Art. 12 — Disposizioni generali]
#v(0.4em)

*12.1 Comunicazioni formali:* ogni comunicazione relativa al presente Accordo (recessi, diffide, richieste ex art. 9) dovrà essere effettuata per iscritto a mezzo PEC ai seguenti indirizzi — V6: #f("v6_pec", d: "[V6_PEC]"); Controparte: #f("controparte_pec", d: "[CONTROPARTE_PEC]") — fermo restando quanto previsto all'art. 11 per le comunicazioni operative.

#v(0.3em)

*12.2 Cessione:* il presente Accordo non può essere ceduto senza il preventivo consenso scritto dell'altra Parte, salvo cessione a società controllanti, controllate o collegate, o in caso di fusione, scissione o cessione d'azienda.

#v(0.3em)

*12.3 Modifiche:* ogni modifica dovrà avvenire in forma scritta, a pena di nullità.

#v(0.3em)

*12.4 Invalidità parziale:* l'eventuale invalidità di una o più clausole non comporta l'invalidità dell'intero Accordo; le Parti sostituiranno la clausola invalida con altra che ne persegua, per quanto possibile, le medesime finalità.

#v(0.3em)

*12.5 Intera intesa:* il presente Accordo costituisce la manifestazione integrale della volontà delle Parti in relazione al proprio oggetto e sostituisce ogni precedente accordo o intesa avente il medesimo oggetto.

#v(1em)

#text(size: 11pt, weight: "bold", fill: rgb(brand.primary_color))[Art. 13 — Legge applicabile e Foro competente]
#v(0.4em)

*13.1* Il presente Accordo è regolato dalla legge italiana.

#v(0.3em)

*13.2* Le Parti tenteranno in buona fede una composizione amichevole di ogni controversia. In difetto di composizione entro 30 (trenta) giorni dalla comunicazione scritta della controversia, sarà competente in via esclusiva il Foro di Venezia, fatta salva la facoltà di V6 di adire, per le sole azioni cautelari e inibitorie di cui all'art. 7, qualsiasi foro competente per legge.

#v(2em)

#grid(
  columns: (1fr, 1fr),
  gutter: 2cm,
  [
    #text(size: 9pt, weight: "bold", fill: rgb(brand.primary_color))[V6 Impresa S.r.l.]
    #v(2.2em)
    #line(length: 100%, stroke: 0.5pt + rgb(brand.primary_color))
    #v(0.3em)
    #text(size: 8pt, fill: gray)[#f("v6_rappresentante", d: "Legale Rappresentante")]
  ],
  [
    #text(size: 9pt, weight: "bold", fill: rgb(brand.primary_color))[#f("controparte_nome", d: "Controparte")]
    #v(2.2em)
    #line(length: 100%, stroke: 0.5pt + rgb(brand.primary_color))
    #v(0.3em)
    #text(size: 8pt, fill: gray)[#f("controparte_rappresentante", d: "Legale Rappresentante")]
  ],
)

#v(2em)
#align(center)[
  #text(size: 7pt, fill: gray)[
    Documento generato da V6 Impresa AI — Hash SHA-256 certificato e ancorato su blockchain. \
    Verifica pubblica: v6impresa.it/verify
  ]
]
