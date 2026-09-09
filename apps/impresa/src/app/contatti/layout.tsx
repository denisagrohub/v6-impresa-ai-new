import type { Metadata } from "next";

// contatti/page.tsx è "use client" - un Client Component non può esportare
// `metadata` direttamente (richiesto da un Server Component). Layout
// minimo solo per questo, nessuna UI propria (il body arriva già completo
// da Navbar in layout.tsx radice).
export const metadata: Metadata = {
    title: "Contatti",
    description: "Parliamo del tuo progetto: scrivici o compila il form, rispondiamo entro 24 ore lavorative.",
};

export default function ContattiLayout({ children }: { children: React.ReactNode }) {
    return children;
}
