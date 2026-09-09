import type { Metadata } from "next";
import ProductLandingTemplate from "@/components/products/ProductLandingTemplate";

export const metadata: Metadata = {
  title: "Acquisto Titoli di Efficienza Energetica (TEE) | V6 Impresa AI",
  description:
    "Ti accompagniamo nella valutazione e nell'acquisto dei TEE, verificando prezzo, controparte e conformità prima di firmare.",
};

export default function AcquistoTeePage() {
  return (
    <ProductLandingTemplate
      productCode="acquisto-tee"
      eyebrow="Titoli di Efficienza Energetica"
      title="Titoli di Efficienza Energetica: comprare bene, non solo comprare."
      subtitle="Il mercato dei TEE ha prezzo, controparte e conformità da verificare prima di ogni acquisto — non è un titolo come un altro."
      problemTitle="Il problema: un mercato che sembra semplice e non lo è"
      problemBody="Acquistare Titoli di Efficienza Energetica per rispettare un obbligo o per un'operazione finanziaria sembra, a prima vista, una transazione semplice: si trova un venditore, si concorda un prezzo, si chiude. In realtà il prezzo di mercato varia, la controparte va verificata, e la conformità normativa dell'operazione non è scontata — un errore in una di queste tre cose può costare più del risparmio che l'acquisto avrebbe dovuto generare."
      whyTitle="Perché farlo bene conta"
      whyBody="Un acquisto di TEE fatto senza verifica esposta l'azienda a rischi concreti: pagare un prezzo fuori mercato, trattare con una controparte non affidabile, o strutturare l'operazione in modo che non regga a un controllo successivo. Farlo con metodo significa proteggere sia il risparmio economico che l'azienda da conseguenze che emergono solo dopo, quando è troppo tardi per correggere."
      phases={[
        { n: "01", title: "Fabbisogno", desc: "Definiamo quanti titoli servono davvero e per quale obbligo o obiettivo." },
        { n: "02", title: "Mercato", desc: "Verifichiamo il prezzo di riferimento e le controparti disponibili in quel momento." },
        { n: "03", title: "Verifica", desc: "Controlliamo l'affidabilità della controparte e la conformità dell'operazione." },
        { n: "04", title: "Chiusura", desc: "Vi accompagniamo nella chiusura dell'operazione, non solo nella scelta iniziale." },
      ]}
      primaryCtaHref="/contatti"
    />
  );
}
