// Dati del blog (09/09/2026, richiesto da Denis: "una pagina tipo blog
// con i primi due articoli"). Contenuto educativo/metodologico, non
// promozionale con numeri inventati (stesso principio "mai un dato/
// numero finto" applicato ovunque in questa sessione) - dove citiamo un
// caso reale (Tosi Mati, DSCR) è lo stesso già pubblicato su /business-plan,
// nessun dato nuovo o diverso qui.
export interface BlogArticle {
    slug: string;
    title: string;
    excerpt: string;
    date: string; // ISO
    readingMinutes: number;
    // Paragrafi in HTML semplice (niente markdown da parsare a runtime,
    // solo <p>/<h2>/<ul> - stesso approccio delle landing di prodotto).
    bodyHtml: string;
}

export const blogArticles: BlogArticle[] = [
    {
        slug: "dscr-cosa-guarda-la-banca",
        title: "DSCR: il numero che una banca guarda prima di leggere il resto del business plan",
        excerpt:
            "Il Debt Service Coverage Ratio non è un tecnicismo da consulenti: è il primo filtro con cui un istruttore di fido decide se continuare a leggere il tuo piano finanziario.",
        date: "2026-09-09",
        readingMinutes: 5,
        bodyHtml: `
<p>Quando una banca valuta una richiesta di finanziamento, prima di entrare nei dettagli del progetto guarda un numero: il <abbr title="Debt Service Coverage Ratio">DSCR</abbr>. Tradotto in linguaggio semplice: quanti euro di flusso di cassa l'azienda genera per ogni euro che deve restituire di rata (capitale più interessi) nell'anno.</p>

<h2>Come si legge, senza il tecnicismo</h2>
<p>Un DSCR di 1,5x significa che, per ogni euro di rata, l'azienda ne genera 1,50 — c'è un margine di sicurezza. Un DSCR di 0,9x significa l'opposto: il flusso di cassa non basta nemmeno a pagare la rata, prima ancora di considerare qualsiasi altra spesa. Le banche italiane, in istruttoria, cercano tipicamente un DSCR minimo intorno a 1,2x: sotto quella soglia, il progetto viene quasi sempre respinto o rimandato per una revisione del piano.</p>

<h2>L'errore più comune: calcolarlo a fine piano, non durante</h2>
<p>Molti business plan calcolano il DSCR come ultima verifica, dopo aver già scritto tutto il resto — proiezioni di ricavi, costi, investimento. Il problema è che a quel punto, se il numero non regge, bisogna tornare indietro e rivedere ipotesi che magari erano già state presentate o discusse. Il modo corretto è il contrario: costruire il piano finanziario sapendo già quale DSCR serve raggiungere, e verificarlo passo dopo passo mentre si costruiscono le proiezioni — non alla fine, come un esame a sorpresa.</p>

<h2>Lo stress test: la domanda che una banca farà comunque</h2>
<p>Anche un DSCR sopra soglia negli scenari "normali" non basta se non regge a uno scenario più conservativo — un calo di fatturato, un aumento dei costi, un ritardo nell'avvio del progetto. Le banche applicano quasi sempre i propri scenari di stress prima di approvare: un piano che non è già stato testato su quegli stessi parametri arriva in istruttoria "scoperto", con il rischio che la prima domanda scomoda dell'istruttore faccia crollare la fiducia in tutto il resto del documento.</p>

<p>Un caso concreto (lo stesso pubblicato nella nostra pagina <a href="/business-plan">Business Plan</a>): il nostro progetto agricolo interno aveva bisogno di un finanziamento ISMEA. Abbiamo costruito il modello finanziario e verificato la sua tenuta con uno stress test sugli stessi parametri usati in istruttoria: il risultato è stato un DSCR di 3,18x, ben sopra la soglia minima di 1,2x richiesta, e il finanziamento è stato approvato.</p>
`,
    },
    {
        slug: "kaizen-da-dove-iniziare-in-una-pmi",
        title: "Kaizen in una PMI: da dove iniziare davvero (non un programma aziendale)",
        excerpt:
            "Il miglioramento continuo non ha bisogno di un progetto trasversale con slide e sponsor esecutivo. Ha bisogno di uno spreco vero, osservato sul campo, e di una correzione piccola e verificabile.",
        date: "2026-09-09",
        readingMinutes: 4,
        bodyHtml: `
<p>Kaizen, in giapponese, significa semplicemente "cambiamento in meglio". Nella pratica industriale è diventato un metodo per il miglioramento continuo — ma nella maggior parte delle PMI, quando si prova a "fare Kaizen", si finisce per lanciare un programma aziendale con obiettivi trimestrali, un responsabile dedicato e un kick-off con tutto il personale. Il risultato, spesso, è un entusiasmo iniziale che si spegne entro pochi mesi.</p>

<h2>Il problema non è la motivazione, è la scala</h2>
<p>Un programma Kaizen "importante" richiede tempo, coordinamento e continuità che una PMI raramente ha a disposizione senza distogliere risorse da tutto il resto. Il metodo Kaizen originale, però, non richiede niente di tutto questo: richiede osservare un processo reale, sul campo, e correggere un solo spreco concreto — non riorganizzare un intero reparto.</p>

<h2>Cosa cercare davvero: gli sprechi "invisibili"</h2>
<p>Gli sprechi che pesano di più non sono quasi mai gli errori evidenti. Sono le piccole inefficienze diventate normali: un'attesa che tutti considerano "così è sempre stato", un doppio controllo che nessuno ricorda perché esiste, un passaggio di consegna tra due persone che richiede sempre una telefonata di chiarimento. Nessuno di questi appare in un bilancio come una voce di costo — ma insieme pesano più di quanto sembri guardando ogni singolo caso.</p>

<ul>
<li><strong>Osserva un processo per intero</strong>, dall'inizio alla fine, senza fermarti alla prima cosa che sembra un problema.</li>
<li><strong>Scegli un solo spreco</strong>, il più concreto e misurabile che trovi — non il più "importante" in teoria.</li>
<li><strong>Correggi in piccolo</strong>, verifica il risultato con un dato reale, poi ripeti su un altro spreco.</li>
</ul>

<h2>Perché la ripetizione conta più della singola correzione</h2>
<p>Il valore del Kaizen non è nella prima correzione: è nel ciclo che si ripete. Una singola correzione, per quanto ben fatta, resta un intervento isolato se non si trasforma in un'abitudine di osservazione continua. È questo — non uno slogan motivazionale in bacheca — che distingue un'azienda che migliora davvero, un problema alla volta, da una che ne parla soltanto.</p>
`,
    },
];
