import type { Metadata } from "next";
import ProductLandingTemplate from "@/components/products/ProductLandingTemplate";

export const metadata: Metadata = {
  title: "Ricambio Generazionale in azienda | V6 Impresa AI",
  description:
    "Struttura societaria, fiscalità e continuità operativa: prepariamo il passaggio generazionale prima che sia l'urgenza a deciderlo.",
};

export default function RicambioGenerazionalePage() {
  return (
    <ProductLandingTemplate
      productCode="ricambio-generazionale"
      eyebrow="Ricambio Generazionale"
      title="Il passaggio generazionale non si improvvisa."
      subtitle="Chi guida l'azienda oggi e chi la guiderà domani hanno bisogno di una struttura chiara, non di una decisione presa in fretta quando il tempo è già scaduto."
      problemTitle="Il problema: un passaggio rimandato finché non diventa un'emergenza"
      problemBody="Il ricambio generazionale è un tema che quasi tutti gli imprenditori sanno essere importante e quasi nessuno affronta per tempo. Si rimanda perché è delicato — coinvolge la famiglia, i ruoli, i rapporti — finché un evento imprevisto (una malattia, un disaccordo, un'occasione persa) lo trasforma da scelta strategica a urgenza da gestire senza preparazione, spesso con costi fiscali e organizzativi molto più alti di quanto sarebbero stati se pianificati."
      whyTitle="Perché farlo bene conta"
      whyBody="Un passaggio generazionale ben preparato protegge il valore costruito in anni di lavoro: la struttura societaria giusta, la fiscalità gestita con anticipo e i ruoli chiariti prima che diventino motivo di conflitto fanno la differenza tra un'azienda che continua a crescere e una che si blocca proprio nel momento del cambio. Non è solo una questione tecnica: è la garanzia che il lavoro di una generazione non vada perso nel passaggio alla successiva."
      phases={[
        { n: "01", title: "Ascolto", desc: "Capiamo la situazione familiare e aziendale reale, non solo l'organigramma formale." },
        { n: "02", title: "Struttura", desc: "Valutiamo l'assetto societario e fiscale più adatto al passaggio specifico." },
        { n: "03", title: "Piano di transizione", desc: "Definiamo tempi, ruoli e responsabilità del passaggio, con tappe verificabili." },
        { n: "04", title: "Accompagnamento", desc: "Restiamo al fianco di chi lascia e di chi arriva finché la transizione non è davvero completata." },
      ]}
      primaryCtaHref="/booking"
    />
  );
}
