import type { Metadata } from "next";
import ProductLandingTemplate from "@/components/products/ProductLandingTemplate";

export const metadata: Metadata = {
  title: "Analisi Kaizen e Lean per PMI | V6 Impresa AI",
  description:
    "Miglioramento continuo, un problema alla volta: troviamo gli sprechi reali nei vostri processi, non un metodo calato dall'alto.",
};

export default function KaizenLeanPage() {
  return (
    <ProductLandingTemplate
      productCode="kaizen-lean"
      eyebrow="Kaizen &amp; Lean"
      title="Miglioramento continuo, un problema alla volta."
      subtitle="Kaizen e Lean non sono uno slogan da appendere in ufficio: sono un metodo per trovare gli sprechi reali nei vostri processi e correggerli con costanza."
      problemTitle="Il problema: sprechi invisibili perché sono normali"
      problemBody="In ogni azienda esistono sprechi di tempo, materiali o passaggi inutili che nessuno nota più perché fanno parte della routine da sempre. Non sono errori evidenti: sono piccole inefficienze accumulate — un'attesa, un doppio controllo, un passaggio di consegna poco chiaro — che insieme pesano sui costi e sui tempi molto più di quanto sembri guardando ogni singolo caso."
      whyTitle="Perché farlo bene conta"
      whyBody="Il metodo Kaizen non promette una rivoluzione: promette un miglioramento continuo, verificabile passo dopo passo, che nel tempo produce un risultato molto più solido di un intervento straordinario isolato. Applicarlo con metodo — non come slogan motivazionale ma come pratica reale — è quello che distingue un'azienda che migliora davvero da una che ne parla soltanto."
      phases={[
        { n: "01", title: "Osservazione", desc: "Osserviamo il processo reale sul campo, non solo come è descritto sulla carta." },
        { n: "02", title: "Individuazione sprechi", desc: "Identifichiamo gli sprechi concreti (tempo, materiali, passaggi) con dati, non impressioni." },
        { n: "03", title: "Piccoli interventi", desc: "Proponiamo correzioni mirate e verificabili, non una riorganizzazione generale." },
        { n: "04", title: "Ripetizione", desc: "Impostiamo il ciclo perché il miglioramento continui anche dopo il nostro intervento." },
      ]}
      primaryCtaHref="/contatti"
    />
  );
}
