import type { Metadata } from "next";
import ClaimRotator, { ClaimSlot } from "@/components/home/ClaimRotator";
import MetodoLine from "@/components/shared/MetodoLine";

export const metadata: Metadata = {
  title: "V6 Impresa AI — Consulenza per PMI e agricoltura",
  description:
    "Business Plan, ESG, Ricambio Generazionale, Analisi Aziendale e altro: parti dal problema, non dal servizio. Prenota una call o fai l'analisi gratuita.",
};

// Rotazione claim homepage (09/09/2026, prompt "Candidatura partnership +
// routing token prodotto + rotazione claim homepage", Parte C). Un solo
// slot reale ad oggi (Business Plan / caso Tosi Mati, dati invariati,
// prima vivevano direttamente in questa pagina) - gli altri prodotti
// hanno SOLO il claim (nessun caso reale ancora, mai inventato per
// "riempire" la rotazione). Ogni slot punta alla propria landing di
// prodotto (Parte D) quando esiste.
const slots: ClaimSlot[] = [
  {
    key: "business-plan",
    claim: "Il business plan che regge davanti a una banca.",
    subclaim:
      "Costruiamo il modello finanziario, lo mettiamo sotto stress e verifichiamo che il DSCR tenga — prima che lo faccia l'istruttore di fido.",
    ctaHref: "/business-plan",
    ctaLabel: "Scopri come lavoriamo",
    prova: {
      stato: "positivo",
      statoLabel: "Pronta per una banca",
      frase:
        "Per ogni euro di debito, l'azienda ne genera 3,18 per ripagarlo — le banche cercano almeno 1,2.",
      acronimo: {
        sigla: "DSCR",
        titolo: "DSCR — Debt Service Coverage Ratio: il flusso di cassa disponibile diviso la rata del debito.",
        valore: "3,18x",
      },
      metriche: [
        { label: "Finanziamento ottenuto", valore: "1,4M€", sub: "Finanziamento ISMEA" },
        { label: "Soglia minima richiesta dalle banche", valore: "1,2x", sub: "DSCR minimo in istruttoria" },
      ],
      dichiarazione:
        "Il nostro stesso progetto agricolo aveva bisogno di un piano industriale a sostegno di un finanziamento ISMEA. Abbiamo costruito il modello finanziario e verificato la sua tenuta con uno stress test sugli stessi parametri usati in istruttoria: il risultato è un DSCR di 3,18x, ben al di sopra della soglia minima richiesta, e il finanziamento è stato approvato.",
    },
  },
  {
    key: "analisi-aziendale",
    claim: "Sai davvero dove la tua azienda perde margine?",
    subclaim:
      "Analisi Kairós dei processi: cosa affrontare per primo, cosa può aspettare, cosa non vale il tempo che ci stai dedicando.",
    ctaHref: "/analisi-aziendale",
    ctaLabel: "Scopri come lavoriamo",
  },
  {
    key: "ricambio-generazionale",
    claim: "Il passaggio generazionale non si improvvisa.",
    subclaim:
      "Struttura societaria, fiscalità, continuità operativa: prepariamo il passaggio prima che sia l'urgenza a deciderlo per voi.",
    ctaHref: "/ricambio-generazionale",
    ctaLabel: "Scopri come lavoriamo",
  },
  {
    key: "acquisto-tee",
    claim: "Titoli di Efficienza Energetica: comprare bene, non solo comprare.",
    subclaim:
      "Ti accompagniamo nella valutazione e nell'acquisto dei TEE, verificando prezzo, controparte e conformità prima di firmare.",
    ctaHref: "/acquisto-tee",
    ctaLabel: "Scopri come lavoriamo",
  },
  {
    key: "esg",
    claim: "L'ESG non è un modulo da compilare, è un rischio da gestire.",
    subclaim:
      "Ti aiutiamo a capire cosa ti chiederanno davvero banche, clienti e bandi — e a prepararti prima che diventi un problema.",
    ctaHref: "/esg",
    ctaLabel: "Scopri come lavoriamo",
  },
  {
    key: "team-building",
    claim: "Un team che lavora bene insieme non nasce per caso.",
    subclaim:
      "Eventi di team building pensati per la tua azienda specifica, non un format uguale per tutti.",
    ctaHref: "/team-building",
    ctaLabel: "Scopri come lavoriamo",
  },
  {
    key: "formazione-aziendale",
    claim: "Formazione che resta in azienda, non solo in un attestato.",
    subclaim:
      "Corsi in azienda su misura del problema che avete davvero, non un catalogo standard.",
    ctaHref: "/formazione-aziendale",
    ctaLabel: "Scopri come lavoriamo",
  },
  {
    key: "kaizen-lean",
    claim: "Miglioramento continuo, un problema alla volta.",
    subclaim:
      "Analisi Kaizen e Lean per trovare gli sprechi reali nei tuoi processi — non un metodo calato dall'alto.",
    ctaHref: "/kaizen-lean",
    ctaLabel: "Scopri come lavoriamo",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#F7F3ED]">
      <ClaimRotator slots={slots} />

      {/* COME LAVORIAMO (generico, sotto la rotazione) + LINEA METODO */}
      <section className="border-t border-stone-200 bg-[#F7F3ED] py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-balance font-serif text-3xl font-bold text-[#1C2128] sm:text-4xl">
            Come lavoriamo
          </h2>
          <p className="mt-4 max-w-2xl text-stone-600">
            Il metodo è lo stesso per ogni prodotto: diagnosi, struttura, verifica —
            solo le fasi specifiche cambiano in base al problema che stai affrontando.
            Ogni pagina di prodotto qui sopra spiega il dettaglio.
          </p>
          <MetodoLine variant="scroll" className="mt-12 w-full sm:mt-16" />
        </div>
      </section>

      {/* CTA FINALE - navy */}
      <section className="border-t border-stone-200 bg-[#0F1E3C] py-16 sm:py-20">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-balance font-serif text-3xl font-bold text-[#F8F6F2] sm:text-4xl">
            Non sai da dove iniziare?
          </h2>
          <p className="mt-4 text-lg text-stone-300">
            Rispondi a poche domande sul tuo progetto e ricevi subito una prima analisi gratuita.
          </p>
          <div className="mt-8">
            <a
              href="/intervista"
              className="inline-flex items-center rounded-lg bg-[#D4703A] px-6 py-3 font-bold text-white shadow-lg transition-all hover:bg-[#c05f2e] hover:shadow-xl"
            >
              Fai l&rsquo;analisi gratuita
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
