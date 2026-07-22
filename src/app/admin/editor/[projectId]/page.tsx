"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { Loader2, ArrowLeft, Save, Download, Send, FileText, User, Calendar, TrendingUp } from "lucide-react";

export default function EditorPage() {
    const router = useRouter();
    const params = useParams();
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("contenuto");

    useEffect(() => {
        const session = localStorage.getItem("odoo_session");
        if (!session) router.push("/admin/login");
        else setTimeout(() => setLoading(false), 400);
    }, [router]);

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center"><Loader2 size={40} className="animate-spin text-orange-500" /></div>;
    }

    const progetto = {
        id: params.projectId,
        nome: "Marco Bianchi",
        brand: "Progetto Impresa",
        livello: "L2",
        stato: "In lavorazione",
        assegnato: "Christian",
        scadenza: "22 Lug 2026",
        avanzamento: 65,
    };

    const tabs = [
        { id: "contenuto", label: "Contenuto", icon: FileText },
        { id: "financial", label: "Financial Model", icon: TrendingUp },
        { id: "team", label: "Team & Task", icon: User },
        { id: "timeline", label: "Timeline", icon: Calendar },
    ];

    return (
        <div className="min-h-screen bg-[#f8fafc]">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <div className="flex items-center gap-4">
                            <Link href="/admin/validazione" className="p-2 rounded-lg hover:bg-gray-100">
                                <ArrowLeft size={20} className="text-gray-600" />
                            </Link>
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="font-mono text-sm text-gray-500">#{progetto.id}</span>
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-medium">{progetto.livello}</span>
                                </div>
                                <h1 className="text-xl font-bold text-[#1a2744]">{progetto.nome}</h1>
                                <div className="text-sm text-gray-500">{progetto.brand} • Assegnato a {progetto.assegnato}</div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-sm font-medium">
                                <Download size={16} /> Export
                            </button>
                            <button className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-sm font-medium">
                                <Send size={16} /> Invia revisione
                            </button>
                            <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1a2744] text-white hover:bg-[#0f3460] text-sm font-medium">
                                <Save size={16} /> Salva
                            </button>
                        </div>
                    </div>

                    {/* Progress */}
                    <div className="mt-4">
                        <div className="flex items-center justify-between text-sm mb-2">
                            <span className="text-gray-600">Avanzamento progetto</span>
                            <span className="font-bold text-[#1a2744]">{progetto.avanzamento}%</span>
                        </div>
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-orange-500 to-orange-600 rounded-full transition-all" style={{ width: `${progetto.avanzamento}%` }} />
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex items-center gap-2 mt-6 overflow-x-auto">
                        {tabs.map(t => (
                            <button key={t.id} onClick={() => setActiveTab(t.id)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${activeTab === t.id ? 'bg-[#1a2744] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                                <t.icon size={16} /> {t.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {activeTab === "contenuto" && (
                    <div className="bg-white rounded-2xl border border-gray-100 p-8">
                        <h2 className="text-2xl font-bold text-[#1a2744] mb-6">Editor Contenuto</h2>
                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Titolo Executive Summary</label>
                                <input type="text" defaultValue="Business Plan - Marco Bianchi" className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Contenuto</label>
                                <textarea rows={15} defaultValue="Inserisci qui il contenuto del business plan..." className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 resize-none font-mono text-sm" />
                            </div>
                            <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                                <span className="text-sm text-gray-500">Ultimo salvataggio: 2 minuti fa</span>
                                <button className="px-6 py-2 rounded-lg bg-orange-500 text-white hover:bg-orange-600 font-medium">Salva modifiche</button>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === "financial" && (
                    <div className="bg-white rounded-2xl border border-gray-100 p-8">
                        <h2 className="text-2xl font-bold text-[#1a2744] mb-6">Financial Model</h2>
                        <div className="grid md:grid-cols-3 gap-6 mb-8">
                            {[
                                { label: "Fatturato Anno 1", value: "€450.000", change: "+12%" },
                                { label: "EBITDA Margin", value: "18%", change: "+3%" },
                                { label: "Break-even", value: "Mese 14", change: "On track" },
                            ].map((m, i) => (
                                <div key={i} className="bg-gray-50 rounded-xl p-6">
                                    <div className="text-sm text-gray-500 mb-2">{m.label}</div>
                                    <div className="text-3xl font-bold text-[#1a2744]">{m.value}</div>
                                    <div className="text-sm text-green-600 mt-1">{m.change}</div>
                                </div>
                            ))}
                        </div>
                        <div className="bg-orange-50 border border-orange-200 rounded-xl p-6">
                            <div className="text-sm font-bold text-orange-700 uppercase mb-2">Nota</div>
                            <p className="text-gray-800 text-sm">Il financial model completo è disponibile in formato Excel. Clicca "Export" per scaricarlo.</p>
                        </div>
                    </div>
                )}

                {activeTab === "team" && (
                    <div className="bg-white rounded-2xl border border-gray-100 p-8">
                        <h2 className="text-2xl font-bold text-[#1a2744] mb-6">Team & Task</h2>
                        <div className="space-y-4">
                            {[
                                { task: "Audit iniziale", assignee: "Tu", status: "completato" },
                                { task: "Analisi di mercato", assignee: "Christian", status: "completato" },
                                { task: "Financial modeling", assignee: "Christian", status: "in corso" },
                                { task: "Stesura documento", assignee: "Davide", status: "in attesa" },
                                { task: "Revisione finale", assignee: "Tu", status: "in attesa" },
                            ].map((t, i) => (
                                <div key={i} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-2 h-2 rounded-full ${t.status === 'completato' ? 'bg-green-500' : t.status === 'in corso' ? 'bg-orange-500' : 'bg-gray-300'}`} />
                                        <span className="font-medium text-[#1a2744]">{t.task}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-sm text-gray-500">{t.assignee}</span>
                                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${t.status === 'completato' ? 'bg-green-100 text-green-700' : t.status === 'in corso' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-700'}`}>
                                            {t.status}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === "timeline" && (
                    <div className="bg-white rounded-2xl border border-gray-100 p-8">
                        <h2 className="text-2xl font-bold text-[#1a2744] mb-6">Timeline Progetto</h2>
                        <div className="space-y-6">
                            {[
                                { fase: "Fase 1: Audit", data: "05 Lug 2026", stato: "completato" },
                                { fase: "Fase 2: Analisi mercato", data: "08 Lug 2026", stato: "completato" },
                                { fase: "Fase 3: Strategia", data: "12 Lug 2026", stato: "in corso" },
                                { fase: "Fase 4: Financial modeling", data: "18 Lug 2026", stato: "in attesa" },
                                { fase: "Fase 5: Stesura", data: "22 Lug 2026", stato: "in attesa" },
                                { fase: "Fase 6: Consegna", data: "25 Lug 2026", stato: "in attesa" },
                            ].map((f, i) => (
                                <div key={i} className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${f.stato === 'completato' ? 'bg-green-500 text-white' : f.stato === 'in corso' ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                                        {f.stato === 'completato' ? '✓' : i + 1}
                                    </div>
                                    <div className="flex-1">
                                        <div className="font-semibold text-[#1a2744]">{f.fase}</div>
                                        <div className="text-sm text-gray-500">{f.data}</div>
                                    </div>
                                    <span className={`text-xs px-3 py-1 rounded-full font-medium ${f.stato === 'completato' ? 'bg-green-100 text-green-700' : f.stato === 'in corso' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-700'}`}>
                                        {f.stato}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
