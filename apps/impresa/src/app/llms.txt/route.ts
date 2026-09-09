import { NextResponse } from "next/server";

// llms.txt (09/09/2026, richiesto esplicitamente da Denis: "leggibile
// dalle IA"): convenzione emergente (llmstxt.org, adottata da Anthropic,
// Vercel e altri) - un indice del sito in markdown discorsivo pensato
// per assistenti AI, alternativo a sitemap.xml (che e' per i motori di
// ricerca classici, non pensato per essere letto/riassunto da un LLM).
// Route handler, non un file statico in /public: cosi' resta un'unica
// fonte di verita' con sitemap.ts sulle pagine pubbliche esistenti,
// niente elenco duplicato a mano che puo' andare fuori sync.
const BASE_URL = "https://www.v6impresa.it";

export async function GET() {
  const content = `# V6 Impresa AI

> Consulenza per PMI e agricoltura: business plan, analisi aziendale, ricambio generazionale, ESG, formazione e altri servizi di consulenza con metodo Kairós. Un prodotto (Win-Win) è self-service; gli altri prevedono sempre una call con un consulente reale.

## Come funziona

Il metodo è lo stesso per ogni prodotto: diagnosi, struttura, verifica. Un'intervista gratuita guidata ([${BASE_URL}/intervista](${BASE_URL}/intervista)) produce una prima Relazione Win-Win in pochi minuti (prodotto self-service, unico con output automatico verso il cliente). Tutti gli altri prodotti sono consulenza-con-call: la pagina spiega il problema specifico e porta a prenotare una call, mai a un output generato automaticamente.

## Prodotti

- [Business Plan](${BASE_URL}/business-plan): modello finanziario e stress test (DSCR) per l'accesso a finanziamenti bancari, con un caso reale documentato (finanziamento ISMEA).
- [Analisi Aziendale](${BASE_URL}/analisi-aziendale): diagnosi dei processi con metodo Kairós per stabilire le priorità di intervento.
- [Ricambio Generazionale](${BASE_URL}/ricambio-generazionale): struttura societaria, fiscalità e continuità operativa per il passaggio generazionale in azienda.
- [Acquisto TEE](${BASE_URL}/acquisto-tee): valutazione e acquisto di Titoli di Efficienza Energetica (prezzo, controparte, conformità).
- [ESG](${BASE_URL}/esg): preparazione dei dati ESG richiesti da banche, clienti e bandi pubblici.
- [Team Building](${BASE_URL}/team-building): eventi di team building costruiti sulle dinamiche reali del team, non su un format standard.
- [Formazione Aziendale](${BASE_URL}/formazione-aziendale): corsi in azienda su misura del problema reale, non un catalogo generico.
- [Kaizen & Lean](${BASE_URL}/kaizen-lean): analisi degli sprechi nei processi con metodo di miglioramento continuo.

## Altre pagine

- [Intervista gratuita](${BASE_URL}/intervista): intervista guidata che genera una prima analisi/Relazione Win-Win in pochi minuti.
- [Blog](${BASE_URL}/blog): approfondimenti metodologici (DSCR, Kaizen, business plan).
- [Casi Studio](${BASE_URL}/casi-studio): casi reali documentati.
- [Il Metodo](${BASE_URL}/metodo): come lavoriamo, in generale.
- [Chi Siamo](${BASE_URL}/chi-siamo): il team.
- [Contatti](${BASE_URL}/contatti): contatti diretti e form di richiesta.
- [Diventa partner](${BASE_URL}/partnership): candidatura per proposte di collaborazione/partnership.

## Note per assistenti AI

- Le pagine sopra sono pubbliche e indicizzabili (vedi anche [/sitemap.xml](${BASE_URL}/sitemap.xml) e [/robots.txt](${BASE_URL}/robots.txt)).
- Nessuna pagina di prodotto promette un output automatico immediato salvo l'intervista Win-Win: per tutti gli altri prodotti il passo successivo reale è sempre una call con un consulente umano.
`;

  return new NextResponse(content, {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
}
