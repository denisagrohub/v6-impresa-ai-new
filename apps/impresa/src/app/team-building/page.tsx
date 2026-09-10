import type { Metadata } from "next";
import ProductLandingTemplate from "@/components/products/ProductLandingTemplate";

export const metadata: Metadata = {
  title: "Eventi di Team Building su misura | V6 Impresa AI",
  description:
    "Eventi di team building pensati per la tua azienda specifica, non un format uguale per tutti.",
};

export default function TeamBuildingPage() {
  return (
    <ProductLandingTemplate
      productCode="team-building"
      eyebrow="Team Building"
      title="Un team che lavora bene insieme non nasce per caso."
      subtitle="Un evento di team building ha senso solo se parte dalle tensioni e dagli obiettivi reali del vostro team, non da un format preconfezionato."
      problemTitle="Il problema: un evento divertente che non cambia nulla il lunedì dopo"
      problemBody="Molti eventi di team building sono piacevoli il giorno stesso e non lasciano traccia nella settimana successiva: un'attività generica, uguale per qualsiasi azienda, che intrattiene ma non affronta le vere dinamiche del gruppo — la comunicazione tra reparti, la fiducia tra ruoli diversi, o semplicemente la conoscenza reciproca in un team che è cresciuto in fretta."
      whyTitle="Perché farlo bene conta"
      whyBody="Un evento costruito sulle dinamiche reali del vostro team produce un effetto che dura oltre la giornata stessa: relazioni più solide, comunicazione più fluida, e a volte la scoperta di una tensione che nessuno aveva mai nominato apertamente. Il tempo e il budget investiti in un evento hanno senso solo se lasciano qualcosa in azienda, non solo un buon ricordo."
      phases={[
        { n: "01", title: "Ascolto", desc: "Parliamo con voi per capire le dinamiche reali del team, non solo l'occasione (es. un traguardo raggiunto)." },
        { n: "02", title: "Progettazione", desc: "Costruiamo un format su misura, non un pacchetto standard applicato a qualunque gruppo." },
        { n: "03", title: "Evento", desc: "Conduciamo la giornata con attenzione a quello che emerge, non solo al programma previsto." },
        { n: "04", title: "Follow-up", desc: "Restituiamo alcune osservazioni concrete utili al lavoro quotidiano del team, non solo foto e ricordi." },
      ]}
      primaryCtaHref="/booking/1"
    />
  );
}
