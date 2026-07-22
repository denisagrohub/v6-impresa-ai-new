import type { Route } from 'next';
import Link from "next/link";
import { ArrowRight, TrendingUp, Building2, Briefcase, Landmark } from "lucide-react";

export default function CasiStudioPage() {
    const casi = [
        {
            settore: "Tecnologia",
            cliente: "Startup SaaS B2B",
            livello: "L1",
            icon: Building2,
            sfida: "La startup aveva un prodotto innovativo ma nessun business plan strutturato. Dovevano presentare il progetto a 3 business angel entro 2 settimane.",
            soluzione: "Abbiamo costruito il BP in 48 ore, con focus su unit economics, CAC/LTV e proiezioni 3 anni. Incluso pitch deck da 12 slide.",
            risultato: "€150.000 raccolti da 3 business angel. Valutazione pre-money: €1.2M.",
            colore: "bg-blue-50 text-blue-600",
        },
        {
            settore: "Manifatturiero",
            cliente: "PMI metalmeccanica",
            livello: "L2",
            icon: Briefcase,
            sfida: "Azienda con €8M di fatturato, necessaria espansione internazionale. Serviva piano industriale per richiedere finanziamento bancario da €3M.",
            soluzione: "Piano industriale 5 anni con analisi di mercato Europa, modello finanziario DCF, piano di investimento capex. 10 giorni di lavoro.",
            risultato: "Finanziamento di €3.2M approvato da Intesa Sanpaolo. Espansione in 3 paesi UE avviata.",
            colore: "bg-orange-50 text-orange-600",
        },
        {
            settore: "Agroalimentare",
            cliente: "Gruppo alimentare",
            livello: "L3",
            icon: Landmark,
            sfida: "Passaggio generazionale + acquisizione competitor. Operazione complessa da €15M con coinvolgimento di 2 banche e un fondo PE.",
            soluzione: "Information Memorandum, financial model LBO, supporto roadshow con 8 investitori. 45 giorni di advisory intensivo.",
            risultato: "Operazione chiusa in 6 mesi. Valore transazione: €18M. Success fee: €540k.",
            colore: "bg-slate-100 text-slate-700",
        },
    ];

    return (
        <div className="min-h-screen bg-white">
            {/* HERO */}
            <section className="relative py-24 bg-gradient-to-br from-[#1a2744] to-[#0f172a] text-white overflow-hidden">
                <div className="absolute inset-0 opacity-20">
                    <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-orange-500 rounded-full mix-blend-multiply filter blur-3xl" />
                </div>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                    <div className="max-w-3xl">
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 mb-6">
                            <span className="text-sm font-semibold">Risultati concreti</span>
                        </div>
                        <h1 className="text-5xl sm:text-6xl font-bold mb-6 leading-tight">
                            Casi <span className="text-orange-400">studio</span>
                        </h1>
                        <p className="text-xl text-gray-300 leading-relaxed">
                            Storie reali di imprenditori che hanno trasformato la loro idea in struttura con il nostro supporto.
                        </p>
                    </div>
                </div>
            </section>

            {/* CASI */}
            <section className="py-24 bg-[#f8fafc]">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="space-y-12">
                        {casi.map((c, i) => (
                            <div key={i} className="bg-white rounded-3xl p-8 lg:p-12 border border-gray-100 shadow-sm">
                                <div className="grid lg:grid-cols-12 gap-8">
                                    <div className="lg:col-span-4">
                                        <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold mb-4 ${c.colore}`}>
                                            <c.icon size={14} />
                                            {c.settore}
                                        </div>
                                        <h3 className="text-2xl font-bold text-[#1a2744] mb-2">{c.cliente}</h3>
                                        <div className="text-sm text-orange-600 font-semibold mb-6">Pacchetto {c.livello}</div>
                                        <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-4 border border-orange-200">
                                            <div className="text-xs font-bold text-orange-700 uppercase mb-1">Risultato</div>
                                            <div className="text-sm text-gray-800 font-medium">{c.risultato}</div>
                                        </div>
                                    </div>
                                    <div className="lg:col-span-8 space-y-6">
                                        <div>
                                            <div className="text-xs font-bold text-gray-500 uppercase mb-2">La sfida</div>
                                            <p className="text-gray-700 leading-relaxed">{c.sfida}</p>
                                        </div>
                                        <div>
                                            <div className="text-xs font-bold text-gray-500 uppercase mb-2">La soluzione</div>
                                            <p className="text-gray-700 leading-relaxed">{c.soluzione}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA */}
            <section className="py-24 bg-gradient-to-br from-[#1a2744] to-[#0f172a] text-white">
                <div className="max-w-4xl mx-auto px-4 text-center">
                    <h2 className="text-4xl font-bold mb-6">Il tuo caso studio potrebbe essere il prossimo</h2>
                    <p className="text-xl text-gray-300 mb-8">
                        Inizia ora il tuo progetto e entra a far parte dei 200+ imprenditori che hanno scelto Progetto Impresa.
                    </p>
                    <Link href={"/form" as Route} className="inline-flex items-center gap-2 bg-orange-500 text-white font-bold px-8 py-4 rounded-full hover:bg-orange-600 transition-all">
                        Inizia il tuo progetto <ArrowRight size={20} />
                    </Link>
                </div>
            </section>
        </div>
    );
}
