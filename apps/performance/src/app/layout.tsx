import type { Metadata, Viewport } from "next";
import { Inter, Merriweather } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-inter" });
const merriweather = Merriweather({
  subsets: ["latin"],
  weight: ["400", "700", "900"],
  display: "swap",
  variable: "--font-merriweather",
});

export const metadata: Metadata = {
  title: "V6 Performance — Un motore gestionale che si adatta al tuo settore",
  description:
    "erpv6 è un motore gestionale in costruzione che si adatta al settore di chi lo usa, invece di un ERP generico. In test con i primi partner reali: carrozzeria e tipografia.",
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#f0f9ff",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it">
      <body
        className={`${inter.variable} ${merriweather.variable} antialiased`}
        style={
          {
            "--font-sans": "var(--font-inter)",
            "--font-heading": "var(--font-merriweather)",
          } as React.CSSProperties
        }
      >
        <a
          href="#contenuto"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-lg focus:bg-sky-700 focus:px-4 focus:py-2 focus:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-sky-500"
        >
          Vai al contenuto
        </a>
        {children}
      </body>
    </html>
  );
}
