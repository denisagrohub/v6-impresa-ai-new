import type { Metadata } from "next";
import ProductLandingTemplate from "@/components/products/ProductLandingTemplate";

export const metadata: Metadata = {
  title: "Business Plan che regge in banca | V6 Impresa AI",
  description:
    "Costruiamo il modello finanziario e lo mettiamo sotto stress prima che lo faccia l'istruttore di fido. Prenota una call con un consulente.",
};

// Landing di prodotto "Business Plan" (09/09/2026, prompt "Candidatura
// partnership + routing token prodotto + rotazione claim homepage",
// Parte D). NOTA per Denis: esistevano gia' /business-plan-pmi e
// /business-plan-startup (landing standalone piu' vecchie, con form
// locale proprio, non collegate al circuito booking/intervista attuale)
// - non le ho toccate né rimosse, questa e' la landing NUOVA secondo il
// template unificato di questo prompt. Decidere se/come farle convergere
// resta una scelta tua, non presa qui.
export default function BusinessPlanPage() {
  return (
    <ProductLandingTemplate
      productCode="business-plan"
      eyebrow="Business Plan"
      title="Il business plan che regge davanti a una banca."
      subtitle="Non un documento per convincere: un modello finanziario che tiene quando qualcun altro lo metterà sotto pressione."
      problemTitle="Il problema: un business plan che sembra solido finché nessuno lo verifica"
      problemBody="Molti business plan sono scritti per convincere chi li legge la prima volta, non per resistere alla verifica di un istruttore di fido o di un investitore che conosce già tutti i trucchi delle proiezioni troppo ottimistiche. Il risultato è un piano che sembra pronto e poi si sfalda alla prima domanda scomoda su flussi di cassa, leva finanziaria o scenari conservativi."
      whyTitle="Perché farlo bene conta"
      whyBody="Un business plan che non tiene non costa solo il finanziamento mancato: costa il tempo perso a rifarlo, la credibilità con la banca o l'investitore, e spesso mesi di ritardo su un progetto che aveva davvero senso. Un piano che regge allo stress test, invece, apre la porta — e la apre una sola volta, senza dover tornare a bussare."
      phases={[
        { n: "01", title: "Diagnosi", desc: "Analizziamo l'azienda, i numeri esistenti e l'obiettivo del finanziamento." },
        { n: "02", title: "Struttura finanziaria", desc: "Costruiamo il piano a 3-5 anni: conto economico, flussi di cassa, DSCR." },
        { n: "03", title: "Accesso ai fondi", desc: "Verifichiamo la tenuta del piano negli stessi scenari conservativi che userà la banca." },
        { n: "04", title: "Validazione", desc: "Consegniamo il dossier pronto per l'istruttoria, con supporto nella presentazione." },
      ]}
      caseStudy={{
        stato: "positivo",
        statoLabel: "Pronta per una banca",
        frase: "Per ogni euro di debito, l'azienda ne genera 3,18 per ripagarlo — le banche cercano almeno 1,2.",
        metriche: [
          { label: "Finanziamento ottenuto", valore: "1,4M€", sub: "Finanziamento ISMEA" },
          { label: "Soglia minima richiesta dalle banche", valore: "1,2x", sub: "DSCR minimo in istruttoria" },
        ],
        dichiarazione:
          "Il nostro stesso progetto agricolo aveva bisogno di un piano industriale a sostegno di un finanziamento ISMEA. Abbiamo costruito il modello finanziario e verificato la sua tenuta con uno stress test sugli stessi parametri usati in istruttoria: il risultato è un DSCR di 3,18x, ben al di sopra della soglia minima richiesta, e il finanziamento è stato approvato.",
      }}
      primaryCtaHref="/contatti"
    />
  );
}
