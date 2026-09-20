// Accordo di Segnalazione Commerciale — Template Typst
// Generato da erpv6.referral.action_generate_agreement()
#let data = json("data.json")

#set page(
  paper: "a4",
  margin: (top: 2cm, bottom: 2cm, left: 2cm, right: 2cm),
  numbering: "1",
)
#set text(size: 10pt, lang: "it", font: ("Inter", "Noto Sans", "DejaVu Sans"))
#set par(justify: true, leading: 0.75em)

// ─── HEADER ───
#grid(
  columns: (1fr, auto),
  align: (left, right),
  [
    #text(size: 9pt, weight: "bold", fill: rgb("#0f172a"))[V6 IMPRESA]
    #linebreak()
    #text(size: 8pt, fill: gray)[Consulenza B2B · v6impresa.it]
  ],
  [
    #text(size: 8pt, fill: gray)[#data.at("data_generazione", default: "-")]
  ],
)

#v(0.5em)
#line(length: 100%, stroke: 1pt + rgb("#1a7fa8"))
#v(1.5em)

// ─── TITOLO ───
#align(center)[
  #text(size: 16pt, weight: "bold", fill: rgb("#0f172a"))[ACCORDO DI SEGNALAZIONE COMMERCIALE]
]
#v(1.5em)

// ─── PARTI ───
#block(
  fill: rgb("#f8fafc"),
  inset: 12pt,
  radius: 4pt,
  stroke: 0.5pt + rgb("#e2e8f0"),
)[
  *TRA*

  *V6 Impresa S.r.l.*, con sede legale in #data.at("v6_sede", default: "[DA COMPILARE]"), C.F./P.IVA #data.at("v6_piva", default: "[DA COMPILARE]"), di seguito denominata *"Committente"*;

  #v(0.5em)
  *E*

  #data.at("nome_segnalante", default: "-")#if data.at("ragione_sociale_segnalante", default: "") != "" [, #data.at("ragione_sociale_segnalante")], con sede/residenza in #data.at("indirizzo_segnalante", default: "-"), C.F./P.IVA #data.at("cf_piva_segnalante", default: "-"), e-mail #data.at("email_segnalante", default: "-"), di seguito denominato/a *"Segnalante"*;

  #v(0.5em)
  di seguito, congiuntamente, le *"Parti"*.
]

#v(1em)

// ─── PREMESSA ───
#text(size: 11pt, weight: "bold", fill: rgb("#0f172a"))[Premessa e Oggetto]
#line(length: 100%, stroke: 0.5pt + rgb("#cbd5e1"))
#v(0.5em)

Il presente accordo disciplina l'attività di segnalazione commerciale svolta dal Segnalante a favore della Committente, relativa al progetto *#data.at("nome_progetto", default: "-")* (di seguito il *"Progetto"*), e le condizioni per il riconoscimento dell'eventuale compenso.

#v(1em)

// ─── CLAUSOLE ───
#text(size: 11pt, weight: "bold", fill: rgb("#0f172a"))[Clausole]
#line(length: 100%, stroke: 0.5pt + rgb("#cbd5e1"))
#v(0.5em)

+ *Contatto segnalato.* Il Segnalante segnala alla Committente il seguente nominativo quale potenziale contatto commerciale per il Progetto:
  - Nome/Ragione sociale: *#data.at("nome_contatto_segnalato", default: "-")*
  - Riferimento (email/telefono): *#data.at("email_o_telefono_contatto", default: "-")*
  - Note sulla segnalazione: #data.at("note_segnalazione", default: "-")

+ *Compenso.* La Committente si impegna a corrispondere al Segnalante, a titolo di compenso per la segnalazione, un importo pari al *#data.at("commissione_pct", default: "-")%* del valore del primo contratto sottoscritto e integralmente incassato dalla Committente con il contatto segnalato, a condizione che la sottoscrizione e l'incasso avvengano entro 12 (dodici) mesi dalla data di firma del presente accordo.

+ *Validità della segnalazione.* La segnalazione si considera valida esclusivamente qualora il contatto segnalato non risulti già presente nei sistemi (CRM, archivi commerciali o documentazione interna) della Committente alla data di sottoscrizione del presente accordo. In caso di contestazione sulla novità del contatto, l'onere della prova circa la preesistenza del contatto nei propri sistemi è a carico della Committente, che si impegna a fornire idonea documentazione a supporto.

+ *Condizioni di maturazione del compenso.* Il compenso di cui alla clausola 2 è dovuto esclusivamente in caso di contratto effettivamente sottoscritto e incassato dalla Committente. Nessun compenso, indennità o rimborso è dovuto al Segnalante per trattative avviate, anche se in stato avanzato, che non si concludano con la sottoscrizione e l'incasso di cui sopra.

+ *Discrezionalità commerciale.* La Committente non assume alcun obbligo di contattare il nominativo segnalato, né di avviare o proseguire trattative con lo stesso. Ogni decisione in merito all'opportunità, ai tempi e alle modalità di eventuale contatto commerciale resta di esclusiva e insindacabile competenza della Committente.

+ *Riservatezza.* Il Segnalante si impegna a mantenere strettamente riservati il contenuto del presente accordo, i termini economici ivi previsti e ogni informazione relativa al Progetto di cui sia venuto a conoscenza in relazione al presente rapporto, salvo diverso accordo scritto tra le Parti o obbligo di legge.

+ *Durata.* Il presente accordo ha validità di 24 (ventiquattro) mesi a decorrere dalla data di sottoscrizione. Decorso tale termine, ogni obbligo di corresponsione del compenso di cui alla clausola 2 si intende definitivamente decaduto, salvo che il contratto con il contatto segnalato sia già stato sottoscritto e incassato entro i termini di cui alla clausola 2.

+ *Legge applicabile e foro competente.* Il presente accordo è regolato dalla legge italiana. Per qualsiasi controversia relativa alla validità, interpretazione, esecuzione o risoluzione del presente accordo, sarà competente in via esclusiva il Foro di #data.at("citta_foro", default: "[DA COMPILARE]").

#v(1.5em)

Letto, confermato e sottoscritto in data *#data.at("data_firma", default: "-")*, a *#data.at("luogo_firma", default: "-")*.

#v(3em)

// ─── FIRME ───
#grid(
  columns: (1fr, 1fr),
  gutter: 3em,
  [
    #line(length: 100%, stroke: 0.5pt + black)
    #v(0.3em)
    #text(size: 9pt)[Il Segnalante]
    #linebreak()
    #text(size: 9pt, weight: "bold")[#data.at("nome_segnalante", default: "-")]
  ],
  [
    #line(length: 100%, stroke: 0.5pt + black)
    #v(0.3em)
    #text(size: 9pt)[Firma digitale via Documenso]
    #linebreak()
    #text(size: 9pt, fill: gray)[(solo il Segnalante)]
  ],
)

#v(2em)
#align(center)[
  #text(size: 8pt, fill: gray)[
    Documento generato automaticamente dal sistema V6 Impresa.
    Hash ancorato su blockchain (OpenTimestamps) al momento della generazione.
  ]
]
