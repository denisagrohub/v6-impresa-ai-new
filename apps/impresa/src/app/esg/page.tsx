import type { Metadata } from "next";
import ProductLandingTemplate from "@/components/products/ProductLandingTemplate";

export const metadata: Metadata = {
  title: "ESG per PMI: gestire il rischio, non solo il modulo | V6 Impresa AI",
  description:
    "Ti aiutiamo a capire cosa ti chiederanno davvero banche, clienti e bandi in materia ESG — e a prepararti prima che diventi un problema.",
};

export default function EsgPage() {
  return (
    <ProductLandingTemplate
      productCode="esg"
      eyebrow="ESG"
      title="L'ESG non è un modulo da compilare, è un rischio da gestire."
      subtitle="Banche, grandi clienti e bandi pubblici chiedono sempre più spesso dati ESG concreti — non basta più una dichiarazione di intenti."
      problemTitle="Il problema: una richiesta che arriva prima di essere pronti"
      problemBody="Molte PMI si trovano a dover rispondere a un questionario ESG di una banca, di un cliente più grande o di un bando pubblico senza avere davvero i dati per farlo con solidità: informazioni sparse, nessun processo di raccolta strutturato, nessuna misura dell'impatto reale ambientale, sociale o di governance. Il risultato è una risposta affrettata che rischia di penalizzare l'azienda proprio quando l'ESG comincia a pesare su un finanziamento, un contratto o una gara."
      whyTitle="Perché farlo bene conta"
      whyBody="Chi arriva preparato a una richiesta ESG non solo evita il rischio di una valutazione negativa: trasforma la richiesta in un vantaggio competitivo, dimostrando ai propri interlocutori — banche, clienti, enti — un livello di maturità che le PMI concorrenti spesso non hanno ancora. Farlo con metodo, e non all'ultimo momento, è quello che fa la differenza tra subire l'ESG e usarlo."
      phases={[
        { n: "01", title: "Diagnosi", desc: "Capiamo cosa vi verrà davvero richiesto (banca, cliente, bando) e a che livello di dettaglio." },
        { n: "02", title: "Raccolta dati", desc: "Strutturiamo la raccolta delle informazioni ambientali, sociali e di governance rilevanti." },
        { n: "03", title: "Reportistica", desc: "Costruiamo un dossier ESG coerente, pronto per chi lo richiede." },
        { n: "04", title: "Aggiornamento", desc: "Impostiamo un processo che regga anche alla prossima richiesta, non solo a questa." },
      ]}
      primaryCtaHref="/contatti"
    />
  );
}
