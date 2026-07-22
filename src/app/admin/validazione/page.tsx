"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Eye, CheckCircle2, XCircle, Clock, Filter, Search, ArrowLeft } from "lucide-react";

export default function ValidazionePage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState("tutti");

    useEffect(() => {
        const session = localStorage.getItem("odoo_session");
        if (!session) router.push("/admin/login");
        else setTimeout(() => setLoading(false), 400);
    }, [router]);

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center"><Loader2 size={40} className="animate-spin text-orange-500" /></div>;
    }

    const progetti = [
        { id: "PI-2026-0024", nome: "Marco Bianchi", brand: "Progetto Impresa", livello: "L2", stato: "In revisione", data: "12 Lug 2026", urgenza: "alta" },
        { id: "PI-2026-0023", nome: "Elena Verdi", brand: "Ricerca Bandi", livello: "—", stato: "In attesa", data: "11 Lug 2026", urgenza: "media" },
        { id: "PI-2026-0022", nome: "Luca Rossi", brand: "Zero Sprechi", livello: "—", stato: "In revisione", data: "10 Lug 2026", urgenza: "bassa" },
        { id: "PI-2026-0021", nome: "Anna Neri", brand: "Progetto Impresa", livello: "L1", stato: "In attesa", data: "09 Lug 2026", urgenza: "media" },
        { id: "PI-2026-0020", nome: "Paolo Gialli", brand: "Manuale Rapido", livello: "—", stato: "In revisione", data: "08 Lug 2026", urgenza: "alta" },
    ];

    const filtered = filter === "tutti" ? progetti : progetti.filter(p => p.stato.toLowerCase().includes(filter));

    return (
        <div className="min-h-screen bg-[#f8fafc]">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <Link href="/admin/dashboard" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 mb-2">
                            <ArrowLeft size={16} /> Torna alla dashboard
                        </Link>
                        <h1 className="text-3xl font-bold text-[#1a2744]">Validazione Progetti</h1>
                        <p className="text-gray-500">Coda di revisione e approvazione</p>
                    </div>
                    <div className="text-right">
                        <div className="text-3xl font-bold text-orange-500">{progetti.filter(p => p.stato === "In revisione").length}</div>
                        <div className="text-sm text-gray-500">in revisione</div>
                    </div>
                </div>

                {/* Filtri */}
                <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-6 flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                        <Search size={18} className="text-gray-400" />
                        <input type="text" placeholder="Cerca progetto..." className="flex-1 px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 text-sm" />
                    </div>
                    <div className="flex items-center gap-2">
                        <Filter size={18} className="text-gray-400" />
                        {["tutti", "in revisione", "in attesa"].map(f => (
                            <button key={f} onClick={() => setFilter(f)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === f ? 'bg-[#1a2744] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                                {f.charAt(0).toUpperCase() + f.slice(1)}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Lista progetti */}
                <div className="space-y-4">
                    {filtered.map((p) => (
                        <div key={p.id} className="bg-white rounded-2xl border border-gray-100 p-6 hover:shadow-md transition-all">
                            <div className="flex items-center justify-between flex-wrap gap-4">
                                <div className="flex items-center gap-4 flex-1 min-w-0">
                                    <div className={`w-2 h-12 rounded-full ${p.urgenza === 'alta' ? 'bg-red-500' : p.urgenza === 'media' ? 'bg-orange-500' : 'bg-green-500'}`} />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-mono text-sm text-gray-500">{p.id}</span>
                                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.stato === 'In revisione' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>
                                                {p.stato}
                                            </span>
                                            {p.urgenza === 'alta' && <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">URGENTE</span>}
                                        </div>
                                        <div className="font-bold text-[#1a2744] truncate">{p.nome}</div>
                                        <div className="text-sm text-gray-500">{p.brand} • {p.livello} • {p.data}</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Link href={`/admin/editor/${p.id}`} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-sm font-medium">
                                        <Eye size={16} /> Anteprima
                                    </Link>
                                    <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-500 text-white hover:bg-green-600 text-sm font-medium">
                                        <CheckCircle2 size={16} /> Approva
                                    </button>
                                    <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 text-sm font-medium">
                                        <XCircle size={16} /> Rifiuta
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
