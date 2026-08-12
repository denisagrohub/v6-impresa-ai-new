import Link from "next/link";
import { ArrowRight, Award, Users, Target, Heart, CheckCircle2 } from "lucide-react";

export default function ChiSiamoPage() {
    const team = [
        { nome: "Il Fondatore", ruolo: "CEO & Strategy Director", bio: "15+ anni in consulenza finanziaria. Ha strutturato operazioni per oltre €50M.", iniziali: "F" },
        { nome: "Christian", ruolo: "Lead Financial Analyst", bio: "Ex investment banking. Specialista in financial modeling e due diligence.", iniziali: "C" },
        { nome: "Davide", ruolo: "Business Analyst", bio: "Esperto in analisi di mercato e ricerca bandi. Supporta i progetti L1 e L2.", iniziali: "D" },
    ];

    const valori = [
        { icon: Target, title: "Risultati concreti", desc: "Non vendiamo documenti. Vendiamo finanziamenti ottenuti." },
        { icon: Heart, title: "Trasparenza totale", desc: "Prezzi chiari, tempistiche definite, zero sorprese." },
        { icon: Award, title: "Eccellenza metodologica", desc: "Il Metodo V6 è il nostro asset proprietario." },
        { icon: Users, title: "Partnership, non fornitura", desc: "Ti affianchiamo fino al closing dell'operazione." },
    ];

    return (
        <div className="min-h-screen bg-white">
            {/* HERO */}
            <section className="relative py-24 bg-gradient-to-br from-[#1a2744] to-[#0f172a] text-white overflow-hidden">
                <div className="absolute inset-0 opacity-20">
                    <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-orange-500 rounded-full mix-blend-multiply filter blur-3xl" />
                </div>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                    <div className="max-w-3xl">
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 mb-6">
                            <span className="text-sm font-semibold">La nostra storia</span>
                        </div>
                        <h1 className="text-5xl sm:text-6xl font-bold mb-6 leading-tight">
                            Costruiamo il futuro delle <span className="text-orange-400">imprese italiane</span>
                        </h1>
                        <p className="text-xl text-gray-300 leading-relaxed">
                            Siamo un team di consulenti finanziari, analisti e strateghi. La nostra missione: trasformare idee complesse in strutture finanziarie solide, approvate da banche e investitori.
                        </p>
                    </div>
                </div>
            </section>

            {/* NUMERI */}
            <section className="py-16 bg-white border-b border-gray-100">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
                        {[
                            { val: "2018", label: "Anno di fondazione" },
                            { val: "200+", label: "Progetti completati" },
                            { val: "€50M+", label: "Finanziamenti ottenuti" },
                            { val: "98%", label: "Clienti soddisfatti" },
                        ].map((stat, i) => (
                            <div key={i}>
                                <div className="text-4xl font-bold text-orange-500 mb-2">{stat.val}</div>
                                <div className="text-sm text-gray-500 uppercase tracking-wider">{stat.label}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* STORIA */}
            <section className="py-24 bg-[#f8fafc]">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                    <h2 className="text-sm font-bold text-orange-500 uppercase tracking-wider mb-3">La nostra storia</h2>
                    <h3 className="text-4xl font-bold text-[#1a2744] mb-8">Da un'idea a un metodo</h3>
                    <div className="space-y-6 text-lg text-gray-700 leading-relaxed">
                        <p>
                            Progetto Impresa nasce nel 2018 dall'esigenza di colmare un gap nel mercato italiano della consulenza finanziaria: <strong>le PMI e le startup avevano bisogno di business plan professionali, ma i tempi e i costi dei grandi studi erano proibitivi</strong>.
                        </p>
                        <p>
                            Abbiamo sviluppato il <strong>Metodo V6</strong>, un processo strutturato in 6 fasi che ci permette di consegnare documenti di qualità bancaria in tempi record, mantenendo un approccio su misura per ogni cliente.
                        </p>
                        <p>
                            Oggi siamo un team di 3 professionisti specializzati, con oltre 200 progetti completati e più di €50 milioni di finanziamenti ottenuti per i nostri clienti. Lavoriamo con startup, PMI e grandi imprese, offrendo un servizio che va dal business plan base fino all'advisory per operazioni di M&A e project finance.
                        </p>
                    </div>
                </div>
            </section>

            {/* VALORI */}
            <section className="py-24 bg-white">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-16">
                        <h2 className="text-sm font-bold text-orange-500 uppercase tracking-wider mb-3">I nostri valori</h2>
                        <h3 className="text-4xl font-bold text-[#1a2744]">Cosa ci guida ogni giorno</h3>
                    </div>
                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {valori.map((v, i) => (
                            <div key={i} className="p-6 rounded-2xl border border-gray-200 hover:border-orange-300 hover:shadow-lg transition-all">
                                <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center mb-4">
                                    <v.icon size={24} className="text-orange-600" />
                                </div>
                                <h4 className="font-bold text-lg text-[#1a2744] mb-2">{v.title}</h4>
                                <p className="text-sm text-gray-600">{v.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* TEAM */}
            <section className="py-24 bg-[#f8fafc]">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-16">
                        <h2 className="text-sm font-bold text-orange-500 uppercase tracking-wider mb-3">Il team</h2>
                        <h3 className="text-4xl font-bold text-[#1a2744]">Le persone dietro i progetti</h3>
                    </div>
                    <div className="grid md:grid-cols-3 gap-8">
                        {team.map((m, i) => (
                            <div key={i} className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm hover:shadow-lg transition-all text-center">
                                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-2xl font-bold mx-auto mb-4">
                                    {m.iniziali}
                                </div>
                                <h4 className="text-xl font-bold text-[#1a2744] mb-1">{m.nome}</h4>
                                <div className="text-sm text-orange-600 font-semibold mb-4">{m.ruolo}</div>
                                <p className="text-gray-600 text-sm">{m.bio}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA */}
            <section className="py-24 bg-gradient-to-br from-[#1a2744] to-[#0f172a] text-white">
                <div className="max-w-4xl mx-auto px-4 text-center">
                    <h2 className="text-4xl font-bold mb-6">Lavora con noi</h2>
                    <p className="text-xl text-gray-300 mb-8">
                        Siamo sempre alla ricerca di talenti appassionati di finanza e strategia.
                    </p>
                    <Link href="/contatti" className="inline-flex items-center gap-2 bg-orange-500 text-white font-bold px-8 py-4 rounded-full hover:bg-orange-600 transition-all">
                        Contattaci <ArrowRight size={20} />
                    </Link>
                </div>
            </section>
        </div>
    );
}
