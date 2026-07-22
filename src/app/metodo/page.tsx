import Link from "next/link";
import { ArrowRight, CheckCircle2, FileText, TrendingUp, Target, Users, Shield, Clock } from "lucide-react";

export default function MetodoPage() {
    const fasi = [
        {
            n: "01",
            t: "Audit & Intervista",
            d: "Raccogliamo la tua visione, i dati grezzi e gli obiettivi in una call di 60 minuti. Usiamo un framework proprietario per estrarre le informazioni chiave.",
            deliverables: ["Questionario strategico", "Raccolta documenti base", "Mappatura obiettivi"],
            icon: Users,
        },
        {
            n: "02",
            t: "Analisi di Mercato",
            d: "Mappiamo competitor, trend di settore, opportunità e minacce. Utilizziamo database professionali (Aida, Cerved, Euromonitor) per dati affidabili.",
            deliverables: ["Report competitor", "Analisi trend settore", "Mappatura opportunità"],
            icon: Target,
        },
        {
            n: "03",
            t: "Strategia & Posizionamento",
            d: "Definiamo il tuo vantaggio competitivo unico, il posizionamento di mercato e la value proposition. Questa è la fase più critica del progetto.",
            deliverables: ["Value proposition", "Posizionamento strategico", "Business model canvas"],
            icon: Shield,
        },
        {
            n: "04",
            t: "Financial Modeling",
            d: "Costruiamo il modello Excel dinamico a 5 anni: conto economico, stato patrimoniale, flussi di cassa, analisi di sensitività e scenari (base, upside, downside).",
            deliverables: ["Modello Excel 5 anni", "3 scenari finanziari", "Analisi break-even", "KPI dashboard"],
            icon: TrendingUp,
        },
        {
            n: "05",
            t: "Stesura & Design",
            d: "Redigiamo il documento finale con grafica professionale. Ogni sezione è curata nei dettagli: executive summary, analisi, strategia, financials, appendici.",
            deliverables: ["Business Plan PDF (30-80 pagine)", "Executive Summary 1 pagina", "Pitch Deck (per L2/L3)"],
            icon: FileText,
        },
        {
            n: "06",
            t: "Revisione & Consegna",
            d: "Presentazione congiunta del documento, raccolta feedback, revisioni finali. Supporto post-consegna per presentazioni a banche/investitori.",
            deliverables: ["Call di presentazione", "Revisioni illimitate (15gg)", "Supporto 30 giorni"],
            icon: Clock,
        },
    ];

    return (
        <div className="min-h-screen bg-white">
            {/* HERO */}
            <section className="relative py-24 bg-gradient-to-br from-[#1a2744] to-[#0f172a] text-white overflow-hidden">
                <div className="absolute inset-0 opacity-20">
                    <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-orange-500 rounded-full mix-blend-multiply filter blur-3xl" />
                </div>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                    <div className="max-w-3xl">
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 mb-6">
                            <span className="text-sm font-semibold">Il nostro framework proprietario</span>
                        </div>
                        <h1 className="text-5xl sm:text-6xl font-bold mb-6 leading-tight">
                            Il Metodo <span className="text-orange-400">V6</span>
                        </h1>
                        <p className="text-xl text-gray-300 leading-relaxed">
                            6 fasi rigorose, deliverables chiari, tempistiche definite. Il processo che ci permette di consegnare business plan di qualità bancaria in tempi record.
                        </p>
                    </div>
                </div>
            </section>

            {/* INTRO */}
            <section className="py-20 bg-white">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <h2 className="text-3xl font-bold text-[#1a2744] mb-6">Perché un metodo strutturato?</h2>
                    <p className="text-lg text-gray-600 leading-relaxed">
                        La maggior parte dei consulenti improvvisa. Noi no. Ogni progetto segue lo stesso processo collaudato, adattato alle specificità del cliente. Questo ci permette di garantire qualità, tempistiche e risultati coerenti.
                    </p>
                </div>
            </section>

            {/* FASI */}
            <section className="py-24 bg-[#f8fafc]">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="space-y-8">
                        {fasi.map((fase, i) => (
                            <div key={i} className="bg-white rounded-3xl p-8 lg:p-12 border border-gray-100 shadow-sm hover:shadow-lg transition-all">
                                <div className="grid lg:grid-cols-12 gap-8 items-start">
                                    <div className="lg:col-span-2">
                                        <div className="text-6xl font-bold text-orange-500 font-mono">{fase.n}</div>
                                    </div>
                                    <div className="lg:col-span-7">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
                                                <fase.icon size={20} className="text-orange-600" />
                                            </div>
                                            <h3 className="text-2xl font-bold text-[#1a2744]">{fase.t}</h3>
                                        </div>
                                        <p className="text-gray-600 leading-relaxed">{fase.d}</p>
                                    </div>
                                    <div className="lg:col-span-3">
                                        <div className="bg-gray-50 rounded-xl p-4">
                                            <div className="text-xs font-bold text-gray-500 uppercase mb-2">Deliverables</div>
                                            <ul className="space-y-2">
                                                {fase.deliverables.map((d, j) => (
                                                    <li key={j} className="text-sm text-gray-700 flex items-start gap-2">
                                                        <CheckCircle2 size={14} className="text-green-500 mt-0.5 flex-shrink-0" />
                                                        <span>{d}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* TIMELINE */}
            <section className="py-24 bg-white">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-16">
                        <h2 className="text-sm font-bold text-orange-500 uppercase tracking-wider mb-3">Tempistiche</h2>
                        <h3 className="text-4xl font-bold text-[#1a2744]">Quanto dura un progetto?</h3>
                    </div>
                    <div className="grid md:grid-cols-3 gap-6">
                        {[
                            { livello: "L1 — Startup", tempo: "48 ore", desc: "Business plan base per finanziamenti bancari" },
                            { livello: "L2 — PMI", tempo: "10 giorni", desc: "Piano industriale completo con pitch deck" },
                            { livello: "L3 — Corporate", tempo: "30-60 giorni", desc: "Advisory per operazioni complesse" },
                        ].map((t, i) => (
                            <div key={i} className="bg-gradient-to-br from-[#1a2744] to-[#0f172a] text-white rounded-2xl p-8">
                                <div className="text-sm text-orange-400 font-bold mb-2">{t.livello}</div>
                                <div className="text-4xl font-bold mb-3">{t.tempo}</div>
                                <div className="text-gray-300 text-sm">{t.desc}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA */}
            <section className="py-24 bg-gradient-to-br from-[#1a2744] to-[#0f172a] text-white">
                <div className="max-w-4xl mx-auto px-4 text-center">
                    <h2 className="text-4xl font-bold mb-6">Pronto a iniziare?</h2>
                    <p className="text-xl text-gray-300 mb-8">
                        Compila il form e ti contattiamo entro 24 ore per una consulenza gratuita.
                    </p>
                    <Link href="/form" className="inline-flex items-center gap-2 bg-orange-500 text-white font-bold px-8 py-4 rounded-full hover:bg-orange-600 transition-all">
                        Inizia il tuo progetto <ArrowRight size={20} />
                    </Link>
                </div>
            </section>
        </div>
    );
}
