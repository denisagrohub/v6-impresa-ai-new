"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@erpv6/ui";
import KairosMatrix from "./KairosMatrix";
import StateBadge from "@/components/shared/StateBadge";

// Rotazione claim in homepage (09/09/2026, prompt "Candidatura partnership
// + routing token prodotto + rotazione claim homepage", Parte C). Claim
// SEMPRE presente, prova SOLO se reale - uno slot senza `prova` mostra
// solo claim + CTA, mai un numero/placeholder inventato per "riempire".
//
// Navigazione SEMPRE manuale (freccie/pallini), MAI automatica a tempo:
// un dato che richiede un secondo per essere letto (traduzione DSCR-style)
// non va fatto scorrere da solo (motivazione esplicita del prompt).
export interface ClaimSlot {
    key: string;
    claim: string;
    subclaim: string;
    ctaHref: string;
    ctaLabel: string;
    /** Assente = nessun caso reale ancora, mostra solo claim (mai un placeholder). */
    prova?: {
        stato: "positivo" | "attenzione" | "critico";
        statoLabel: string;
        frase: string; // metrica tradotta in linguaggio umano PRIMA del tecnicismo
        acronimo?: { sigla: string; titolo: string; valore: string };
        metriche: { label: string; valore: string; sub: string }[];
        dichiarazione: string; // dichiarazione esplicita se e' un caso interno
    };
}

export default function ClaimRotator({ slots }: { slots: ClaimSlot[] }) {
    const [active, setActive] = useState(0);
    if (!slots.length) return null;
    const slot = slots[active];

    const goTo = (i: number) => setActive((i + slots.length) % slots.length);

    return (
        <div>
            {/* HERO - navy, claim sempre presente */}
            <section className="bg-[#0F1E3C] px-4 pb-16 pt-14 sm:px-6 sm:pt-20 lg:px-8 lg:pt-24">
                <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-16">
                    <div>
                        <h1 className="text-balance font-serif text-4xl font-bold leading-[1.1] text-[#F8F6F2] sm:text-5xl lg:text-6xl">
                            {slot.claim}
                        </h1>
                        <p className="mt-6 max-w-xl text-lg leading-relaxed text-stone-300 sm:text-xl">
                            {slot.subclaim}
                        </p>

                        <div className="mt-8 flex flex-wrap items-center gap-4">
                            <Link href={slot.ctaHref}>
                                <Button size="lg" className="bg-[#D4703A] shadow-lg hover:bg-[#c05f2e] hover:shadow-xl">
                                    {slot.ctaLabel}
                                    <ArrowRight size={18} className="ml-2" aria-hidden="true" />
                                </Button>
                            </Link>

                            {/* Navigazione manuale - MAI automatica a tempo */}
                            {slots.length > 1 && (
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        aria-label="Slot precedente"
                                        onClick={() => goTo(active - 1)}
                                        className="flex h-9 w-9 items-center justify-center rounded-full border border-stone-600 text-stone-300 transition-colors hover:border-stone-400 hover:text-white"
                                    >
                                        <ChevronLeft size={18} aria-hidden="true" />
                                    </button>
                                    <div className="flex items-center gap-1.5" role="tablist" aria-label="Prodotti">
                                        {slots.map((s, i) => (
                                            <button
                                                key={s.key}
                                                type="button"
                                                role="tab"
                                                aria-selected={i === active}
                                                aria-label={s.claim}
                                                onClick={() => goTo(i)}
                                                className={`h-2 w-2 rounded-full transition-all ${i === active ? "w-5 bg-[#D4703A]" : "bg-stone-600 hover:bg-stone-400"}`}
                                            />
                                        ))}
                                    </div>
                                    <button
                                        type="button"
                                        aria-label="Slot successivo"
                                        onClick={() => goTo(active + 1)}
                                        className="flex h-9 w-9 items-center justify-center rounded-full border border-stone-600 text-stone-300 transition-colors hover:border-stone-400 hover:text-white"
                                    >
                                        <ChevronRight size={18} aria-hidden="true" />
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="rounded-2xl bg-[#F7F3ED] p-6 shadow-lg sm:p-8">
                        <KairosMatrix />
                        <p className="mt-4 text-sm text-stone-500">
                            La Matrice di Kairós: il metodo con cui decidiamo cosa affrontare
                            per primo nella tua azienda.
                        </p>
                    </div>
                </div>
            </section>

            {/* PROVA - solo se reale, mai un placeholder */}
            {slot.prova && (
                <section className="bg-[#F7F3ED] py-16 sm:py-20">
                    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
                        <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm sm:p-10">
                            <StateBadge stato={slot.prova.stato}>{slot.prova.statoLabel}</StateBadge>

                            <p className="mt-6 text-balance font-serif text-2xl font-bold leading-snug text-[#1C2128] sm:text-3xl">
                                {slot.prova.frase}
                            </p>

                            {slot.prova.acronimo && (
                                <p className="mt-3 text-sm text-stone-500">
                                    <abbr title={slot.prova.acronimo.titolo} className="cursor-help underline decoration-dotted underline-offset-2">
                                        {slot.prova.acronimo.sigla}
                                    </abbr>{" "}
                                    {slot.prova.acronimo.valore}
                                </p>
                            )}

                            <div className="mt-8 grid grid-cols-1 gap-8 border-t border-stone-100 pt-8 sm:grid-cols-2">
                                {slot.prova.metriche.map((m) => (
                                    <div key={m.label}>
                                        <p className="text-sm font-semibold uppercase tracking-wide text-stone-500">{m.label}</p>
                                        <p className="mt-2 font-serif text-4xl font-bold text-[#1C2128]">{m.valore}</p>
                                        <p className="mt-1 text-sm text-stone-500">{m.sub}</p>
                                    </div>
                                ))}
                            </div>

                            <p className="mt-8 border-t border-stone-100 pt-6 text-base leading-relaxed text-stone-600">
                                {slot.prova.dichiarazione}
                            </p>
                        </div>
                    </div>
                </section>
            )}
        </div>
    );
}
