import type { Metadata } from "next";

// intervista/page.tsx è "use client" - stesso motivo di contatti/layout.tsx.
export const metadata: Metadata = {
    title: "Intervista Gratuita",
    description: "Rispondi a poche domande sul tuo progetto e ricevi subito una prima analisi gratuita, in pochi minuti.",
};

export default function IntervistaLayout({ children }: { children: React.ReactNode }) {
    return children;
}
