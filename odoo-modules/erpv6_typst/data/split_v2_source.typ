// Split V6 — rev. 2 (testo Claude, in attesa avvocato)
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
  #text(size: 9pt, fill: gray, tracking: 0.15em)[ACCORDO DI COLLABORAZIONE E RIPARTIZIONE COMPENSI]
  #v(0.6em)
  #text(size: 19pt, weight: "bold", fill: rgb(brand.primary_color))[Accordo Split V6]
  #v(0.3em)
  #text(size: 8pt, fill: gray)[Progetto: #f("progetto_nome", d: "[PROGETTO_NOME]") · rev. 2 · Data: #f("data_stipula", d: "[DATA_STIPULA]")]
]
#v(1.5em)

#block(
  fill: rgb(brand.primary_color).lighten(97%),
  inset: 14pt, radius: 6pt,
  stroke: 0.5pt + rgb(brand.secondary_color).lighten(50%),
)[
  #text(size: 8pt, weight: "bold", fill: rgb(brand.secondary_color), tracking: 0.1em)[TRA]
  #v(0.5em)
  *V6 Impresa S.r.l.*, con sede in #f("v6_sede", d: "[V6_SEDE]"), P.IVA #f("v6_piva", d: "[V6_PIVA]") (di seguito *"Committente"*);
  #v(0.5em)
  *E*
  #v(0.5em)
  *#f("consulente_nome", d: "[CONSULENTE_NOME]")*, residente in #f("consulente_indirizzo", d: "[CONSULENTE_INDIRIZZO]"), C.F. #f("consulente_cf", d: "[CONSULENTE_CF]"), e-mail #f("consulente_email", d: "[CONSULENTE_EMAIL]") (di seguito *"Consulente"*).
]

#v(1.2em)

#text(size: 11pt, weight: "bold", fill: rgb(brand.primary_color))[Art. 1 — Oggetto]
#v(0.4em)

Il Committente affida al Consulente, che accetta, lo svolgimento di attività di consulenza commerciale, di sviluppo di relazioni ("business development") e di supporto alla conclusione di Transazioni relative al progetto #f("progetto_nome", d: "[PROGETTO_NOME]") (il "Progetto"), secondo i termini di cui al presente Accordo. Il rapporto ha natura di lavoro autonomo e non costituisce, in alcun modo, rapporto di lavoro subordinato, di agenzia, di associazione in partecipazione né società, di fatto o di diritto, tra le Parti.

#v(1em)

#text(size: 11pt, weight: "bold", fill: rgb(brand.primary_color))[Art. 2 — Esclusiva e non aggiramento]
#v(0.4em)

*2.1* Il Consulente svolgerà l'attività di cui al presente Accordo in via #f("esclusiva", d: "[ESCLUSIVA/NON ESCLUSIVA]") per il Progetto, salvo diverso accordo scritto.

#v(0.3em)

*2.2* Per tutta la durata del presente Accordo e per i #f("nc_mesi", d: "[NC_MESI]") mesi successivi alla sua cessazione, il Consulente si impegna a non contattare direttamente, per conto proprio o di terzi, i clienti, i partner e i soggetti introdotti nell'ambito del Progetto, al fine di eludere il diritto del Committente alla remunerazione di cui al presente Accordo, fatto salvo quanto diversamente concordato per iscritto. In caso di violazione, si applicano, in quanto compatibili, i rimedi e le penali di cui all'art. 9 dell'Accordo NCND (Documento 2).

#v(1em)

#text(size: 11pt, weight: "bold", fill: rgb(brand.primary_color))[Art. 3 — Canale di comunicazione dedicato al Progetto]
#v(0.4em)

*3.1* Il Consulente si impegna a condurre ogni comunicazione scritta relativa al Progetto, intrattenuta con clienti, partner o soggetti introdotti, mantenendo sempre in copia conoscenza (c.c.) l'indirizzo e-mail dedicato #f("progetto_email", d: "[PROGETTO_EMAIL]"), istituito dal Committente per il presente Progetto.

#v(0.3em)

*3.2* Fatta salva la prova contraria a carico del Consulente, le comunicazioni condotte senza il rispetto di quanto previsto al comma 3.1 si presumono sottratte al controllo del Committente al fine di eludere gli obblighi di cui all'art. 2.2, con le conseguenze ivi previste.

#v(1em)

#text(size: 11pt, weight: "bold", fill: rgb(brand.primary_color))[Art. 4 — Compenso]
#v(0.4em)

*4.1* Il Consulente avrà diritto a un compenso pari al #f("consulente_pct", d: "[CONSULENTE_PCT]")% (la "Quota Consulente") calcolato su #f("base_valore", d: "[BASE_VALORE]") #f("base_unita", d: "[BASE_UNITA]") (la "Base di Calcolo"), per un valore unitario teorico pari a #f("quota_unitaria", d: "[QUOTA_UNITARIA]") #f("base_unita", d: "[BASE_UNITA]") per ciascuna unità/Transazione, fermo restando che al Committente resta riservata una quota non inferiore al #f("riserva_pct", d: "[RISERVA_PCT]")% (la "Riserva Committente") a copertura dei costi di struttura, coordinamento e garanzia contrattuale verso i soggetti introdotti.

#v(0.3em)

*4.2* Il compenso matura al momento del perfezionamento di ciascuna Transazione riferibile al Progetto e alla quale il Consulente abbia contribuito in modo diretto e documentabile.

#v(1em)

#text(size: 11pt, weight: "bold", fill: rgb(brand.primary_color))[Art. 5 — Modalità e tempistica di pagamento]
#v(0.4em)

*5.1* Il compenso sarà corrisposto al Consulente contestualmente all'incasso, da parte del Committente, delle somme relative a ciascuna Transazione, ed entro e non oltre #f("giorni_pagamento_consulente", d: "[GIORNI_PAGAMENTO_CONSULENTE]") giorni lavorativi da tale incasso, previa emissione da parte del Consulente di regolare documento fiscale, nel rispetto della normativa fiscale e previdenziale applicabile.

#v(0.3em)

*5.2* Per le Transazioni di natura continuativa, il Committente fornirà al Consulente, entro il giorno #f("giorno_rendiconto_consulente", d: "[GIORNO_RENDICONTO_CONSULENTE]") di ogni mese, un rendiconto delle somme incassate nel mese precedente relative al Progetto, sulla base del quale sarà calcolato e corrisposto il compenso mensile spettante secondo le modalità di cui al comma 5.1.

#v(0.3em)

*5.3* Nessun compenso sarà dovuto per le Transazioni per le quali il Committente non abbia effettivamente incassato il relativo corrispettivo, fatto salvo il diritto del Consulente al compenso, alle medesime condizioni, a seguito del successivo incasso.

#v(1em)

#text(size: 11pt, weight: "bold", fill: rgb(brand.primary_color))[Art. 6 — Proprietà intellettuale e materiali]
#v(0.4em)

Tutti i materiali, le metodologie, i contatti, i lead, le liste e ogni altro elaborato realizzato o acquisito dal Consulente nello svolgimento dell'incarico restano di esclusiva proprietà del Committente, anche successivamente alla cessazione del presente Accordo; il Consulente non li utilizzerà per finalità diverse da quelle del Progetto né ne tratterrà copia dopo la cessazione del rapporto, fatti salvi gli obblighi di legge.

#v(1em)

#text(size: 11pt, weight: "bold", fill: rgb(brand.primary_color))[Art. 7 — Riservatezza]
#v(0.4em)

Il Consulente si impegna a mantenere riservate tutte le informazioni relative al Progetto, ai clienti e ai partner coinvolti, anche dopo la cessazione del rapporto, per un periodo di 5 (cinque) anni ovvero, per le informazioni che costituiscano segreto commerciale ai sensi degli artt. 98-99 CPI, per tutto il tempo in cui ne permanga il carattere di segretezza.

#v(1em)

#text(size: 11pt, weight: "bold", fill: rgb(brand.primary_color))[Art. 8 — Durata e recesso]
#v(0.4em)

*8.1* Il presente Accordo ha durata #f("durata_accordo", d: "[DURATA_ACCORDO]") dalla data di sottoscrizione e si rinnova tacitamente, salvo disdetta comunicata da una Parte all'altra con preavviso di almeno #f("preavviso_recesso_mesi", d: "[PREAVVISO_RECESSO_MESI]") mesi.

#v(0.3em)

*8.2* Ciascuna Parte potrà recedere anticipatamente con preavviso scritto di almeno #f("preavviso_recesso_mesi", d: "[PREAVVISO_RECESSO_MESI]") mesi, fermo restando il diritto del Consulente al compenso maturato per le Transazioni concluse o in corso fino alla data di efficacia del recesso, e per i #f("tail_consulente_mesi", d: "[TAIL_CONSULENTE_MESI]") mesi successivi per le Transazioni continuative già avviate grazie al suo contributo.

#v(1em)

#text(size: 11pt, weight: "bold", fill: rgb(brand.primary_color))[Art. 9 — Autonomia fiscale e previdenziale]
#v(0.4em)

Il Consulente dichiara di operare quale libero professionista/lavoratore autonomo, munito di partita IVA (se applicabile), e provvederà autonomamente agli adempimenti fiscali, previdenziali e assicurativi connessi alla propria attività, manlevando il Committente da ogni pretesa al riguardo.

#v(1em)

#text(size: 11pt, weight: "bold", fill: rgb(brand.primary_color))[Art. 10 — Accettazione ed efficacia]
#v(0.4em)

Con la sottoscrizione, anche in forma digitale, del presente documento, il Consulente dichiara di aver letto, compreso e integralmente accettato le condizioni sopra riportate, ivi incluse le clausole di cui agli artt. 2, 3, 6 e 7, espressamente approvate ai sensi e per gli effetti degli artt. 1341-1342 c.c. in quanto applicabili.

#v(1em)

#text(size: 11pt, weight: "bold", fill: rgb(brand.primary_color))[Art. 11 — Legge applicabile e Foro competente]
#v(0.4em)

Il presente Accordo è regolato dalla legge italiana; per ogni controversia è competente in via esclusiva il Foro di Venezia.

#v(2em)

#grid(
  columns: (1fr, 1fr),
  gutter: 2cm,
  [
    #text(size: 9pt, weight: "bold", fill: rgb(brand.primary_color))[Il Committente]
    #v(0.3em)
    #text(size: 8pt)[V6 Impresa S.r.l.]
    #v(2em)
    #line(length: 100%, stroke: 0.5pt + rgb(brand.primary_color))
  ],
  [
    #text(size: 9pt, weight: "bold", fill: rgb(brand.primary_color))[Il Consulente]
    #v(0.3em)
    #text(size: 8pt)[#f("consulente_nome", d: "—")]
    #v(2em)
    #line(length: 100%, stroke: 0.5pt + rgb(brand.primary_color))
  ],
)

#v(2em)
#align(center)[
  #text(size: 7pt, fill: gray)[
    Documento generato da V6 Impresa AI — Hash SHA-256 certificato e ancorato su blockchain. \
    Verifica pubblica: v6impresa.it/verify
  ]
]
