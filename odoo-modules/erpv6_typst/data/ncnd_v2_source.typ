// NCND V6 — rev. 2 (testo validato da Claude, in attesa avvocato)
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

// Header brandizzato
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

// Titolo
#align(center)[
  #text(size: 9pt, fill: gray, tracking: 0.15em)[ACCORDO DI NON AGGIRAMENTO, RISERVATEZZA E FEE DI INTRODUZIONE]
  #v(0.6em)
  #text(size: 19pt, weight: "bold", fill: rgb(brand.primary_color))[Accordo NCND]
  #v(0.3em)
  #text(size: 8pt, fill: gray)[Data: #f("data_stipula", d: "___________") · rev. 2]
]
#v(1.5em)

// Parti
#block(
  fill: rgb(brand.primary_color).lighten(97%),
  inset: 14pt, radius: 6pt,
  stroke: 0.5pt + rgb(brand.secondary_color).lighten(50%),
)[
  #text(size: 8pt, weight: "bold", fill: rgb(brand.secondary_color), tracking: 0.1em)[TRA]
  #v(0.5em)
  *V6 Impresa S.r.l.*, con sede in #f("v6_sede", d: "[V6_SEDE]"), P.IVA #f("v6_piva", d: "[V6_PIVA]"), in persona di #f("v6_rappresentante", d: "[V6_RAPPRESENTANTE]") (di seguito *"V6"* o *"Introduttore"*);
  #v(0.5em)
  *E*
  #v(0.5em)
  *#f("controparte_nome", d: "[CONTROPARTE_NOME]")*, con sede in #f("controparte_indirizzo", d: "[CONTROPARTE_INDIRIZZO]"), P.IVA #f("controparte_piva", d: "[CONTROPARTE_PIVA]"), in persona di #f("controparte_rappresentante", d: "[CONTROPARTE_RAPPRESENTANTE]") (di seguito *"Controparte"*).
]

#v(1.2em)

// Premesse
#text(size: 11pt, weight: "bold", fill: rgb(brand.primary_color))[Premesse]
#v(0.4em)

(a) V6 svolge, tra l'altro, attività professionale di individuazione, selezione e messa in relazione (introduzione) tra soggetti economici, finalizzata ad agevolare la conclusione di operazioni commerciali, industriali, finanziarie o di altra natura tra gli stessi;

#v(0.3em)

(b) nell'ambito di tale attività, V6 ha presentato, presenta o si appresta a presentare alla Controparte uno o più soggetti terzi, come identificati nell'Allegato A ovvero individuabili in base ai criteri di cui all'art. 2 (i "Soggetti Introdotti");

#v(0.3em)

(c) le Parti intendono regolare gli obblighi di riservatezza, di non aggiramento, il canale di comunicazione dedicato e il diritto di V6 a percepire una remunerazione (la "Fee di Introduzione") su ogni Transazione, anche di durata, conclusa con i Soggetti Introdotti.

#v(0.3em)

Si conviene quanto segue.

#v(1em)

// ART. 1
#text(size: 11pt, weight: "bold", fill: rgb(brand.primary_color))[Art. 1 — Allegati]
#v(0.4em)

L'Allegato A (elenco dei Soggetti Introdotti, aggiornabile per iscritto anche a mezzo e-mail con conferma di ricezione) costituisce parte integrante del presente Accordo.

#v(1em)

// ART. 2
#text(size: 11pt, weight: "bold", fill: rgb(brand.primary_color))[Art. 2 — Soggetti Introdotti e Perimetro di Protezione]
#v(0.4em)

*2.1* Per "Soggetti Introdotti" si intendono: (i) i soggetti indicati nell'Allegato A; (ii) qualunque altro soggetto terzo presentato dalla Controparte per il tramite, su segnalazione o con l'ausilio di V6, anche informalmente, ivi incluso tramite scambio di contatti, presentazioni via e-mail, eventi, fiere o incontri organizzati da V6; (iii) le società controllanti, controllate, collegate ai sensi dell'art. 2359 c.c. o comunque soggette a comune controllo con i soggetti di cui ai punti (i) e (ii); (iv) gli aventi causa, successori o cessionari a qualsiasi titolo dei medesimi soggetti (collettivamente, con i soggetti di cui ai punti precedenti, i "Soggetti Collegati").

#v(0.3em)

*2.2* Il "Perimetro di Protezione" si estende a ogni opportunità commerciale, industriale o finanziaria che tragga origine, anche indirettamente o parzialmente, dall'introduzione operata da V6, incluse le opportunità diverse da quella originariamente prospettata, qualora derivino dalla medesima relazione.

#v(1em)

// ART. 3
#text(size: 11pt, weight: "bold", fill: rgb(brand.primary_color))[Art. 3 — Informazioni Riservate]
#v(0.4em)

Costituiscono "Informazioni Riservate" ai fini del presente Accordo: l'identità e i dati di contatto dei Soggetti Introdotti, le condizioni economiche, i listini, i volumi, le strategie, le metodologie, il know-how e i dati personali di terzi comunicati in relazione all'attività di introduzione. La Controparte si impegna a mantenere riservate tali informazioni per 5 (cinque) anni dalla comunicazione e a non divulgarle a terzi senza il preventivo consenso scritto di V6, adottando le medesime cautele riservate alle proprie informazioni di analoga rilevanza; resta fermo, per quanto compatibile, quanto previsto agli artt. 3 e 4 dell'Accordo di Riservatezza (Documento 1), ove sottoscritto tra le medesime Parti.

#v(1em)

// ART. 4
#text(size: 11pt, weight: "bold", fill: rgb(brand.primary_color))[Art. 4 — Obbligo di Non Aggiramento (Non-Circumvention)]
#v(0.4em)

*4.1* La Controparte si obbliga, per sé e per i propri dipendenti, amministratori, collaboratori, agenti, consulenti, società controllate, controllanti o collegate (collettivamente i "Soggetti Vincolati"), a non contattare, negoziare, stipulare accordi o comunque intrattenere rapporti commerciali con i Soggetti Introdotti, in relazione a operazioni rientranti nel Perimetro di Protezione, se non per il tramite di V6 e senza il preventivo consenso scritto di quest'ultima.

#v(0.3em)

*4.2* L'obbligo si applica indipendentemente dal fatto che la Controparte: a) entri in contatto con i Soggetti Introdotti anche per il tramite di soggetti terzi o canali diversi da V6, successivamente alla presentazione operata da quest'ultima; b) strutturi l'operazione attraverso soggetti interposti, società veicolo, newco, mandatari o fiduciari, ovvero mediante qualsiasi altra forma giuridica diversa da quella originariamente prospettata, incluse cessioni di ramo d'azienda, conferimenti, fusioni o joint venture ("Clausola Anti-Elusione"); c) ritardi la conclusione della Transazione oltre il termine di cui all'art. 8.1, al solo fine di eludere l'applicazione del presente Accordo.

#v(0.3em)

*4.3* Nessuna disposizione del presente articolo preclude alla Controparte di intrattenere rapporti con soggetti che, indipendentemente dall'introduzione operata da V6, fossero già in rapporto commerciale documentato e preesistente con la Controparte alla data della presentazione, come da elenco comunicato per iscritto a V6 prima della presentazione stessa.

#v(1em)

// ART. 5 — Canale dedicato
#text(size: 11pt, weight: "bold", fill: rgb(brand.primary_color))[Art. 5 — Canale di comunicazione dedicato e presunzione di aggiramento]
#v(0.4em)

*5.1* Per l'intera durata del presente Accordo e per il Periodo di Protezione di cui all'art. 8, la Controparte si impegna a condurre ogni comunicazione scritta (e-mail, messaggistica o altro canale) intrattenuta con i Soggetti Introdotti e riferibile a trattative, negoziazioni o esecuzione di Transazioni rientranti nel Perimetro di Protezione, mantenendo sempre in copia conoscenza (c.c.) l'indirizzo e-mail dedicato #f("progetto_email", d: "[PROGETTO_EMAIL]"), appositamente istituito da V6 per il presente Accordo.

#v(0.3em)

*5.2* Fatta salva la prova contraria a carico della Controparte, le comunicazioni con un Soggetto Introdotto relative al Perimetro di Protezione che risultino condotte senza il rispetto di quanto previsto al comma 5.1 si presumono sottratte al controllo di V6 al fine di eludere gli obblighi di cui all'art. 4, con conseguente applicazione delle penali e dei rimedi di cui agli artt. 9 e 10.

#v(0.3em)

*5.3* La Controparte fornirà a V6, su richiesta motivata di quest'ultima, evidenza documentale (anche in forma di estratto o export) delle comunicazioni intercorse con i Soggetti Introdotti relative al Perimetro di Protezione, ai fini della verifica di cui al comma precedente.

#v(1em)

// ART. 6
#text(size: 11pt, weight: "bold", fill: rgb(brand.primary_color))[Art. 6 — Fee di Introduzione: definizione e maturazione]
#v(0.4em)

*6.1* Per "Transazione" si intende qualunque negozio giuridico — a titolo esemplificativo: contratto di fornitura, accordo quadro, incarico professionale o di consulenza, joint venture, accordo di partnership, acquisizione, investimento, locazione o affitto, contratto di somministrazione continuativa — concluso, direttamente o indirettamente, tra la Controparte (o un Soggetto Vincolato) e un Soggetto Introdotto, avente a oggetto, in tutto o in parte, il Perimetro di Protezione.

#v(0.3em)

*6.2* La Fee di Introduzione è pari a #f("fee_pct", d: "[FEE_PCT]")% del valore di ciascuna Transazione (ovvero, per i rapporti di durata, calcolata come da art. 7), ed è dovuta per l'intera durata della Transazione stessa e per i #f("tail_mesi", d: "[TAIL_MESI]") mesi successivi alla sua cessazione, rinnovo o proroga, anche tacita.

#v(0.3em)

*6.3* Il diritto di V6 alla Fee di Introduzione matura automaticamente al verificarsi della Transazione, indipendentemente dalla forma con cui questa venga successivamente formalizzata, e non è subordinato ad alcuna ulteriore attività di V6 oltre a quella di introduzione già svolta.

#v(1em)

// ART. 7
#text(size: 11pt, weight: "bold", fill: rgb(brand.primary_color))[Art. 7 — Fee su Transazioni continuative e fatturazione mensile]
#v(0.4em)

*7.1* Per le Transazioni aventi carattere continuativo o periodico (a titolo esemplificativo: forniture ricorrenti, abbonamenti, contratti di somministrazione, contratti di durata pluriennale), la Fee di Introduzione è calcolata mensilmente sul valore delle operazioni effettivamente fatturate o incassate dalla Controparte nel mese solare di riferimento nei confronti del Soggetto Introdotto, ed è dovuta per l'intera durata del rapporto e per i #f("tail_mesi", d: "[TAIL_MESI]") mesi successivi alla sua cessazione.

#v(0.3em)

*7.2* Entro il giorno #f("giorno_rendiconto", d: "[GIORNO_RENDICONTO]") di ogni mese, la Controparte trasmetterà a V6 un rendiconto scritto (anche a mezzo e-mail, in copia a #f("progetto_email", d: "[PROGETTO_EMAIL]")) con il dettaglio delle Transazioni concluse o in corso con i Soggetti Introdotti nel mese precedente, con evidenza dei relativi importi fatturati o incassati.

#v(0.3em)

*7.3* V6 emetterà fattura per la Fee di Introduzione maturata nel mese di riferimento; la Controparte la salderà entro #f("giorni_pagamento", d: "[GIORNI_PAGAMENTO]") giorni dalla ricezione, e comunque contestualmente all'incasso delle somme relative alla Transazione ("Pagamento Contestuale"), ove tale incasso intervenga in data anteriore alla scadenza della fattura.

#v(0.3em)

*7.4* Per le Transazioni non aventi carattere continuativo, la Fee di Introduzione è dovuta ed esigibile contestualmente e non oltre la data di sottoscrizione o di esecuzione della Transazione, a prescindere dai termini di incasso pattuiti tra la Controparte e il Soggetto Introdotto.

#v(0.3em)

*7.5* Il mancato rispetto dell'obbligo di rendicontazione di cui al comma 7.2 attribuisce a V6 il diritto di richiedere, con oneri a carico della Controparte, una verifica contabile (audit) sui rapporti intercorsi con i Soggetti Introdotti, anche tramite un professionista terzo indipendente vincolato da obbligo di riservatezza, con accesso alla documentazione contabile e contrattuale pertinente.

#v(1em)

// ART. 8
#text(size: 11pt, weight: "bold", fill: rgb(brand.primary_color))[Art. 8 — Durata del diritto di V6 alla Fee]
#v(0.4em)

*8.1* Il diritto di V6 alla Fee di Introduzione si applica a ogni Transazione conclusa: (i) durante la vigenza del presente Accordo; (ii) nei #f("periodo_protezione", d: "[PERIODO_PROTEZIONE]") mesi successivi alla sua cessazione per qualsiasi causa; (iii) in qualunque momento successivo, con riferimento ai Soggetti Introdotti con cui sia in corso, alla data di cessazione dell'Accordo, un rapporto o una trattativa riferibile al Perimetro di Protezione, per l'intera durata di tale rapporto e per i #f("tail_mesi", d: "[TAIL_MESI]") mesi successivi.

#v(0.3em)

*8.2* Il presente Accordo si rinnova tacitamente di anno in anno, salvo disdetta comunicata da una Parte all'altra con preavviso di almeno #f("preavviso_mesi", d: "[PREAVVISO_MESI]") mesi rispetto alla scadenza. La cessazione del presente Accordo, per disdetta o per qualsiasi altra causa, non pregiudica i diritti di V6 maturati o maturandi ai sensi del comma 8.1.

#v(1em)

// ART. 9
#text(size: 11pt, weight: "bold", fill: rgb(brand.primary_color))[Art. 9 — Penale e interessi di mora]
#v(0.4em)

*9.1* In caso di violazione dell'obbligo di non aggiramento di cui all'art. 4 (o della presunzione di cui all'art. 5.2), la Controparte corrisponderà a V6, a titolo di penale, per ciascuna violazione accertata, un importo pari al maggiore tra #f("penale_importo", d: "[PENALE_IMPORTO]") e #f("penale_pct", d: "[PENALE_PCT]")% del valore della Transazione elusiva, fatto salvo il risarcimento dell'eventuale maggior danno e fermo restando, in ogni caso, il diritto di V6 alla Fee di Introduzione di cui agli artt. 6 e 7, dovuta per l'intera durata del rapporto elusivamente instaurato.

#v(0.3em)

*9.2* Il pagamento della penale non esonera la Controparte dagli obblighi del presente Accordo, né costituisce liquidazione forfettaria sostitutiva del risarcimento del danno ulteriore.

#v(0.3em)

*9.3* In caso di ritardato pagamento della Fee di Introduzione, saranno dovuti, senza necessità di costituzione in mora, gli interessi moratori nella misura prevista dal D.Lgs. 231/2002 per le transazioni commerciali, oltre al rimborso delle spese di recupero del credito e delle spese legali sostenute da V6.

#v(1em)

// ART. 10
#text(size: 11pt, weight: "bold", fill: rgb(brand.primary_color))[Art. 10 — Rimedi cautelari]
#v(0.4em)

Le Parti riconoscono che la violazione degli obblighi di cui agli artt. 3, 4 e 5 può cagionare a V6 un danno grave e non adeguatamente ristorabile per equivalente. V6 avrà diritto di richiedere, in via cautelare e d'urgenza, l'inibitoria di ogni condotta elusiva o violativa, ai sensi degli artt. 700 e ss. c.p.p., oltre al risarcimento del danno e alla Fee di Introduzione dovuta.

#v(1em)

// ART. 11
#text(size: 11pt, weight: "bold", fill: rgb(brand.primary_color))[Art. 11 — Garanzie di pagamento]
#v(0.4em)

Per le Transazioni di valore superiore a #f("soglia_garanzia", d: "[SOGLIA_GARANZIA]"), V6 potrà richiedere, quale condizione per il proseguimento dell'attività di introduzione, il rilascio di una garanzia bancaria a prima richiesta, di una fideiussione, o l'apertura di un conto di deposito vincolato (escrow) a copertura della Fee di Introduzione maturanda.

#v(1em)

// ART. 12
#text(size: 11pt, weight: "bold", fill: rgb(brand.primary_color))[Art. 12 — Protezione dei dati personali (GDPR)]
#v(0.4em)

Le Parti si impegnano a trattare i dati personali comunicati in conformità al Regolamento UE 2016/679 e al D.Lgs. 196/2003 e s.m.i., agendo quali autonomi titolari del trattamento per le finalità del presente Accordo e sottoscrivendo, ove necessario, apposito accordo ex art. 28 GDPR.

#v(1em)

// ART. 13
#text(size: 11pt, weight: "bold", fill: rgb(brand.primary_color))[Art. 13 — Cessione, modifiche, invalidità parziale, intera intesa]
#v(0.4em)

Il presente Accordo è cedibile da V6 a società controllate, controllanti o collegate, ovvero in caso di operazioni straordinarie riguardanti V6, senza necessità di consenso della Controparte; quest'ultima non può cedere il presente Accordo senza il preventivo consenso scritto di V6. Ogni modifica dovrà avvenire in forma scritta, a pena di nullità. L'eventuale invalidità di una o più clausole non comporta l'invalidità dell'intero Accordo. Il presente Accordo costituisce la manifestazione integrale della volontà delle Parti in relazione al proprio oggetto.

#v(1em)

// ART. 14
#text(size: 11pt, weight: "bold", fill: rgb(brand.primary_color))[Art. 14 — Legge applicabile e Foro competente]
#v(0.4em)

Il presente Accordo è regolato dalla legge italiana; per ogni controversia sarà competente in via esclusiva il Foro di Venezia, fatta salva la facoltà di V6 di adire, per le sole azioni cautelari e inibitorie, qualsiasi foro competente per legge.

#v(2em)

// Firme
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

#v(1.5em)
#pagebreak()

// ALLEGATO A
#align(center)[
  #text(size: 14pt, weight: "bold", fill: rgb(brand.primary_color))[Allegato A]
  #v(0.3em)
  #text(size: 9pt, fill: gray)[Elenco dei Soggetti Introdotti]
]
#v(1em)

#text(size: 9pt, fill: gray)[
  La presente tabella è aggiornata per iscritto anche via e-mail con conferma di ricezione.
  Costituisce parte integrante dell'Accordo NCND.
]
#v(0.8em)

#table(
  columns: (auto, 1fr, 1fr, auto, 1fr),
  inset: 8pt,
  stroke: 0.5pt + rgb(brand.secondary_color).lighten(50%),
  align: (left, left, left, left, left),
  [*N.*], [*Soggetto Introdotto*], [*Dati di contatto*], [*Data*], [*Canale di introduzione*],
  [1], [#f("a1_nome", d: "")], [#f("a1_contatto", d: "")], [#f("a1_data", d: "")], [#f("a1_canale", d: "")],
  [2], [#f("a2_nome", d: "")], [#f("a2_contatto", d: "")], [#f("a2_data", d: "")], [#f("a2_canale", d: "")],
  [3], [#f("a3_nome", d: "")], [#f("a3_contatto", d: "")], [#f("a3_data", d: "")], [#f("a3_canale", d: "")],
)

#v(2em)
#align(center)[
  #text(size: 7pt, fill: gray)[
    Documento generato da V6 Impresa AI — Hash SHA-256 certificato e ancorato su blockchain. \
    Verifica pubblica: v6impresa.it/verify
  ]
]
