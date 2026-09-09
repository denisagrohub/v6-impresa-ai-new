import type { Metadata } from "next";
import { Inter, Merriweather } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";

const inter = Inter({ subsets: ["latin"], display: "swap" });
const merriweather = Merriweather({
  subsets: ["latin"],
  weight: ["400", "700", "900"],
  display: "swap",
});

// 09/09/2026 (analisi SEO): metadataBase mancava - senza, i canonical/OG
// generati da ogni pagina (relativi) non si risolvono in URL assoluti
// corretti, e i social scraper (Facebook/LinkedIn/X) spesso scartano un
// og:url relativo. openGraph/twitter di default qui, ogni pagina puo'
// sovrascriverli (nessuna pagina lo fa oggi - da fare pagina per pagina
// se serve un'immagine social specifica, non inventata qui).
export const metadata: Metadata = {
  metadataBase: new URL("https://www.v6impresa.it"),
  title: {
    default: "V6 Impresa AI - Business Plan, Brand & Marketing",
    template: "%s | V6 Impresa AI",
  },
  description: "Piattaforma di consulenza avanzata per business plan, brand analysis e marketing strategico.",
  openGraph: {
    type: "website",
    locale: "it_IT",
    siteName: "V6 Impresa AI",
    title: "V6 Impresa AI - Business Plan, Brand & Marketing",
    description: "Piattaforma di consulenza avanzata per business plan, brand analysis e marketing strategico.",
  },
  twitter: {
    card: "summary_large_image",
    title: "V6 Impresa AI - Business Plan, Brand & Marketing",
    description: "Piattaforma di consulenza avanzata per business plan, brand analysis e marketing strategico.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it">
      <body
        className="antialiased"
        style={
          {
            "--font-sans": inter.style.fontFamily,
            "--font-heading": merriweather.style.fontFamily,
          } as React.CSSProperties
        }
      >
        <Navbar />
        <main className="min-h-screen">{children}</main>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}