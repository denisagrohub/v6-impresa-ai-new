// Consuntivo Mensile Deal V6 — rev. 2 (blindato)
#let data = json("data.json")
#let brand = json("brand.json")
#let f(k, d: "—") = data.at(k, default: d)
#let is_full = f("show_full_details", d: false)

#set page(
  paper: "a4",
  margin: (top: 3.0cm, bottom: 2.5cm, left: 2.0cm, right: 2.0cm),
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
#v(1.5em)

#align(center)[
  #text(size: 9pt, fill: gray, tracking: 0.15em)[CONSUNTIVO MENSILE]
  #v(0.6em)
  #text(size: 19pt, weight: "bold", fill: rgb(brand.primary_color))[#f("deal_name")]
  #v(0.3em)
  #text(size: 8pt, fill: gray)[Periodo: #f("periodo") · Modello: #f("revenue_model")]
]
#v(1.2em)

// Riquadro dati pubblici: solo in full (self è blindato)
#if is_full {
  block(
    fill: rgb(brand.primary_color).lighten(97%),
    inset: 14pt, radius: 6pt,
    stroke: 0.5pt + rgb(brand.secondary_color).lighten(50%),
  )[
    grid(
      columns: (1fr, 1fr, 1fr),
      gutter: 1em,
      [
        #text(size: 8pt, weight: "bold", fill: rgb(brand.secondary_color), tracking: 0.1em)[QUANTITÀ]
        v(0.3em)
        #(f("quantita") + " " + f("unita"))
      ],
      [
        #text(size: 8pt, weight: "bold", fill: rgb(brand.secondary_color), tracking: 0.1em)[PREZZO MEDIO]
        v(0.3em)
        #(f("prezzo_medio") + " EUR/" + f("unita"))
      ],
      [
        #text(size: 8pt, weight: "bold", fill: rgb(brand.secondary_color), tracking: 0.1em)[FEE APPLICATA]
        v(0.3em)
        #(f("fee_pct") + " %")
      ],
    )
  ]
  v(1.0em)
}

#block(
  fill: rgb(brand.secondary_color).lighten(98%),
  inset: 12pt, radius: 4pt,
)[
  #text(size: 9.5pt)[#f("narrative_plain")]
]
#v(1.2em)

// ═══ SEZIONE COMPENSO ═══
#let comp = f("compenso", d: (:))
#text(size: 12pt, weight: "bold", fill: rgb(brand.primary_color))[Il tuo compenso per questo mese]
#v(0.5em)

#block(
  fill: rgb(brand.primary_color).lighten(94%),
  inset: 14pt, radius: 6pt,
  stroke: 0.5pt + rgb(brand.primary_color).lighten(70%),
  breakable: false,
)[
  #grid(
    columns: (2fr, 1fr),
    align: (left, right),
    gutter: 1em,
    [#text(size: 10pt)[Compenso lordo V6:]], [#text(size: 10pt, weight: "bold")[#comp.at("lordo", default: "—")]],
    [#text(size: 10pt)[IVA:]], [#text(size: 10pt)[#comp.at("iva", default: "—")]],
    [#text(size: 11pt, weight: "bold")[Totale a fatturare:]], [#text(size: 11pt, weight: "bold", fill: rgb(brand.primary_color))[#comp.at("totale", default: "—")]],
    [#text(size: 8pt, style: "italic", fill: gray)[Regime:]], [#text(size: 8pt, style: "italic", fill: gray)[#comp.at("regime_label", default: "—")]],
  )
]
#v(1.2em)

// ═══ COME RICEVERE IL COMPENSO ═══
#let pay = f("payment_info", d: (:))
#pagebreak(weak: true)
#text(size: 12pt, weight: "bold", fill: rgb(brand.primary_color))[Come ricevere il compenso]
#v(0.5em)

#block(
  fill: rgb(brand.secondary_color).lighten(98%),
  inset: 14pt, radius: 6pt,
  stroke: 0.5pt + rgb(brand.secondary_color).lighten(60%),
  breakable: false,
)[
  #text(size: 9pt, weight: "bold")[1. Emetti la fattura intestata a:]
  #v(0.3em)
  #text(size: 9pt)[
    #pay.at("v6_name", default: "V6 Impresa S.r.l.") \
    P.IVA #pay.at("v6_vat", default: "—") \
    #pay.at("v6_address", default: "")
  ]
  #v(0.7em)
  #text(size: 9pt, weight: "bold")[2. Causale da inserire:]
  #v(0.3em)
  #text(size: 9pt, style: "italic")[
    "#comp.at("causale", default: "—")"
  ]
  #v(0.7em)
  #text(size: 9pt, weight: "bold")[3. Invia la fattura a:]
  #v(0.3em)
  #text(size: 9pt)[#pay.at("v6_invoice_email", default: "fatture@v6impresa.it")]
  #v(0.7em)
  #text(size: 9pt, weight: "bold")[4. Pagamento:]
  #v(0.3em)
  #text(size: 9pt)[Entro #str(pay.at("payment_days", default: 30)) giorni dalla ricezione della fattura.]
]
#v(1.2em)

#if is_full {
  text(size: 12pt, weight: "bold", fill: rgb(brand.primary_color))[Ripartizione completa del deal]
  v(0.5em)
  let lines = f("lines", d: ())
  table(
    columns: (2.5fr, 1.2fr, 1.2fr, 1.8fr),
    align: (left, left, right, right),
    stroke: 0.3pt + rgb(brand.secondary_color).lighten(60%),
    inset: 6pt,
    table.header(
      [#text(size: 8pt, weight: "bold")[Partecipante]],
      [#text(size: 8pt, weight: "bold")[Tier]],
      [#text(size: 8pt, weight: "bold")[Quota]],
      [#text(size: 8pt, weight: "bold")[Importo]],
    ),
    ..lines.map(l => (
      [#l.at("partner_name", default: "—")],
      [#l.at("tier", default: "—")],
      [#str(calc.round(l.at("share_pct", default: 0), digits: 2)) + " %"],
      [#str(calc.round(l.at("importo_effettivo", default: 0), digits: 2))],
    )).flatten(),
  )
  v(0.6em)
  block(
    fill: rgb(brand.primary_color).lighten(94%),
    inset: 10pt, radius: 4pt,
  )[
    #grid(
      columns: (2fr, 1fr),
      align: (left, right),
      [#text(size: 9pt)[Transato totale mese:]], [#text(size: 9pt)[#f("transato_totale")]],
      [#text(size: 9pt)[Ricavo lordo V6 (fee):]], [#text(size: 9pt)[#f("ricavo_lordo")]],
      [#text(size: 10pt, weight: "bold")[Netto da ripartire:]], [#text(size: 10pt, weight: "bold")[#f("netto_ripartizione")]],
    )
  ]
}

#let nota = f("nota_mensile", d: "")
#if nota != "" {
  v(1.0em)
  block(
    fill: rgb(brand.secondary_color).lighten(95%),
    inset: 10pt, radius: 4pt,
  )[
    #text(size: 8pt, weight: "bold", tracking: 0.1em)[NOTA DEL MESE]
    v(0.3em)
    #text(size: 9pt)[#nota]
  ]
}

#v(1.5em)
#text(size: 7.5pt, fill: gray)[
  Documento generato automaticamente dal sistema V6. Eventuali variazioni
  saranno oggetto di rivalutazione nel consuntivo successivo.
]
