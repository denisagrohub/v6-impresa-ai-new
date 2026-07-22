import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Business Plan per PMI in Crescita | Piano Industriale €20.000 | Progetto Impresa",
  description: "Piano industriale, analisi finanziaria avanzata e Pitch Deck per investitori. Pacchetto PMI: consulenza strategica, modello Excel 5 anni e supporto bancario. Consegna in 10 giorni.",
  keywords: ["business plan PMI", "piano industriale", "pitch deck investitori", "consulenza strategica PMI", "raccolta capitali", "business plan 20000 euro"],
  openGraph: {
    title: "Business Plan per PMI in Crescita | Progetto Impresa",
    description: "Piano industriale, analisi finanziaria avanzata e Pitch Deck per investitori.",
    type: "website",
  },
};

export default function L2Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
