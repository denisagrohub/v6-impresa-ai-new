import Link from "next/link";
import { ArrowRight, CheckCircle2, Target, TrendingUp, Users, Shield, FileText, Clock, Sparkles, Compass, Radar, Gauge, Rocket } from "lucide-react";

export default function MetodoPage() {
    const fasi = [
        {
            n: "01",
            nome: "Discovery DNA",
            desc: "Raccogliamo la tua visione, i dati grezzi e gli obiettivi in una call di 60 minuti. Usiamo un framework proprietario per estrarre le informazioni chiave.",
            deliverables: ["Questionario strategico", "Raccolta documenti base", "Mappatura obiettivi", "DNA aziendale"],
            icon: Compass,
            colore: "from-blue-500 to-cyan-500"
        },
        {
            n: "02",
            nome: "Market Radar",
            desc: "Mappiamo competitor, trend di settore, opportunità e minacce. Utilizziamo database professionali (Aida, Cerved, Euromonitor) per dati affidabili.",
            deliverables: ["Report competitor", "Analisi trend settore", "Mappatura opportunità", "Radar competitivo"],
            icon: Radar,
            colore: "from-indigo-500 to-purple-500"
        },
        {
            n: "03",
            nome: "Strategic Compass",
            desc: "Definiamo il tuo vantaggio competitivo unico, il posizionamento di mercato e la value proposition. Questa è la fase più critica del progetto.",
            deliverables: ["Value proposition", "Posizionamento strategico", "Business model canvas", "Bussola strategica"],
            icon: Target,
            colore: "from-orange-500 to-amber-500"
        },
        {
            n: "04",
            nome: "Financial Engine",
            desc: "Costruiamo il modello Excel dinamico a 5 anni: conto economico, stato patrimoniale, flussi di cassa, analisi di sensitività e scenari.",
            deliverables: ["Modello Excel 5 anni", "3 scenari finanziari", "Analisi break-even", "Dashboard KPI"],
            icon: TrendingUp,
            colore: "from-green-500 to-emerald-500"
        },
        {
            n: "05",
            nome: "StoryCraft",
            desc: "Redigiamo il documento finale con grafica professionale. Ogni sezione è curata nei dettagli: executive summary, analisi, strategia, financials, appendici.",
            deliverables: ["Business Plan PDF (30-80 pagine)", "Executive Summary 1 pagina", "Pitch Deck (per L2/L3)", "Storytelling del brand"],
            icon: FileText,
            colore: "from-purple-500 to-pink-500"
        },
        {
            n: "06",
            nome: "Impact Launch",
            desc: "Presentazione congiunta del documento, raccolta feedback, revisioni finali. Supporto post-consegna per presentazioni a banche/investitori.",
            deliverables: ["Call di presentazione", "Revisioni illimitate (15gg)", "Supporto 30 giorni", "Checklist banca"],
            icon: Rocket,
            colore: "from-red-500 to-orange-500"
        },
    ];

    const areeV6 = [
        { name: "Strategia", icon: Target, color: "bg-blue-100 text-blue-600" },
        { name: "Finanza", icon: TrendingUp, color: "bg-green-100 text-green-600" },
        { name: "Operazioni", icon: Gauge, color: "bg-orange-100 text-orange-600" },
        { name: "Persone", icon: Users, color: "bg-purple-100 text-purple-600" },
        { name: "Conformità", icon: Shield, color: "bg-red-100 text-red-600" },
        { name: "Futuro", icon: Rocket, color: "bg-cyan-100 text-cyan-600" },
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
                            <Sparkles size={16} className="text-orange-400" />
                            <span className="text-sm font-semibold">Il nostro framework proprietario</span>
                        </div>
                        <h1 className="text-5xl sm:text-6xl font-bold mb-6 leading-tight">
                            Il Metodo <span className="text-orange-400">V6</span>
                        </h1>
                        <p className="text-xl text-gray-300 leading-relaxed max-w-2xl">
                            6 fasi, 6 aree aziendali, 1 risultato: un business plan che apre le porte di banche e investitori.
                        </p>
                    </div>
                </div>
            </section>

            {/* LE 6 AREE */}
            <section className="py-16 bg-white border-b border-gray-100">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-12">
                        <h2 className="text-sm font-bold text-orange-500 uppercase tracking-wider mb-3">Le 6 Aree del Business</h2>
                        <h3 className="text-3xl font-bold text-[#1a2744]">Il metodo copre tutti gli aspetti della tua azienda</h3>
                    </div>
                    <div className="grid md:grid-cols-3 lg:grid-cols-6 gap-4">
                        {areeV6.map((area, i) => (
                            <div key={i} className="p-6 bg-gray-50 rounded-2xl border border-gray-200 text-center hover:shadow-lg transition-all hover:border-orange-300">
                                <div className={`w-12 h-12 rounded-xl ${area.color} flex items-center justify-center mx-auto mb-3`}>
                                    <area.icon size={24} />
                                </div>
                                <div className="text-sm font-bold text-[#1a2744]">{area.name}</div>
                                <div className="text-xs text-gray-500 mt-1">V6</div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* FASI (con design migliorato) */}
            <section className="py-24 bg-[#f8fafc]">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-16">
                        <h2 className="text-sm font-bold text-orange-500 uppercase tracking-wider mb-3">Il Percorso</h2>
                        <h3 className="text-4xl font-bold text-[#1a2744]">Le 6 fasi del Metodo V6</h3>
                        <p className="text-gray-500 mt-4 max-w-2xl mx-auto">
                            Ogni fase ha un obiettivo chiaro, deliverable specifici e un impatto misurabile sulla tua azienda.
                        </p>
                    </div>

                    {/* Timeline visiva */}
                    <div className="relative mb-16 hidden md:block">
                        <div className="absolute top-1/2 left-0 right-0 h-1 bg-gray-300 -translate-y-1/2" />
                        <div className="relative flex justify-between">
                            {fasi.map((fase, i) => (
                                <div key={i} className="flex flex-col items-center">
                                    <div className={`w-16 h-16 rounded-full bg-gradient-to-r ${fase.colore} flex items-center justify-center text-white font-bold text-xl shadow-lg relative z-10`}>
                                        {i + 1}
                                    </div>
                                    <div className="text-xs font-bold text-gray-700 mt-2 text-center max-w-[80px]">{fase.nome}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Card delle fasi */}
                    <div className="space-y-8">
                        {fasi.map((fase, i) => (
                            <div key={i} className="bg-white rounded-3xl p-8 lg:p-12 border border-gray-100 shadow-sm hover:shadow-lg transition-all">
                                <div className="grid lg:grid-cols-12 gap-8 items-start">
                                    <div className="lg:col-span-2">
                                        <div className={`w-16 h-16 rounded-2xl bg-gradient-to-r ${fase.colore} flex items-center justify-center text-white font-bold text-2xl`}>
                                            {fase.n}
                                        </div>
                                    </div>
                                    <div className="lg:col-span-6">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
                                                <fase.icon size={20} className="text-orange-600" />
                                            </div>
                                            <h3 className="text-2xl font-bold text-[#1a2744]">{fase.nome}</h3>
                                        </div>
                                        <p className="text-gray-600 leading-relaxed">{fase.desc}</p>
                                    </div>
                                    <div className="lg:col-span-4">
                                        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                                            <div className="text-xs font-bold text-gray-500 uppercase mb-2">📦 Deliverable</div>
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

            {/* TEMPISTICHE */}
            <section className="py-24 bg-white">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-16">
                        <h2 className="text-sm font-bold text-orange-500 uppercase tracking-wider mb-3">Tempistiche</h2>
                        <h3 className="text-4xl font-bold text-[#1a2744]">Quanto dura un progetto?</h3>
                    </div>
                    <div className="grid md:grid-cols-3 gap-6">
                        {[
                            { livello: "L1 — Startup", tempo: "48 ore", desc: "Business plan base per finanziamenti bancari", prezzo: "€1.500" },
                            { livello: "L2 — PMI", tempo: "10 giorni", desc: "Piano industriale completo con pitch deck", prezzo: "€20.000" },
                            { livello: "L3 — Corporate", tempo: "30-60 giorni", desc: "Advisory per operazioni complesse", prezzo: "€150.000+" },
                        ].map((t, i) => (
                            <div key={i} className="bg-gradient-to-br from-[#1a2744] to-[#0f172a] text-white rounded-2xl p-8 hover:scale-105 transition-transform shadow-lg">
                                <div className="text-sm text-orange-400 font-bold mb-2">{t.livello}</div>
                                <div className="text-4xl font-bold mb-3">{t.tempo}</div>
                                <div className="text-gray-300 text-sm mb-4">{t.desc}</div>
                                <div className="text-2xl font-bold text-orange-400">{t.prezzo}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* V6 ASSESSMENT - INTERATTIVO */}
            <section className="py-24 bg-gradient-to-br from-orange-50 to-white">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <h2 className="text-sm font-bold text-orange-500 uppercase tracking-wider mb-3">🎯 V6 Assessment</h2>
                    <h3 className="text-4xl font-bold text-[#1a2744] mb-6">Scopri in che fase sei</h3>
                    <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
                        Rispondi a 6 domande rapide e ricevi un report personalizzato con il pacchetto più adatto alla tua azienda.
                    </p>
                    <Link href="/intervista?assessment=true">
                        <span className="inline-flex items-center gap-2 bg-orange-500 text-white font-bold px-8 py-4 rounded-xl hover:bg-orange-600 hover:shadow-xl transition-all text-lg">
                            Inizia il V6 Assessment <ArrowRight size={20} />
                        </span>
                    </Link>
                    <p className="text-sm text-gray-500 mt-4">⏱️ Solo 2 minuti • Risultati immediati</p>
                </div>
            </section>

            {/* CTA */}
            <section className="py-24 bg-gradient-to-br from-[#1a2744] to-[#0f172a] text-white">
                <div className="max-w-4xl mx-auto px-4 text-center">
                    <h2 className="text-4xl font-bold mb-6">Pronto a iniziare il tuo percorso V6?</h2>
                    <p className="text-xl text-gray-300 mb-8">
                        Compila il form e ti contattiamo entro 24 ore per una consulenza gratuita.
                    </p>
                    <Link href="/contatti" className="inline-flex items-center gap-2 bg-orange-500 text-white font-bold px-8 py-4 rounded-full hover:bg-orange-600 transition-all">
                        Richiedi preventivo <ArrowRight size={20} />
                    </Link>
                </div>
            </section>
        </div>
    );
}
