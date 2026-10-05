// Lettera di presentazione V6 Impresa — 4 varianti.
// 05/10/2026 (C-playbook-3c): template puro, zero AI, zero allucinazione.

#let data = json("data.json")
#let brand = json("brand.json")
#let f(k, d: "-") = data.at(k, default: d)
#let s(k, d: "") = data.at(k, default: d)

#set page(
  paper: "a4",
  margin: (top: 3cm, bottom: 2.5cm, left: 2.5cm, right: 2.5cm),
  numbering: none,
  footer: context [
    #set text(size: 7pt, fill: rgb(brand.secondary_color).lighten(30%))
    #line(length: 100%, stroke: 0.3pt + rgb(brand.secondary_color).lighten(40%))
    #v(0.2em)
    #grid(
      columns: (1fr, auto, 1fr),
      align: (left, center, right),
      [#brand.name · Lettera di presentazione],
      [#brand.website],
      [Pag. #counter(page).display("1 / 1", both: true)],
    )
  ],
)

#set text(size: 10pt, lang: "it", font: ("DejaVu Sans", "New Computer Modern"))
#set par(justify: true, leading: 0.9em)

// Header con logo
#grid(
  columns: (auto, 1fr),
  align: (left, horizon),
  gutter: 1em,
  [#image("logo.png", width: 3.5cm)],
  [
    #align(right)[
      #text(size: 8.5pt, weight: "bold", fill: rgb(brand.primary_color))[#brand.name]
      #linebreak()
      #text(size: 7.5pt, fill: gray)[#brand.tagline]
      #linebreak()
      #text(size: 7pt, fill: gray)[#brand.email]
    ]
  ],
)

#v(1.5cm)

// Luogo e data
#align(right)[
  #f("place_date")
]

#v(1cm)

// Destinatario
#f("recipient_block")

#v(0.8cm)

// Oggetto
#text(weight: "bold")[Oggetto: #f("subject")]

#v(0.6cm)

// Corpo
#s("body")

#v(1cm)

// Firma
#s("signature")

#v(1.5cm)

// Disclaimer riservatezza
#set text(size: 7.5pt, fill: gray)
#line(length: 100%, stroke: 0.3pt + gray)
#v(0.3em)
#text(style: "italic")[
  Le informazioni contenute in questa comunicazione e ogni documento
  allegato sono riservate e destinate esclusivamente al destinatario.
  Ogni divulgazione, copia o utilizzo non autorizzato e' vietato.
]
