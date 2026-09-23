// Accordo Split V6 — Consulente
// Template Typst generato da erpv6.tracking.relation.action_send_split_to_sign()
#let data = json("data.json")

#set page(paper: "a4", margin: (top: 2cm, bottom: 2cm, left: 2cm, right: 2cm), numbering: "1")
#set text(size: 10pt, lang: "it", font: ("Inter", "Noto Sans", "DejaVu Sans"))
#set par(justify: true, leading: 0.75em)

// HEADER
#grid(
  columns: (1fr, auto),
  align: (left, right),
  [
    #text(size: 9pt, weight: "bold", fill: rgb("#0f172a"))[V6 IMPRESA]
    #linebreak()
    #text(size: 8pt, fill: gray)[Consulenza B2B · v6impresa.it]
  ],
  [#text(size: 8pt, fill: gray)[#data.at("data_generazione", default: "-")]],
)
#v(0.5em)
#line(length: 100%, stroke: 1pt + rgb("#1a7fa8"))
#v(1.5em)

#align(center)[
  #text(size: 16pt, weight: "bold", fill: rgb("#0f172a"))[ACCORDO DI SPLIT V6]
  #v(0.3em)
  #text(size: 11pt, fill: gray)[Progetto: #data.at("progetto_nome", default: "-")]
]
#v(1.5em)

// PARTI
#block(fill: rgb("#f8fafc"), inset: 12pt, radius: 4pt, stroke: 0.5pt + rgb("#e2e8f0"))[
  *TRA*

  *V6 Impresa S.r.l.*, con sede legale in #data.at("v6_sede", default: "[DA COMPILARE]"), C.F./P.IVA #data.at("v6_piva", default: "[DA COMPILARE]"), di seguito *"Committente"*;

  #v(0.5em)
  *E*

  #data.at("consulente_nome", default: "-"), con residenza in #data.at("consulente_indirizzo", default: "[da completare]"),
  C.F. #data.at("consulente_cf", default: "[da completare]"),
  #if data.at("consulente_piva", default: "") != "" [P.IVA #data.at("consulente_piva"), ]
  e-mail #data.at("consulente_email", default: "-"), di seguito *"Consulente"*.

  #v(0.5em)
  di seguito, congiuntamente, le *"Parti"*.
]

#v(1em)

// OGGETTO
#text(size: 11pt, weight: "bold", fill: rgb("#0f172a"))[1. Oggetto]
#v(0.3em)

Il Committente affida al Consulente l'attività di consulenza commerciale relativa al progetto *#data.at("progetto_nome", default: "-")*, alle condizioni economiche di seguito indicate.

#v(0.8em)

// COMPENSO
#text(size: 11pt, weight: "bold", fill: rgb("#0f172a"))[2. Compenso]
#v(0.3em)

#block(fill: rgb("#ecfeff"), inset: 10pt, radius: 4pt, stroke: 0.5pt + rgb("#67e8f9"))[
  *Quota Consulente:* #data.at("consulente_pct", default: "0")%

  #v(0.3em)
  *Base di calcolo:* #data.at("base_valore", default: "0") #data.at("base_unita", default: "EUR") #if data.at("base_tipo", default: "") == "percentuale" [sul valore contrattuale]

  #v(0.3em)
  *Quota teorica per unità:* #data.at("quota_unitaria", default: "0") #data.at("base_unita", default: "EUR")

  #v(0.3em)
  *Riserva V6:* #data.at("riserva_pct", default: "0")%
]

#v(0.8em)

// EROGAZIONE
#text(size: 11pt, weight: "bold", fill: rgb("#0f172a"))[3. Modalità di pagamento]
#v(0.3em)

Il compenso sarà riconosciuto al Consulente contestualmente alla chiusura di ogni transazione sul progetto, dietro emissione di regolare documento fiscale. Il presente accordo non costituisce rapporto di lavoro subordinato né società tra le Parti.

#v(0.8em)

// RISERVATEZZA
#text(size: 11pt, weight: "bold", fill: rgb("#0f172a"))[4. Riservatezza]
#v(0.3em)

Il Consulente si impegna a mantenere riservate tutte le informazioni relative al progetto, ai clienti e ai partner coinvolti, anche dopo la cessazione del rapporto.

#v(0.8em)

// ACCETTAZIONE
#text(size: 11pt, weight: "bold", fill: rgb("#0f172a"))[5. Accettazione]
#v(0.3em)

Con la firma digitale del presente documento, il Consulente dichiara di aver letto e accettato integralmente le condizioni sopra riportate.

#v(1.5em)

#grid(
  columns: (1fr, 1fr),
  gutter: 1.5cm,
  [
    *Il Committente*
    #v(2em)
    #text(fill: gray, size: 8pt)[V6 Impresa S.r.l.]
  ],
  [
    *Il Consulente*
    #v(2em)
    #data.at("consulente_nome", default: "")
  ],
)

#v(2em)
#line(length: 100%, stroke: 0.5pt + rgb("#e2e8f0"))
#v(0.5em)
#align(center)[
  #text(size: 7pt, fill: gray)[
    Documento generato da V6 Impresa AI — Hash SHA-256 certificato e ancorato su blockchain.
    Verifica pubblica: v6impresa.it/verify
  ]
]
