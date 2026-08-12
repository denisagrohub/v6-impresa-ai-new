import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Project Finance e Business Plan per Grandi Imprese | Progetto Impresa",
  description: "Consulenza strategica, Financial Modeling e supporto alla raccolta capitali per grandi imprese. Teaser, Information Memorandum e Data Room. Riservatezza garantita.",
  keywords: ["project finance", "business plan grandi imprese", "financial modeling", "raccolta capitali", "M&A advisory", "information memorandum"],
  openGraph: {
    title: "Project Finance e Advisory per Grandi Imprese",
    description: "Consulenza strategica e financial modeling per operazioni complesse.",
    type: "website",
  },
};

export default function L3Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
