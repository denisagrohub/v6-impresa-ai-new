// Playbook Consulente V6 — Export PDF
// 05/10/2026 (C-playbook-3a): copertina + Charter + Scouting + Knowledge.

#let data = json("data.json")
#let brand = json("brand.json")
#let f(k, d: "—") = data.at(k, default: d)
#let s(k, d: "") = data.at(k, default: d)

#set page(
  paper: "a4",
  margin: (top: 2.5cm, bottom: 2.5cm, left: 2.2cm, right: 2.2cm),
  numbering: "1 / 1",
  number-align: center,
  footer: context [
    #set text(size: 7pt, fill: rgb(brand.secondary_color).lighten(30%))
    #line(length: 100%, stroke: 0.3pt + rgb(brand.secondary_color).lighten(40%))
    #v(0.2em)
    #grid(
      columns: (1fr, auto, 1fr),
      align: (left, center, right),
      [#brand.name · Playbook riservato ai consulenti],
      [#brand.website],
      [Pag. #counter(page).display("1 / 1", both: true)],
    )
  ],
)

#set text(size: 9.5pt, lang: "it", font: ("DejaVu Sans", "New Computer Modern"))
#set par(justify: true, leading: 0.85em)
#set heading(numbering: none)

// ─── COPERTINA ───────────────────────────────────────
#page(header: none, footer: none)[
  #v(3cm)
  #grid(
    columns: (auto, 1fr, auto),
    align: (left, horizon, right),
    gutter: 0.8em,
    [#image("logo.png", width: 3.5cm)],
    [],
    [
      #align(right)[
        #text(size: 9pt, weight: "bold", fill: rgb(brand.primary_color))[#brand.name]
        #linebreak()
        #text(size: 8pt, fill: gray)[#brand.tagline]
      ]
    ],
  )

  #v(4cm)

  #align(center)[
    #text(size: 11pt, fill: gray, tracking: 2pt)[PLAYBOOK CONSULENTE]
    #v(0.5cm)
    #text(size: 24pt, weight: "bold", fill: rgb(brand.primary_color))[#f("project_name")]
    #v(0.4cm)
    #text(size: 13pt, fill: gray)[Fase: #f("phase")]
    #v(3cm)
    #text(size: 10pt, fill: gray)[
      Esportato il #f("export_date") \
      da #f("exported_by")
    ]
  ]

  #v(1fr)

  #align(center)[
    #text(size: 7.5pt, fill: gray)[
      Documento interno V6 Impresa · Non condividere all'esterno \
      #brand.email · #brand.website
    ]
  ]
]

// ─── CHARTER ─────────────────────────────────────────
#page[
  #heading(level: 1)[Il progetto]

  #if s("charter").len() > 0 [
    #s("charter")
  ] else [
    #emph[Charter non ancora compilato.]
  ]

  #v(0.5cm)

  #heading(level: 1)[Cosa cerchiamo]

  #if s("pitch_cosa_cerchiamo").len() > 0 [
    #s("pitch_cosa_cerchiamo")
  ] else [
    #emph[Sezione non compilata.]
  ]

  #v(0.3cm)

  #heading(level: 1)[Tipologie target]

  #if s("pitch_tipologie_target").len() > 0 [
    #s("pitch_tipologie_target")
  ] else [
    #emph[Sezione non compilata.]
  ]

  #v(0.3cm)

  #heading(level: 1)[Cosa offriamo]

  #if s("pitch_cosa_offriamo").len() > 0 [
    #s("pitch_cosa_offriamo")
  ] else [
    #emph[Sezione non compilata.]
  ]
]

// ─── SCOUTING ────────────────────────────────────────
#page[
  #heading(level: 1)[Scouting]

  #if s("scouting").len() > 0 [
    #s("scouting")
  ] else [
    #emph[Scouting non ancora compilato.]
  ]
]

// ─── KNOWLEDGE ───────────────────────────────────────
#page[
  #heading(level: 1)[Knowledge]

  #if data.at("knowledge", default: ()).len() == 0 [
    #emph[Nessuna KB collegata al progetto.]
  ] else [
    #for kb in data.knowledge [
      #heading(level: 2)[#kb.name]
      #text(size: 8.5pt, fill: gray)[
        #if kb.at("category", default: "") != "" [#kb.category · ]
        #if kb.at("kb_type", default: "") != "" [#kb.kb_type]
      ]
      #v(0.3cm)
      #text(size: 9pt)[#kb.content]
      #v(0.8cm)
    ]
  ]
]
