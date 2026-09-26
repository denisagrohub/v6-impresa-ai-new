// Contratto Quadro di Introduzione Commerciale V6
#let data = json("data.json")
#let brand = json("brand.json")
#let fee_pagante = data.at("fee_pagante", default: "venditore")

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
  #text(size: 9pt, fill: gray, tracking: 0.15em)[ACCORDO QUADRO DI COLLABORAZIONE COMMERCIALE]
  #v(0.6em)
  #text(size: 20pt, weight: "bold", fill: rgb(brand.primary_color))[Contratto Quadro di Introduzione]
  #v(0.4em)
  #text(size: 11pt, fill: rgb(brand.secondary_color))[Accordo Generale — riutilizzabile per più operazioni]
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
  *V6 Impresa S.r.l.*, con sede legale in #data.at("v6_sede", default: "[DA COMPILARE]"), C.F./P.IVA #data.at("v6_piva", default: "[DA COMPILARE]"), rappresentata da #data.at("v6_rappresentante", default: "[DA COMPILARE]"), di seguito *"V6"* o *"Introduttore"*;
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

A) V6 svolge attività di consulenza commerciale e introduzione tra operatori economici, mettendo in relazione soggetti interessati a concludere operazioni commerciali.

#v(0.3em)

B) La Controparte è interessata a essere messa in contatto con potenziali soggetti terzi (acquirenti, fornitori o partner) nell'ambito della propria attività imprenditoriale.

#v(0.3em)

C) Le Parti intendono disciplinare in via *generale e continuativa* i termini della collaborazione, con riguardo alle modalità di calcolo e corrispettivo dell'attività di introduzione svolta da V6. Le condizioni economiche delle singole operazioni commerciali tra la Controparte e i Soggetti Introdotti saranno definite nei separati accordi tra tali soggetti, che non riguardano V6.

#v(0.3em)

D) Per ogni singola operazione V6 e la Controparte sottoscriveranno una *Scheda di Introduzione* (Allegato A), che individua il Soggetto Introdotto, la tipologia di operazione e la fee applicabile.

#v(1em)

// ART. 1 — OGGETTO
#text(size: 11pt, weight: "bold", fill: rgb(brand.primary_color))[Art. 1 — Oggetto dell'incarico]
#v(0.4em)

La Controparte conferisce a V6, che accetta, l'incarico *generale* di consulenza commerciale e introduzione finalizzato a mettere in contatto la Controparte con potenziali soggetti terzi (di seguito *"Soggetti Introdotti"*) interessati a concludere operazioni commerciali con la Controparte.

V6 agisce in qualità di *consulente commerciale* e *introduttore*, in piena autonomia e senza vincoli di subordinazione, dipendenza o rappresentanza. Il presente accordo non configura in alcun modo un rapporto di mediazione né di agenzia.

#v(1em)

// ART. 2 — MODALITÀ DI SVOLGIMENTO
#text(size: 11pt, weight: "bold", fill: rgb(brand.primary_color))[Art. 2 — Modalità di svolgimento dell'attività]
#v(0.4em)

V6 si impegna a svolgere l'attività di introduzione con diligenza professionale, presentando alla Controparte i Soggetti Introdotti ritenuti idonei e fornendo le informazioni necessarie a valutare la possibile operazione.

Per ogni Soggetto Introdotto, le Parti sottoscrivono una *Scheda di Introduzione* (Allegato A) che riporta: identità del Soggetto Introdotto, tipologia di operazione prospettata, fee applicabile e parte tenuta al pagamento.

Le *condizioni economiche delle singole operazioni commerciali* tra Controparte e Soggetti Introdotti (prezzo, quantità, modalità di pagamento, durata) sono definite negli accordi che tali soggetti sottoscriveranno tra loro, al di fuori del presente accordo. V6 non è parte di tali accordi e non assume alcun obbligo relativamente alla loro conclusione.

#v(1em)

// ART. 3 — FEE DI INTRODUZIONE
#text(size: 11pt, weight: "bold", fill: rgb(brand.primary_color))[Art. 3 — Fee di introduzione]
#v(0.4em)

Per ciascuna operazione conclusa tra la Controparte e un Soggetto Introdotto presentato da V6, V6 ha diritto a una *fee di introduzione* calcolata secondo i termini indicati nella relativa *Scheda di Introduzione* (Allegato A).

#if fee_pagante == "venditore" [
  La fee è a *carico esclusivo della Controparte* (in qualità di venditore).
] else if fee_pagante == "acquirente" [
  La fee è a *carico esclusivo del Soggetto Introdotto* (in qualità di acquirente), secondo quanto previsto nel separato accordo tra V6 e il Soggetto Introdotto.
] else if fee_pagante == "entrambi" [
  La fee è ripartita *tra la Controparte e il Soggetto Introdotto* secondo le percentuali indicate nella Scheda di Introduzione.
] else [
  Le modalità di ripartizione della fee sono indicate nella Scheda di Introduzione.
]

#v(0.5em)

Salvo diverso accordo scritto nella singola Scheda di Introduzione, la fee è calcolata come *percentuale sull'importo effettivo delle transazioni* concluse tra la Controparte e i Soggetti Introdotti.

La fee si intende dovuta su *tutte le transazioni* concluse con i Soggetti Introdotti, anche se concluse in forme diverse da quella originariamente prospettata, tramite società controllate/collegate o terzi interposti, o dopo la scadenza del presente accordo — purché il Soggetto Introdotto sia stato presentato da V6 durante la vigenza del contratto e risulti da una Scheda di Introduzione sottoscritta.

#v(1em)

// ART. 4 — MODALITÀ DI PAGAMENTO
#text(size: 11pt, weight: "bold", fill: rgb(brand.primary_color))[Art. 4 — Modalità di pagamento]
#v(0.4em)

La fee è corrisposta a V6 dietro emissione di regolare fattura, secondo le modalità e i tempi indicati nella Scheda di Introduzione.

La Controparte si impegna a comunicare a V6, entro 5 (cinque) giorni lavorativi, la conclusione di ogni transazione con i Soggetti Introdotti, indicando l'importo, la data e le modalità di pagamento.

#v(1em)

// ART. 5 — DURATA E RINNOVO
#text(size: 11pt, weight: "bold", fill: rgb(brand.primary_color))[Art. 5 — Durata e rinnovo]
#v(0.4em)

Il presente accordo ha durata di *#data.at("durata_mesi", default: "24") mesi* a decorrere dalla data di sottoscrizione, con *rinnovo automatico* per uguale periodo, salvo disdetta di una delle Parti da comunicarsi per iscritto almeno 60 (sessanta) giorni prima della scadenza.

Le Schede di Introduzione sottoscritte durante la vigenza del contratto restano valide anche dopo la scadenza del contratto quadro, per il tempo necessario all'esecuzione delle operazioni in esse indicate e per i successivi *24 mesi*, ai fini del diritto di V6 alla fee.

#v(1em)

// ART. 6 — ESCLUSIONI
#text(size: 11pt, weight: "bold", fill: rgb(brand.primary_color))[Art. 6 — Esclusioni]
#v(0.4em)

Non rientrano nell'oggetto del presente accordo:
#list(
  [i rapporti commerciali tra la Controparte e soggetti già in contatto prima dell'introduzione da parte di V6, purché documentati per iscritto alla data della Scheda di Introduzione;],
  [le operazioni già in corso tra la Controparte e terzi al momento della sottoscrizione del presente accordo.]
)

#v(1em)

// ART. 7 — AUTONOMIA DELLE PARTI
#text(size: 11pt, weight: "bold", fill: rgb(brand.primary_color))[Art. 7 — Autonomia delle Parti]
#v(0.4em)

Il presente accordo non configura alcun rapporto di società, associazione, lavoro subordinato o agenzia tra le Parti. Ciascuna Parte opera in piena autonomia imprenditoriale.

V6 non assume alcuna obbligazione in merito alla conclusione delle operazioni con i Soggetti Introdotti, che restano nella piena disponibilità negoziale delle Parti interessate.

#v(1em)

// ART. 8 — RISERVATEZZA
#text(size: 11pt, weight: "bold", fill: rgb(brand.primary_color))[Art. 8 — Riservatezza e non aggiramento]
#v(0.4em)

Per gli obblighi di riservatezza e non aggiramento si fa espresso rinvio al separato accordo *NCND* sottoscritto tra le Parti, che si intende parte integrante del presente accordo.

#v(1em)

// ART. 9 — GDPR
#text(size: 11pt, weight: "bold", fill: rgb(brand.primary_color))[Art. 9 — Protezione dei dati personali (GDPR)]
#v(0.4em)

Le Parti si impegnano a trattare i dati personali eventualmente comunicati in conformità al Regolamento UE 2016/679 (GDPR) e al D.Lgs. 196/2003. Ciascuna Parte agisce in qualità di titolare autonomo del trattamento.

#v(1em)

// ART. 10 — LEGGE E FORO
#text(size: 11pt, weight: "bold", fill: rgb(brand.primary_color))[Art. 10 — Legge applicabile e foro competente]
#v(0.4em)

Il presente accordo è regolato dalla legge italiana. Per ogni controversia sarà competente in via esclusiva il *Foro di Venezia*.

#v(1.5em)

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

#v(1.5em)
#line(length: 100%, stroke: 0.5pt + rgb(brand.secondary_color).lighten(50%))
#v(0.5em)

// ALLEGATO A — template scheda di introduzione
#text(size: 10pt, weight: "bold", fill: rgb(brand.primary_color))[Allegato A — Scheda di Introduzione]
#v(0.3em)

#text(size: 8pt, fill: gray)[
  La presente Scheda è sottoscritta separatamente per ogni Soggetto Introdotto.
  Contiene i dati specifici dell'operazione e i termini della fee V6.
  Costituisce parte integrante del Contratto Quadro di Introduzione.
]

#v(0.8em)

#block(
  inset: 12pt, radius: 4pt,
  stroke: 0.5pt + rgb(brand.secondary_color).lighten(50%),
)[
  *Scheda n.* #data.at("scheda_numero", default: "___") *del* #data.at("scheda_data", default: "___________")

  #v(0.5em)

  *Soggetto Introdotto:* #data.at("scheda_soggetto", default: "________________________________________")

  #v(0.3em)

  *Tipologia operazione:* #data.at("scheda_operazione", default: "________________________________________")

  #v(0.3em)

  *Fee applicabile:* #data.at("scheda_fee", default: "___")% sull'importo delle transazioni concluse

  #v(0.3em)

  *Parte tenuta al pagamento:* #data.at("scheda_pagante", default: "venditore / acquirente / entrambi")

  #v(0.3em)

  *Modalità e tempi di pagamento:* #data.at("scheda_modalita", default: "________________________________________")

  #v(0.3em)

  *Note:* #data.at("scheda_note", default: "________________________________________")

  #v(1em)

  #grid(
    columns: (1fr, 1fr),
    gutter: 1.5cm,
    [
      #text(size: 8pt, fill: gray)[V6 Impresa S.r.l.]
      #v(1.5em)
      #line(length: 100%, stroke: 0.5pt + rgb(brand.primary_color))
    ],
    [
      #text(size: 8pt, fill: gray)[#data.at("controparte_nome", default: "Controparte")]
      #v(1.5em)
      #line(length: 100%, stroke: 0.5pt + rgb(brand.primary_color))
    ],
  )
]

#v(2em)
#align(center)[
  #text(size: 7pt, fill: gray)[
    Documento generato da V6 Impresa AI — Hash SHA-256 certificato e ancorato su blockchain. \
    Verifica pubblica: v6impresa.it/verify
  ]
]
