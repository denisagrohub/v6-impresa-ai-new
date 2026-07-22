import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Business Plan Startup a €1.500 | Consegna in 48h | Progetto Impresa",
  description: "Trasforma la tua idea in un business plan professionale in 48 ore. Pacchetto Startup: PDF, Excel finanziario e presentazione per investitori. Soddisfatti o rimborsati.",
  keywords: ["business plan startup", "business plan 1500 euro", "progetto impresa", "piano industriale startup", "finanziamenti startup"],
  openGraph: {
    title: "Business Plan Startup a €1.500 | Progetto Impresa",
    description: "Trasforma la tua idea in un business plan professionale in 48 ore.",
    type: "website",
  },
};

export default function L1Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
