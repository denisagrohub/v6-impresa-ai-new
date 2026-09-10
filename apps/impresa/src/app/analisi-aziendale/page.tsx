import type { Metadata } from "next";
import ProductLandingTemplate from "@/components/products/ProductLandingTemplate";

export const metadata: Metadata = {
  title: "Analisi Aziendale con metodo Kairós | V6 Impresa AI",
  description:
    "Scopri dove la tua azienda perde margine e cosa affrontare per primo. Analisi dei processi con metodo, non impressioni.",
};

export default function AnalisiAziendalePage() {
  return (
    <ProductLandingTemplate
      productCode="analisi-aziendale"
      eyebrow="Analisi Aziendale"
      title="Sai davvero dove la tua azienda perde margine?"
      subtitle="Non un elenco di problemi generici: una diagnosi che dice cosa affrontare per primo, cosa può aspettare e cosa non merita il tempo che gli state dedicando."
      problemTitle="Il problema: troppi problemi, nessuna priorità chiara"
      problemBody="In quasi ogni azienda esiste una lista di cose che 'andrebbero migliorate' — un processo lento, un costo che cresce, un reparto che comunica male con un altro. Il problema non è individuarli: è decidere da dove iniziare senza affidarsi solo all'intuito o all'urgenza del momento, che spesso porta a risolvere il sintomo più rumoroso e non la causa più costosa."
      whyTitle="Perché farlo bene conta"
      whyBody="Affrontare il problema sbagliato per primo costa tempo e credibilità interna: il team perde fiducia nel cambiamento se il primo intervento non produce un risultato visibile. Una priorità stabilita con un metodo verificabile, invece, permette di mostrare un progresso reale nei tempi giusti — e di costruire il consenso per affrontare il resto."
      phases={[
        { n: "01", title: "Mappatura", desc: "Raccogliamo dati reali sui processi, non solo percezioni di chi li vive ogni giorno." },
        { n: "02", title: "Matrice Kairós", desc: "Classifichiamo ogni criticità per impatto e urgenza, con lo stesso metodo che usiamo su ogni progetto." },
        { n: "03", title: "Piano di intervento", desc: "Definiamo l'ordine in cui affrontare le criticità, con obiettivi misurabili per ciascuna." },
        { n: "04", title: "Verifica", desc: "Torniamo sui dati dopo l'intervento per confermare che il risultato sia reale, non presunto." },
      ]}
      primaryCtaHref="/booking/1"
    />
  );
}
