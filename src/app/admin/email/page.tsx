"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, ArrowLeft, Plus, Send, Edit3, Trash2, Eye, Mail, Users, TrendingUp } from "lucide-react";

export default function EmailPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const session = localStorage.getItem("odoo_session");
        if (!session) router.push("/admin/login");
        else setTimeout(() => setLoading(false), 400);
    }, [router]);

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center"><Loader2 size={40} className="animate-spin text-orange-500" /></div>;
    }

    const template = [
        { id: 1, nome: "Welcome - Nuovo lead L1", categoria: "Onboarding", inviati: 142, apertura: "68%", click: "24%", ultimo: "2 ore fa" },
        { id: 2, nome: "Follow-up post form", categoria: "Nurturing", inviati: 89, apertura: "54%", click: "18%", ultimo: "5 ore fa" },
        { id: 3, nome: "Promozione Beta Program", categoria: "Marketing", inviati: 234, apertura: "42%", click: "12%", ultimo: "1 giorno fa" },
        { id: 4, nome: "Reminder scadenza bando", categoria: "Urgente", inviati: 56, apertura: "78%", click: "34%", ultimo: "3 ore fa" },
        { id: 5, nome: "Richiesta testimonial", categoria: "Post-vendita", inviati: 23, apertura: "61%", click: "28%", ultimo: "2 giorni fa" },
    ];

    const campagne = [
        { nome: "Lancio Beta Program L1", status: "Attiva", destinatari: 1240, inviati: 892, aperture: 542, conversioni: 47 },
        { nome: "Newsletter mensile Luglio", status: "Bozza", destinatari: 2100, inviati: 0, aperture: 0, conversioni: 0 },
        { nome: "Re-engagement lead freddi", status: "Programmata", destinatari: 456, inviati: 0, aperture: 0, conversioni: 0 },
    ];

    return (
        <div className="min-h-screen bg-[#f8fafc]">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <Link href="/admin/dashboard" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 mb-2">
                            <ArrowLeft size={16} /> Torna alla dashboard
                        </Link>
                        <h1 className="text-3xl font-bold text-[#1a2744]">Gestione Email</h1>
                        <p className="text-gray-500">Template, campagne e automazioni</p>
                    </div>
                    <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1a2744] text-white hover:bg-[#0f3460] font-medium">
                        <Plus size={18} /> Nuovo template
                    </button>
                </div>

                {/* Stats */}
                <div className="grid md:grid-cols-4 gap-4 mb-8">
                    {[
                        { icon: Mail, label: "Email inviate (30gg)", value: "3.421", color: "bg-blue-100 text-blue-600" },
                        { icon: Eye, label: "Tasso apertura medio", value: "58%", color: "bg-green-100 text-green-600" },
                        { icon: TrendingUp, label: "Click-through rate", value: "22%", color: "bg-orange-100 text-orange-600" },
                        { icon: Users, label: "Iscritti totali", value: "2.847", color: "bg-purple-100 text-purple-600" },
                    ].map((s, i) => (
                        <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5">
                            <div className={`w-10 h-10 rounded-lg ${s.color} flex items-center justify-center mb-3`}>
                                <s.icon size={20} />
                            </div>
                            <div className="text-2xl font-bold text-[#1a2744]">{s.value}</div>
                            <div className="text-sm text-gray-500">{s.label}</div>
                        </div>
                    ))}
                </div>

                {/* Template */}
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden mb-8">
                    <div className="p-6 border-b border-gray-100">
                        <h2 className="text-xl font-bold text-[#1a2744]">Template Email</h2>
                        <p className="text-sm text-gray-500">I tuoi template salvati e le loro performance</p>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="text-left text-xs font-semibold text-gray-500 uppercase px-6 py-3">Nome</th>
                                    <th className="text-left text-xs font-semibold text-gray-500 uppercase px-6 py-3">Categoria</th>
                                    <th className="text-left text-xs font-semibold text-gray-500 uppercase px-6 py-3">Inviati</th>
                                    <th className="text-left text-xs font-semibold text-gray-500 uppercase px-6 py-3">Apertura</th>
                                    <th className="text-left text-xs font-semibold text-gray-500 uppercase px-6 py-3">Click</th>
                                    <th className="text-left text-xs font-semibold text-gray-500 uppercase px-6 py-3">Ultimo invio</th>
                                    <th className="text-right text-xs font-semibold text-gray-500 uppercase px-6 py-3">Azioni</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {template.map((t) => (
                                    <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 font-medium text-[#1a2744]">{t.nome}</td>
                                        <td className="px-6 py-4"><span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700">{t.categoria}</span></td>
                                        <td className="px-6 py-4 text-sm text-gray-600">{t.inviati}</td>
                                        <td className="px-6 py-4 text-sm font-medium text-green-600">{t.apertura}</td>
                                        <td className="px-6 py-4 text-sm font-medium text-orange-600">{t.click}</td>
                                        <td className="px-6 py-4 text-sm text-gray-500">{t.ultimo}</td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button className="p-2 rounded-lg hover:bg-gray-100"><Eye size={16} className="text-gray-600" /></button>
                                                <button className="p-2 rounded-lg hover:bg-gray-100"><Edit3 size={16} className="text-gray-600" /></button>
                                                <button className="p-2 rounded-lg hover:bg-red-50"><Trash2 size={16} className="text-red-600" /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Campagne */}
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                    <div className="p-6 border-b border-gray-100">
                        <h2 className="text-xl font-bold text-[#1a2744]">Campagne Attive</h2>
                        <p className="text-sm text-gray-500">Le tue campagne email in corso</p>
                    </div>
                    <div className="divide-y divide-gray-100">
                        {campagne.map((c, i) => (
                            <div key={i} className="p-6 hover:bg-gray-50 transition-colors">
                                <div className="flex items-center justify-between flex-wrap gap-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="font-bold text-[#1a2744]">{c.nome}</h3>
                                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.status === 'Attiva' ? 'bg-green-100 text-green-700' : c.status === 'Bozza' ? 'bg-gray-100 text-gray-700' : 'bg-blue-100 text-blue-700'}`}>
                                                {c.status}
                                            </span>
                                        </div>
                                        <div className="text-sm text-gray-500">{c.destinatari} destinatari • {c.inviati} inviati</div>
                                    </div>
                                    <div className="flex items-center gap-6 text-sm">
                                        <div className="text-center">
                                            <div className="font-bold text-[#1a2744]">{c.aperture}</div>
                                            <div className="text-xs text-gray-500">Aperture</div>
                                        </div>
                                        <div className="text-center">
                                            <div className="font-bold text-orange-600">{c.conversioni}</div>
                                            <div className="text-xs text-gray-500">Conversioni</div>
                                        </div>
                                        <button className="px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-sm font-medium">Dettagli</button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
