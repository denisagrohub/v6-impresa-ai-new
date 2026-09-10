import Link from "next/link";
import { ArrowLeft, ArrowRight, PhoneCall, Sparkles } from "lucide-react";
import { Button } from "@erpv6/ui";
import StateBadge from "@/components/shared/StateBadge";

// Template landing di prodotto riusabile (09/09/2026, prompt "Candidatura
// partnership + routing token prodotto + rotazione claim homepage",
// Parte D). Un motore/template, tante presentazioni (stesso principio
// gia' applicato altrove nel progetto) - ogni pagina di prodotto passa
// solo i propri contenuti, mai duplica questo layout.
//
// Regole vincolanti riportate qui perche' valgono per OGNI istanza:
// - CTA primaria UNICA per questi prodotti: "Prenota una call", MAI una
//   promessa di output automatico/immediato (Win-Win e' l'unico prodotto
//   self-service con output automatico verso il cliente, per design -
//   tutti gli altri sono consulenza-con-call by design, non "non ancora
//   pronti").
// - CTA secondaria SEMPRE visibile: scorciatoia verso l'intervista
//   Win-Win self-service, con il parametro di provenienza (Parte B)
//   passato per tracciare il contesto - mai una promessa che QUESTO
//   prodotto si generi automaticamente.
// - caseStudy assente = nessuna sezione mostrata (mai un placeholder).
export interface ProductPhase {
    n: string;
    title: string;
    desc: string;
}

export interface ProductCaseStudy {
    stato: "positivo" | "attenzione" | "critico";
    statoLabel: string;
    frase: string;
    metriche: { label: string; valore: string; sub: string }[];
    dichiarazione: string;
}

export interface ProductLandingProps {
    productCode: string;
    eyebrow: string;
    title: string;
    subtitle: string;
    problemTitle: string;
    problemBody: string;
    whyTitle: string;
    whyBody: string;
    phases: ProductPhase[];
    caseStudy?: ProductCaseStudy;
    /** Href reale per "Prenota una call" - deve puntare al sistema di
     * booking vero (/booking/[consultantId], aeosv6_booking), MAI a
     * /contatti come fallback (corretto il 10/09/2026 su richiesta
     * esplicita di Denis: "quando prenoto una call non devo essere
     * reindirizzato ai contatti"). Oggi punta a /booking/1 (Stefano
     * Puglisi, erpv6.consulting.consultant id=1) per tutti i prodotti:
     * e' l'UNICO consulente con link di prenotazione reali e non scaduti
     * al momento della scrittura (verificato su erpv6_booking_token) -
     * nessun altro consulente aveva slot validi. Quando
     * erpv6.landing.product.route (Parte B) sara' popolata per prodotto,
     * questo default va sostituito con un lookup dinamico per prodotto
     * invece di un id fisso uguale per tutti. */
    primaryCtaHref: string;
}

export default function ProductLandingTemplate(props: ProductLandingProps) {
    const {
        productCode, eyebrow, title, subtitle, problemTitle, problemBody,
        whyTitle, whyBody, phases, caseStudy, primaryCtaHref,
    } = props;

    return (
        <main className="min-h-screen bg-[#F7F3ED]">
            {/* HERO */}
            <section className="bg-[#0F1E3C] px-4 pb-16 pt-14 sm:px-6 sm:pt-20 lg:px-8 lg:pt-24">
                <div className="mx-auto max-w-4xl">
                    {/* 10/09/2026 (Denis: "serve il pulsante indietro") - le
                        landing di prodotto non avevano nessun link esplicito
                        per tornare indietro oltre il "Home" nel menu, poco
                        riconoscibile come "indietro". */}
                    <Link
                        href="/"
                        className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-stone-300 transition-colors hover:text-white"
                    >
                        <ArrowLeft size={14} aria-hidden="true" />
                        Torna alla home
                    </Link>
                    <div className="text-center">
                    <p className="text-sm font-semibold uppercase tracking-widest text-[#D4703A]">{eyebrow}</p>
                    <h1 className="mt-4 text-balance font-serif text-4xl font-bold leading-[1.1] text-[#F8F6F2] sm:text-5xl">
                        {title}
                    </h1>
                    <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-stone-300 sm:text-xl">
                        {subtitle}
                    </p>
                    <DualCta productCode={productCode} primaryCtaHref={primaryCtaHref} className="mt-8 justify-center" />
                    </div>
                </div>
            </section>

            {/* IL PROBLEMA */}
            <section className="py-16 sm:py-20">
                <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
                    <h2 className="text-balance font-serif text-3xl font-bold text-[#1C2128] sm:text-4xl">
                        {problemTitle}
                    </h2>
                    <p className="mt-6 text-lg leading-relaxed text-stone-600">{problemBody}</p>
                </div>
            </section>

            {/* PERCHE' CONTA */}
            <section className="border-t border-stone-200 bg-white py-16 sm:py-20">
                <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
                    <h2 className="text-balance font-serif text-3xl font-bold text-[#1C2128] sm:text-4xl">
                        {whyTitle}
                    </h2>
                    <p className="mt-6 text-lg leading-relaxed text-stone-600">{whyBody}</p>
                </div>
            </section>

            {/* COME LAVORIAMO */}
            <section className="py-16 sm:py-20">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <h2 className="text-balance font-serif text-3xl font-bold text-[#1C2128] sm:text-4xl">
                        Come lavoriamo
                    </h2>
                    <div className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
                        {phases.map((p) => (
                            <div key={p.n}>
                                <p className="text-xs font-semibold uppercase tracking-widest text-stone-400">Fase {p.n}</p>
                                <h3 className="mt-1 text-lg font-bold text-[#1C2128]">{p.title}</h3>
                                <p className="mt-2 text-sm leading-relaxed text-stone-600">{p.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CASO STUDIO - solo se reale, mai una sezione fabbricata */}
            {caseStudy && (
                <section className="border-t border-stone-200 bg-[#F7F3ED] py-16 sm:py-20">
                    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
                        <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm sm:p-10">
                            <StateBadge stato={caseStudy.stato}>{caseStudy.statoLabel}</StateBadge>
                            <p className="mt-6 text-balance font-serif text-2xl font-bold leading-snug text-[#1C2128] sm:text-3xl">
                                {caseStudy.frase}
                            </p>
                            <div className="mt-8 grid grid-cols-1 gap-8 border-t border-stone-100 pt-8 sm:grid-cols-2">
                                {caseStudy.metriche.map((m) => (
                                    <div key={m.label}>
                                        <p className="text-sm font-semibold uppercase tracking-wide text-stone-500">{m.label}</p>
                                        <p className="mt-2 font-serif text-4xl font-bold text-[#1C2128]">{m.valore}</p>
                                        <p className="mt-1 text-sm text-stone-500">{m.sub}</p>
                                    </div>
                                ))}
                            </div>
                            <p className="mt-8 border-t border-stone-100 pt-6 text-base leading-relaxed text-stone-600">
                                {caseStudy.dichiarazione}
                            </p>
                        </div>
                    </div>
                </section>
            )}

            {/* CTA FINALE */}
            <section className="border-t border-stone-200 bg-[#0F1E3C] py-16 sm:py-20">
                <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
                    <h2 className="text-balance font-serif text-3xl font-bold text-[#F8F6F2] sm:text-4xl">
                        Parliamone.
                    </h2>
                    <p className="mt-4 text-lg text-stone-300">
                        Una call di 30 minuti per capire se e come possiamo aiutarti con questo problema specifico.
                    </p>
                    <DualCta productCode={productCode} primaryCtaHref={primaryCtaHref} className="mt-8 justify-center" />
                </div>
            </section>
        </main>
    );
}

function DualCta({ productCode, primaryCtaHref, className = "" }: { productCode: string; primaryCtaHref: string; className?: string }) {
    return (
        <div className={`flex flex-wrap items-center gap-4 ${className}`}>
            <Link href={primaryCtaHref}>
                <Button size="lg" className="bg-[#D4703A] shadow-lg hover:bg-[#c05f2e] hover:shadow-xl">
                    <PhoneCall size={18} className="mr-2" aria-hidden="true" />
                    Prenota una call
                </Button>
            </Link>
            <Link
                href={`/intervista?source=${encodeURIComponent(productCode)}`}
                className="inline-flex items-center gap-2 rounded-lg border border-stone-500 px-5 py-3 text-sm font-semibold text-stone-200 transition-colors hover:border-stone-300 hover:text-white"
            >
                <Sparkles size={16} aria-hidden="true" />
                Vuoi qualcosa subito? Fai l&rsquo;intervista gratuita
                <ArrowRight size={14} aria-hidden="true" />
            </Link>
        </div>
    );
}
