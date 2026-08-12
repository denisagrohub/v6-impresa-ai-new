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

export const metadata: Metadata = {
  title: "V6 Impresa AI - Business Plan, Brand & Marketing",
  description: "Piattaforma di consulenza avanzata per business plan, brand analysis e marketing strategico.",
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