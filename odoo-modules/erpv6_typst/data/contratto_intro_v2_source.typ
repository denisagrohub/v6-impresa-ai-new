// Contratto Quadro Introduzione V6 — rev. 2 (testo Claude, in attesa avvocato)
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
  #text(size: 9pt, fill: gray, tracking: 0.15em)[ACCORDO QUADRO DI COLLABORAZIONE COMMERCIALE]
  #v(0.6em)
  #text(size: 19pt, weight: "bold", fill: rgb(brand.primary_color))[Contratto Quadro di Introduzione]
  #v(0.3em)
  #text(size: 8pt, fill: gray)[rev. 2 · Data: #f("data_stipula", d: "[DATA_STIPULA]")]]
#v(1.5em)

#block(
  fill: rgb(brand.primary_color).lighten(97%),
  inset: 14pt, radius: 6pt,
  stroke: 0.5pt + rgb(brand.secondary_color).lighten(50%),
)[
  #text(size: 8pt, weight: "bold", fill: rgb(brand.secondary_color), tracking: 0.1em)[TRA]
  #v(0.5em)
  *V6 Impresa S.r.l.*, con sede legale in #f("v6_sede", d: "[V6_SEDE]"), C.F./P.IVA #f("v6_piva", d: "[V6_PIVA]"), rappresentata da #f("v6_rappresentante", d: "[V6_RAPPRESENTANTE]") (di seguito *"V6"* o *"Introduttore"*);
  #v(0.5em)
  *E*
  #v(0.5em)
  *#f("controparte_nome", d: "[CONTROPARTE_NOME]")*, con sede in #f("controparte_indirizzo", d: "[CONTROPARTE_INDIRIZZO]"), C.F./P.IVA #f("controparte_piva", d: "[CONTROPARTE_PIVA]"), rappresentata da #f("controparte_rappresentante", d: "[CONTROPARTE_RAPPRESENTANTE]") (di seguito *"Controparte"*).
]
#v(0.5em)
#align(center)[#text(size: 8pt, fill: gray)[(V6 e Controparte, congiuntamente, le "Parti")]]
#v(1.2em)

#text(size: 11pt, weight: "bold", fill: rgb(brand.primary_color))[Premesse]
#v(0.4em)

A) V6 svolge attività di consulenza commerciale e introduzione tra operatori economici, mettendo in relazione soggetti interessati a concludere operazioni commerciali.

#v(0.3em)

B) La Controparte è interessata a essere messa in contatto con potenziali soggetti terzi (acquirenti, fornitori o partner) nell'ambito della propria attività imprenditoriale.

#v(0.3em)

C) Le Parti intendono disciplinare in via *generale e continuativa* i termini della collaborazione, con riguardo alle modalità di calcolo e corrispettivo dell'attività di introduzione svolta da V6. Le condizioni economiche delle singole operazioni commerciali tra la Controparte e i Soggetti Introdotti saranno definite nei separati accordi tra tali soggetti, che non riguardano V6.

#v(0.3em)

D) Per ogni singola operazione V6 e la Controparte sottoscriveranno una *Scheda di Introduzione* (Allegato A), che individua il Soggetto Introdotto, la tipologia di operazione e la fee applicabile.

#v(0.3em)

Tutto ciò premesso, si conviene quanto segue.

#v(1em)

#text(size: 11pt, weight: "bold", fill: rgb(brand.primary_color))[Art. 1 — Oggetto dell'incarico]
#v(0.4em)

La Controparte conferisce a V6, che accetta, l'incarico *generale* di consulenza commerciale e introduzione finalizzato a mettere in contatto la Controparte con potenziali soggetti terzi interessati a concludere operazioni commerciali con la Controparte.

#v(0.3em)

V6 agisce in qualità di *consulente commerciale* e *introduttore*, in piena autonomia e senza vincoli di subordinazione, dipendenza o rappresentanza. Il presente accordo non configura in alcun modo un rapporto di mediazione né di agenzia.

#v(1em)

#text(size: 11pt, weight: "bold", fill: rgb(brand.primary_color))[Art. 2 — Definizioni: Soggetti Introdotti, Soggetti Collegati, Perimetro di Protezione]
#v(0.4em)

*2.1* Per "Soggetti Introdotti" si intendono i soggetti terzi individuati in una Scheda di Introduzione sottoscritta dalle Parti (Allegato A), ovvero comunque presentati alla Controparte per il tramite, su segnalazione o con l'ausilio di V6, anche informalmente (scambio di contatti, presentazioni via e-mail, eventi, fiere, incontri organizzati da V6).

#v(0.3em)

*2.2* Per "Soggetti Collegati" si intendono le società controllanti, controllate o collegate ai sensi dell'art. 2359 c.c. dei Soggetti Introdotti, nonché i loro aventi causa, successori o cessionari a qualsiasi titolo.

#v(0.3em)

*2.3* Il "Perimetro di Protezione" di ciascuna Scheda di Introduzione si estende a ogni operazione commerciale che tragga origine, anche indirettamente o parzialmente, dalla relazione instaurata tramite l'introduzione di V6, incluse le operazioni diverse da quella originariamente prospettata nella Scheda, qualora derivino dalla medesima relazione, e si applica anche nei confronti dei Soggetti Collegati.

#v(1em)

#text(size: 11pt, weight: "bold", fill: rgb(brand.primary_color))[Art. 3 — Modalità di svolgimento dell'attività]
#v(0.4em)

V6 si impegna a svolgere l'attività di introduzione con diligenza professionale, presentando alla Controparte i Soggetti Introdotti ritenuti idonei e fornendo le informazioni necessarie a valutare la possibile operazione.

#v(0.3em)

Per ogni Soggetto Introdotto, le Parti sottoscrivono una *Scheda di Introduzione* (Allegato A) che riporta: identità del Soggetto Introdotto, tipologia di operazione prospettata, fee applicabile e parte tenuta al pagamento.

#v(0.3em)

Le condizioni economiche delle singole operazioni commerciali tra Controparte e Soggetti Introdotti (prezzo, quantità, modalità di pagamento, durata) sono definite negli accordi che tali soggetti sottoscriveranno tra loro, al di fuori del presente accordo. V6 non è parte di tali accordi e non assume alcun obbligo relativamente alla loro conclusione.

#v(1em)

#text(size: 11pt, weight: "bold", fill: rgb(brand.primary_color))[Art. 4 — Fee di introduzione]
#v(0.4em)

*4.1* Per ciascuna operazione conclusa tra la Controparte (o un Soggetto Collegato alla stessa) e un Soggetto Introdotto, V6 ha diritto a una fee di introduzione calcolata secondo i termini indicati nella relativa Scheda di Introduzione (Allegato A).

#v(0.3em)

*4.2* La fee è a carico di: (i) Controparte (in qualità di venditore); oppure (ii) Soggetto Introdotto (in qualità di acquirente, secondo quanto previsto nel separato accordo tra V6 e il Soggetto Introdotto); oppure (iii) ripartita tra Controparte e Soggetto Introdotto secondo le percentuali indicate nella Scheda.

#v(0.3em)

*4.3* Salvo diverso accordo scritto nella singola Scheda di Introduzione, la fee è calcolata come percentuale sull'importo effettivo delle transazioni concluse tra la Controparte e i Soggetti Introdotti.

#v(0.3em)

*4.4* La fee si intende dovuta su tutte le operazioni rientranti nel Perimetro di Protezione, anche se concluse in forme diverse da quella originariamente prospettata, tramite Soggetti Collegati o terzi interposti (società veicolo, newco, mandatari o fiduciari), o dopo la scadenza del presente accordo — purché il Soggetto Introdotto sia stato presentato da V6 durante la vigenza del contratto e risulti da una Scheda di Introduzione sottoscritta ("Clausola Anti-Elusione"). Resta ferma la facoltà di V6 di far valere, in aggiunta, i rimedi di cui all'art. 8 del separato Accordo NCND richiamato all'art. 13.

#v(1em)

#text(size: 11pt, weight: "bold", fill: rgb(brand.primary_color))[Art. 5 — Fee su operazioni continuative e fatturazione mensile]
#v(0.4em)

*5.1* Per le operazioni aventi carattere continuativo o periodico (forniture ricorrenti, abbonamenti, contratti di somministrazione, contratti di durata pluriennale), la fee di introduzione è calcolata mensilmente sul valore delle operazioni effettivamente fatturate o incassate nel mese solare di riferimento tra la Controparte e il Soggetto Introdotto, indicato nella relativa Scheda, ed è dovuta per l'intera durata del rapporto e per i #f("tail_mesi", d: "[TAIL_MESI]") mesi successivi alla sua cessazione, indipendentemente dalla causa di quest'ultima.

#v(0.3em)

*5.2* Per tali operazioni, la Scheda di Introduzione indicherà il giorno del mese entro cui la Controparte è tenuta a trasmettere a V6 il rendiconto delle operazioni del mese precedente (di regola, il giorno #f("giorno_rendiconto", d: "[GIORNO_RENDICONTO]")); V6 emetterà fattura mensile sulla base di tale rendiconto.

#v(1em)

#text(size: 11pt, weight: "bold", fill: rgb(brand.primary_color))[Art. 6 — Modalità di pagamento]
#v(0.4em)

*6.1* La fee è corrisposta a V6 dietro emissione di regolare fattura, secondo le modalità e i tempi indicati nella Scheda di Introduzione, e comunque entro #f("giorni_pagamento", d: "[GIORNI_PAGAMENTO]") giorni dalla data di ricezione della fattura, e in ogni caso contestualmente all'incasso da parte della Controparte delle somme relative alla transazione, ove tale incasso intervenga in data anteriore alla scadenza della fattura ("Pagamento Contestuale").

#v(0.3em)

*6.2* La Controparte si impegna a comunicare a V6, entro 5 (cinque) giorni lavorativi, la conclusione di ogni transazione con i Soggetti Introdotti, indicando l'importo, la data e le modalità di pagamento.

#v(1em)

#text(size: 11pt, weight: "bold", fill: rgb(brand.primary_color))[Art. 7 — Penale e interessi di mora]
#v(0.4em)

*7.1* In caso di violazione della Clausola Anti-Elusione di cui all'art. 4.4, la Controparte corrisponderà a V6, a titolo di penale, per ciascuna violazione accertata, un importo pari al maggiore tra #f("penale_importo", d: "[PENALE_IMPORTO]") e #f("penale_pct", d: "[PENALE_PCT]")% del valore dell'operazione elusiva, fatto salvo il risarcimento dell'eventuale maggior danno e fermo restando, in ogni caso, il diritto di V6 alla fee di introduzione dovuta per l'intera durata del rapporto elusivamente instaurato.

#v(0.3em)

*7.2* In caso di ritardato pagamento della fee, saranno dovuti, senza necessità di costituzione in mora, gli interessi moratori nella misura prevista dal D.Lgs. 231/2002 per le transazioni commerciali, oltre al rimborso delle spese di recupero del credito e delle spese legali sostenute da V6.

#v(1em)

#text(size: 11pt, weight: "bold", fill: rgb(brand.primary_color))[Art. 8 — Rimedi cautelari]
#v(0.4em)

Le Parti riconoscono che la violazione della Clausola Anti-Elusione può cagionare a V6 un danno grave e non adeguatamente ristorabile per equivalente. V6 avrà diritto di richiedere, in via cautelare e d'urgenza, l'inibitoria di ogni condotta elusiva, ai sensi degli artt. 700 e ss. c.p.c., oltre al risarcimento del danno e alla fee dovuta.

#v(1em)

#text(size: 11pt, weight: "bold", fill: rgb(brand.primary_color))[Art. 9 — Canale di comunicazione dedicato al Progetto e presunzione di aggiramento]
#v(0.4em)

*9.1* Per l'intera durata del presente accordo e per il periodo di cui all'art. 10, comma 2, la Controparte si impegna a condurre ogni comunicazione scritta con i Soggetti Introdotti relativa a operazioni rientranti nel Perimetro di Protezione mantenendo sempre in copia conoscenza (c.c.) l'indirizzo e-mail dedicato #f("progetto_email", d: "[PROGETTO_EMAIL]"), indicato nella relativa Scheda di Introduzione.

#v(0.3em)

*9.2* Fatta salva la prova contraria a carico della Controparte, le comunicazioni condotte senza il rispetto di quanto previsto al comma 9.1 si presumono sottratte al controllo di V6 al fine di eludere la Clausola Anti-Elusione, con applicazione delle conseguenze di cui all'art. 7.

#v(1em)

#text(size: 11pt, weight: "bold", fill: rgb(brand.primary_color))[Art. 10 — Durata e rinnovo]
#v(0.4em)

*10.1* Il presente accordo ha durata di 24 mesi a decorrere dalla data di sottoscrizione, con rinnovo automatico per uguale periodo, salvo disdetta di una delle Parti da comunicarsi per iscritto almeno 60 (sessanta) giorni prima della scadenza.

#v(0.3em)

*10.2* Le Schede di Introduzione sottoscritte durante la vigenza del contratto restano valide anche dopo la scadenza del contratto quadro, per il tempo necessario all'esecuzione delle operazioni in esse indicate e per i successivi #f("tail_mesi", d: "[TAIL_MESI]") mesi, ai fini del diritto di V6 alla fee.

#v(1em)

#text(size: 11pt, weight: "bold", fill: rgb(brand.primary_color))[Art. 11 — Esclusioni]
#v(0.4em)

Non rientrano nell'oggetto del presente accordo: (a) i rapporti commerciali tra la Controparte e soggetti già in contatto prima dell'introduzione da parte di V6, purché documentati per iscritto alla data della Scheda di Introduzione; (b) le operazioni già in corso tra la Controparte e terzi al momento della sottoscrizione del presente accordo.

#v(1em)

#text(size: 11pt, weight: "bold", fill: rgb(brand.primary_color))[Art. 12 — Autonomia delle Parti]
#v(0.4em)

Il presente accordo non configura alcun rapporto di società, associazione, lavoro subordinato o agenzia tra le Parti. Ciascuna Parte opera in piena autonomia imprenditoriale. V6 non assume alcuna obbligazione in merito alla conclusione delle operazioni con i Soggetti Introdotti, che restano nella piena disponibilità negoziale delle Parti interessate.

#v(1em)

#text(size: 11pt, weight: "bold", fill: rgb(brand.primary_color))[Art. 13 — Riservatezza e non aggiramento]
#v(0.4em)

*13.1* Per gli obblighi di riservatezza e non aggiramento si fa espresso rinvio al separato Accordo NCND sottoscritto tra le Parti (Documento 2 della presente suite contrattuale), che si intende parte integrante del presente accordo.

#v(0.3em)

*13.2* In assenza di un separato Accordo NCND sottoscritto tra le Parti, si applicano comunque, in via suppletiva e in quanto compatibili, gli obblighi di riservatezza, non aggiramento, canale di comunicazione dedicato e i relativi rimedi e penali previsti agli artt. 3, 4, 5, 9 e 10 del modello di Accordo NCND di V6, che la Controparte dichiara di conoscere e accettare mediante la sottoscrizione del presente accordo.

#v(1em)

#text(size: 11pt, weight: "bold", fill: rgb(brand.primary_color))[Art. 14 — Garanzie di pagamento]
#v(0.4em)

Per le operazioni di valore superiore a #f("soglia_garanzia", d: "[SOGLIA_GARANZIA]") indicato nella relativa Scheda, V6 potrà richiedere, quale condizione per il proseguimento dell'attività di introduzione relativa a quella specifica Scheda, il rilascio di una garanzia bancaria a prima richiesta, di una fideiussione, o l'apertura di un conto di deposito vincolato (escrow) a copertura della fee maturanda.

#v(1em)

#text(size: 11pt, weight: "bold", fill: rgb(brand.primary_color))[Art. 15 — Protezione dei dati personali (GDPR)]
#v(0.4em)

Le Parti si impegnano a trattare i dati personali eventualmente comunicati in conformità al Regolamento UE 2016/679 (GDPR) e al D.Lgs. 196/2003. Ciascuna Parte agisce in qualità di titolare autonomo del trattamento.

#v(1em)

#text(size: 11pt, weight: "bold", fill: rgb(brand.primary_color))[Art. 16 — Cessione, modifiche, invalidità parziale, intera intesa]
#v(0.4em)

Il presente accordo è cedibile da V6 a società controllate, controllanti o collegate, ovvero in caso di operazioni straordinarie riguardanti V6, senza necessità di consenso della Controparte; quest'ultima non può cedere il presente accordo senza il preventivo consenso scritto di V6. Ogni modifica dovrà avvenire in forma scritta, a pena di nullità. L'eventuale invalidità di una o più clausole non comporta l'invalidità dell'intero accordo. Il presente accordo, unitamente alle Schede di Introduzione e all'eventuale Accordo NCND richiamato all'art. 13, costituisce la manifestazione integrale della volontà delle Parti in relazione al proprio oggetto.

#v(1em)

#text(size: 11pt, weight: "bold", fill: rgb(brand.primary_color))[Art. 17 — Legge applicabile e foro competente]
#v(0.4em)

Il presente accordo è regolato dalla legge italiana. Per ogni controversia relativa alla validità, interpretazione, esecuzione o risoluzione del presente accordo sarà competente in via esclusiva il Foro di Venezia, fatta salva la facoltà di V6 di adire, per le sole azioni cautelari e inibitorie di cui all'art. 8, qualsiasi foro competente per legge.

#v(2em)

#grid(
  columns: (1fr, 1fr),
  gutter: 2cm,
  [
    #text(size: 9pt, weight: "bold", fill: rgb(brand.primary_color))[V6 Impresa S.r.l.]
    #v(0.3em)
    #text(size: 8pt)[Il legale rappresentante]
    #v(2em)
    #line(length: 100%, stroke: 0.5pt + rgb(brand.primary_color))
  ],
  [
    #text(size: 9pt, weight: "bold", fill: rgb(brand.primary_color))[#f("controparte_nome", d: "Controparte")]
    #v(0.3em)
    #text(size: 8pt)[Il legale rappresentante]
    #v(2em)
    #line(length: 100%, stroke: 0.5pt + rgb(brand.primary_color))
  ],
)

#v(1.5em)
#pagebreak()

#align(center)[
  #text(size: 14pt, weight: "bold", fill: rgb(brand.primary_color))[Allegato A]
  #v(0.3em)
  #text(size: 9pt, fill: gray)[Scheda di Introduzione]
]
#v(1em)

#text(size: 8pt, fill: gray)[La presente Scheda è sottoscritta separatamente per ogni Soggetto Introdotto. Contiene i dati specifici dell'operazione e i termini della fee V6. Costituisce parte integrante del Contratto Quadro di Introduzione.]

#v(0.8em)

#block(
  inset: 12pt, radius: 4pt,
  stroke: 0.5pt + rgb(brand.secondary_color).lighten(50%),
)[
  *Scheda n.* #f("scheda_numero", d: "___") *del* #f("scheda_data", d: "___________")

  #v(0.5em)

  *Soggetto Introdotto:* #f("scheda_soggetto", d: "________________________________________")

  #v(0.3em)

  *Soggetti Collegati (se noti):* #f("scheda_collegati", d: "________________________")

  #v(0.3em)

  *Tipologia operazione:* #f("scheda_operazione", d: "________________________________________")

  #v(0.3em)

  *Continuativa:* #f("scheda_continuativa", d: "SÌ / NO")

  #v(0.3em)

  *Fee applicabile:* #f("scheda_fee", d: "___")% sull'importo delle transazioni concluse

  #v(0.3em)

  *Parte tenuta al pagamento:* #f("scheda_pagante", d: "venditore / acquirente / entrambi")

  #v(0.3em)

  *Modalità e tempi di pagamento:* #f("scheda_modalita", d: "________________________")

  #v(0.3em)

  *Giorno mensile di rendiconto:* #f("scheda_rendiconto", d: "___________")

  #v(0.3em)

  *Indirizzo e-mail dedicato:* #f("scheda_email", d: "________________________")

  #v(0.3em)

  *Soglia per garanzia di pagamento:* #f("scheda_soglia", d: "________________________")

  #v(0.3em)

  *Note:* #f("scheda_note", d: "________________________________________")

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
      #text(size: 8pt, fill: gray)[#f("controparte_nome", d: "Controparte")]
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
