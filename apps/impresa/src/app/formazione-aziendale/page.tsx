import type { Metadata } from "next";
import ProductLandingTemplate from "@/components/products/ProductLandingTemplate";

export const metadata: Metadata = {
  title: "Formazione Aziendale su misura | V6 Impresa AI",
  description:
    "Corsi in azienda su misura del problema che avete davvero, non un catalogo standard.",
};

export default function FormazioneAziendalePage() {
  return (
    <ProductLandingTemplate
      productCode="formazione-aziendale"
      eyebrow="Formazione Aziendale"
      title="Formazione che resta in azienda, non solo in un attestato."
      subtitle="Un corso ha senso solo se cambia davvero come le persone lavorano il giorno dopo, non solo se rilascia un certificato."
      problemTitle="Il problema: formazione fatta perché 'va fatta', non perché serve"
      problemBody="Molta formazione aziendale nasce da un obbligo o da un catalogo generico, non da un problema specifico che l'azienda ha davvero. Il risultato tipico è un corso seguito con attenzione discontinua, un attestato archiviato, e nessun cambiamento reale nel modo in cui le persone lavorano — perché il contenuto non parlava della loro situazione concreta."
      whyTitle="Perché farlo bene conta"
      whyBody="Una formazione costruita sul problema reale dell'azienda — un errore che si ripete, uno strumento nuovo da adottare, una competenza che manca in un ruolo specifico — cambia effettivamente il modo di lavorare, perché le persone riconoscono nel corso la loro situazione, non un caso teorico. È la differenza tra un corso subito e un corso richiesto."
      phases={[
        { n: "01", title: "Analisi del bisogno", desc: "Capiamo qual è il problema concreto che la formazione deve risolvere." },
        { n: "02", title: "Progettazione", desc: "Costruiamo un percorso su misura, con esempi tratti dal vostro contesto reale." },
        { n: "03", title: "Formazione", desc: "Conduciamo il corso in azienda, con un formato pratico e non solo teorico." },
        { n: "04", title: "Verifica", desc: "Controlliamo con voi, dopo qualche settimana, se il comportamento è davvero cambiato." },
      ]}
      primaryCtaHref="/booking"
    />
  );
}
