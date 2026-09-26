// NCND V6 — Non-Circumvention & Non-Disclosure Agreement
#let data = json("data.json")
#let brand = json("brand.json")

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
#set text(size: 10pt, lang: "it", font: (brand.font_body, "DejaVu Sans"))
#set par(justify: true, leading: 0.78em)

// HEADER
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

// TITOLO
#align(center)[
  #text(size: 9pt, fill: gray, tracking: 0.15em)[ACCORDO DI NON AGGIRAMENTO E RISERVATEZZA]
  #v(0.6em)
  #text(size: 20pt, weight: "bold", fill: rgb(brand.primary_color))[Non-Circumvention & Non-Disclosure]
]
#v(0.3em)
#align(center)[
  #text(size: 8pt, fill: gray)[Data: #data.at("data_generazione", default: "—")]
]
#v(1.5em)

// PARTI
#block(
  fill: rgb(brand.primary_color).lighten(97%),
  inset: 14pt, radius: 6pt,
  stroke: 0.5pt + rgb(brand.secondary_color).lighten(50%),
)[
  #text(size: 8pt, weight: "bold", fill: rgb(brand.secondary_color), tracking: 0.1em)[TRA]
  #v(0.5em)
  *V6 Impresa S.r.l.*, con sede legale in #data.at("v6_sede", default: "[DA COMPILARE]"), C.F./P.IVA #data.at("v6_piva", default: "[DA COMPILARE]"), di seguito *"V6"* o *"Introduttore"*;
  #v(0.6em)
  *E*
  #v(0.6em)
  *#data.at("controparte_nome", default: "—")*, con sede in #data.at("controparte_indirizzo", default: "[da completare]"), C.F./P.IVA #data.at("controparte_piva", default: "[da completare]"), rappresentata da #data.at("controparte_rappresentante", default: "[da completare]"), di seguito *"Controparte"*.
  #v(0.5em)
  di seguito, congiuntamente, le *"Parti"*.
]

#v(1.2em)

// PREMESSE
#text(size: 11pt, weight: "bold", fill: rgb(brand.primary_color))[Premesse]
#v(0.4em)

V6 svolge attività di introduzione commerciale volta a favorire la conoscenza e la possibile collaborazione tra soggetti economici operanti in settori affini. Nell'ambito di tale attività, V6 ha presentato alla Controparte, o si appresta a presentare, determinati soggetti terzi (di seguito *"Soggetti Introdotti"*) in vista di una possibile operazione commerciale.

Le Parti intendono disciplinare:
- gli obblighi di **riservatezza** sulle informazioni scambiate;
- gli obblighi di **non aggiramento** (non-circumvention) a tutela dell'attività di V6;
- il **diritto di V6 alla fee** di introduzione su ogni transazione con i Soggetti Introdotti.

#v(1em)

// 1
#text(size: 11pt, weight: "bold", fill: rgb(brand.primary_color))[1. Informazioni riservate]
#v(0.4em)

Costituiscono "Informazioni Riservate" tutte le informazioni di natura tecnica, commerciale, finanziaria, organizzativa, incluse a titolo esemplificativo: identità e dati di contatto dei Soggetti Introdotti, condizioni economiche, listini, volumi, strategie, metodologie, know-how, dati personali di terzi.

#v(1em)

// 2
#text(size: 11pt, weight: "bold", fill: rgb(brand.primary_color))[2. Obblighi di riservatezza]
#v(0.4em)

La Controparte si impegna a mantenere la massima riservatezza sulle Informazioni Riservate, a non divulgarle a terzi senza consenso scritto di V6, e ad adottare le medesime cautele utilizzate per le proprie informazioni riservate.

#v(1em)

// 3 — NON CIRCUMVENTION (il cuore)
#text(size: 11pt, weight: "bold", fill: rgb(brand.primary_color))[3. Obbligo di non aggiramento (Non-Circumvention)]
#v(0.4em)

La Controparte si obbliga espressamente, per sé e per i propri dipendenti, collaboratori, agenti e società controllate/collegate, a *non contattare, negoziare, intrattenere rapporti commerciali o concludere affari direttamente con i Soggetti Introdotti da V6* in relazione all'operazione oggetto dell'introduzione, senza il preventivo consenso scritto di V6.

#v(0.4em)

L'obbligo si applica anche nel caso in cui la Controparte venga a conoscenza dei Soggetti Introdotti per il tramite di V6 e successivamente li contatti per vie indipendenti.

#v(1em)

// 4 — DIRITTO ALLA FEE
#text(size: 11pt, weight: "bold", fill: rgb(brand.primary_color))[4. Diritto di V6 alla fee di introduzione]
#v(0.4em)

V6 ha diritto alla fee di introduzione pattuita su *tutte le transazioni* concluse dalla Controparte con i Soggetti Introdotti, anche se concluse:
- dopo la scadenza del presente accordo;
- tramite società controllate, collegate o terzi interposti;
- in forme diverse da quella originariamente prospettata.

#v(1em)

// 5 — PENALE
#text(size: 11pt, weight: "bold", fill: rgb(brand.primary_color))[5. Penale per violazione]
#v(0.4em)

In caso di violazione dell'obbligo di cui all'articolo 3, la Controparte si obbliga a corrispondere a V6 una *penale pari a #data.at("penale_importo", default: "[DA DEFINIRE]")* per ogni violazione accertata, salvo il maggior danno.

#v(0.4em)

Il pagamento della penale non esonera la Controparte dall'obbligo di corrispondere a V6 la fee di introduzione di cui all'articolo 4.

#v(1em)

// 6 — DURATA
#text(size: 11pt, weight: "bold", fill: rgb(brand.primary_color))[6. Durata]
#v(0.4em)

Gli obblighi di riservatezza e non aggiramento si protraggono per *5 (cinque) anni* dalla data di sottoscrizione del presente accordo e, per i Soggetti Introdotti, per *5 (cinque) anni* dall'ultima transazione conclusa con ciascuno di essi.

#v(1em)

// 7 — GDPR
#text(size: 11pt, weight: "bold", fill: rgb(brand.primary_color))[7. Protezione dei dati personali (GDPR)]
#v(0.4em)

Le Parti si impegnano a trattare i dati personali in conformità al Regolamento UE 2016/679 (GDPR) e al D.Lgs. 196/2003. Ciascuna Parte agisce come titolare autonomo del trattamento.

#v(1em)

// 8 — FORO
#text(size: 11pt, weight: "bold", fill: rgb(brand.primary_color))[8. Legge applicabile e foro competente]
#v(0.4em)

Il presente accordo è regolato dalla legge italiana. Per ogni controversia sarà competente in via esclusiva il *Foro di Venezia*.

#v(2em)

// FIRME
#grid(
  columns: (1fr, 1fr),
  gutter: 2cm,
  [
    #text(size: 9pt, weight: "bold", fill: rgb(brand.primary_color))[V6 Impresa S.r.l.]
    #v(2.2em)
    #line(length: 100%, stroke: 0.5pt + rgb(brand.primary_color))
    #v(0.3em)
    #text(size: 8pt, fill: gray)[#data.at("v6_rappresentante", default: "Legale Rappresentante")]
  ],
  [
    #text(size: 9pt, weight: "bold", fill: rgb(brand.primary_color))[#data.at("controparte_nome", default: "—")]
    #v(2.2em)
    #line(length: 100%, stroke: 0.5pt + rgb(brand.primary_color))
    #v(0.3em)
    #text(size: 8pt, fill: gray)[#data.at("controparte_rappresentante", default: "Legale Rappresentante")]
  ],
)

#v(2em)
#align(center)[
  #text(size: 7pt, fill: gray)[
    Documento generato da V6 Impresa AI — Hash SHA-256 certificato e ancorato su blockchain. \
    Verifica pubblica: v6impresa.it/verify
  ]
]
