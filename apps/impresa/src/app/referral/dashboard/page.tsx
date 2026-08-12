"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
    Users, Euro, TrendingUp, MessageSquare, LogOut,
    CheckCircle2, Clock, AlertCircle, Building2, Mail
} from "lucide-react";

export default function ReferralDashboard() {
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("clienti");
    const [data, setData] = useState<any>(null);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const session = localStorage.getItem("pi_session");
        if (!session) {
            window.location.href = "/login";
        } else {
            const parsed = JSON.parse(session);
            if (parsed.role !== 'referral' && parsed.role !== 'admin') {
                window.location.href = "/dashboard";
            } else {
                setUser(parsed);
                fetch('/api/referral/dashboard')
                    .then(res => res.json())
                    .then(setData)
                    .finally(() => setLoading(false));
            }
        }
    }, []);

    const handleLogout = () => {
        localStorage.removeItem("pi_session");
        window.location.href = "/login";
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">Caricamento...</div>;
    if (!data) return null;

    const menuItems = [
        { id: "clienti", label: "I Miei Clienti", icon: Users, badge: data.referral.totalClients },
        { id: "provvigioni", label: "Provvigioni", icon: Euro, badge: data.commissions.pending > 0 ? data.commissions.breakdown.filter((c: any) => c.status !== 'erogato').length : null },
        { id: "storico", label: "Storico Deal", icon: TrendingUp },
        { id: "messaggi", label: "Messaggi", icon: MessageSquare },
    ];

    return (
        <div className="min-h-screen bg-[#f8fafc] flex">
            {/* Sidebar Referral */}
            <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
                <div className="p-6 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-purple-800 flex items-center justify-center text-white font-bold">
                            {user?.name?.charAt(0) || 'R'}
                        </div>
                        <div>
                            <div className="font-bold text-[#1a2744]">Area Referral</div>
                            <div className="text-xs text-gray-500 truncate">{user?.name}</div>
                        </div>
                    </div>
                </div>

                <nav className="flex-1 p-4 space-y-1">
                    {menuItems.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id)}
                            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all text-left ${activeTab === item.id ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/20' : 'text-gray-600 hover:bg-gray-100'
                                }`}
                        >
                            <div className="flex items-center gap-3">
                                <item.icon size={18} />
                                {item.label}
                            </div>
                            {item.badge && item.badge > 0 && (
                                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${activeTab === item.id ? 'bg-white/20 text-white' : 'bg-orange-500 text-white'
                                    }`}>
                                    {item.badge}
                                </span>
                            )}
                        </button>
                    ))}
                </nav>

                <div className="p-4 border-t border-gray-100">
                    <button onClick={handleLogout} className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-gray-600 hover:bg-red-50 hover:text-red-600 w-full">
                        <LogOut size={18} /> Esci
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 overflow-auto p-8">
                <header className="mb-8">
                    <h1 className="text-3xl font-bold text-[#1a2744]">
                        {activeTab === 'clienti' && 'I Miei Clienti'}
                        {activeTab === 'provvigioni' && 'Riepilogo Provvigioni'}
                        {activeTab === 'storico' && 'Storico Deal Chiusi'}
                        {activeTab === 'messaggi' && 'Messaggi con Admin'}
                    </h1>
                    <p className="text-gray-500 mt-1">
                        Provvigione applicata: <span className="font-bold text-purple-600">{data.referral.commissionRate}%</span> sul valore progetto
                    </p>
                </header>

                {/* TAB: CLIENTI */}
                {activeTab === "clienti" && (
                    <div className="space-y-6">
                        {/* Stats */}
                        <div className="grid md:grid-cols-3 gap-6">
                            <div className="bg-white rounded-2xl border border-gray-100 p-6">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                                        <Users size={20} className="text-purple-600" />
                                    </div>
                                    <h3 className="font-bold text-[#1a2744] text-sm">Clienti Totali</h3>
                                </div>
                                <div className="text-3xl font-bold text-[#1a2744]">{data.referral.totalClients}</div>
                            </div>
                            <div className="bg-white rounded-2xl border border-gray-100 p-6">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                                        <CheckCircle2 size={20} className="text-green-600" />
                                    </div>
                                    <h3 className="font-bold text-[#1a2744] text-sm">Deal Chiusi</h3>
                                </div>
                                <div className="text-3xl font-bold text-green-600">{data.referral.closedDeals}</div>
                            </div>
                            <div className="bg-white rounded-2xl border border-gray-100 p-6">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                                        <Clock size={20} className="text-orange-600" />
                                    </div>
                                    <h3 className="font-bold text-[#1a2744] text-sm">Deal in Corso</h3>
                                </div>
                                <div className="text-3xl font-bold text-orange-600">{data.referral.activeDeals}</div>
                            </div>
                        </div>

                        {/* Lista Clienti */}
                        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                            <table className="w-full">
                                <thead className="bg-gray-50 border-b border-gray-200">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Progetto</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Valore</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stato</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Provvigione</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Consulente</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {data.clients.map((client: any) => (
                                        <tr key={client.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                                                        <Building2 size={18} className="text-purple-600" />
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-[#1a2744]">{client.company}</div>
                                                        <div className="text-xs text-gray-500 flex items-center gap-1">
                                                            <Mail size={10} /> {client.contactEmail}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-sm font-medium text-[#1a2744]">{client.projectName}</div>
                                                <div className="text-xs text-gray-500">
                                                    <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${client.level === 'L3' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                                                        }`}>{client.level}</span>
                                                    <span className="ml-2">{client.projectCode}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm font-bold text-[#1a2744]">
                                                €{client.value.toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`text-xs px-2 py-1 rounded-full font-medium ${client.status === 'completato' ? 'bg-green-100 text-green-700' :
                                                        client.status === 'in_corso' ? 'bg-blue-100 text-blue-700' :
                                                            'bg-orange-100 text-orange-700'
                                                    }`}>
                                                    {client.status === 'completato' ? '✓ Completato' :
                                                        client.status === 'in_corso' ? 'In Corso' :
                                                            'In Attesa'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-sm font-bold text-purple-600">
                                                    €{client.commissionEarned.toLocaleString()}
                                                </div>
                                                <span className={`text-xs ${client.commissionStatus === 'erogato' ? 'text-green-600' :
                                                        client.commissionStatus === 'in_maturazione' ? 'text-orange-600' :
                                                            'text-gray-500'
                                                    }`}>
                                                    {client.commissionStatus === 'erogato' ? '✓ Erogato' :
                                                        client.commissionStatus === 'in_maturazione' ? 'In maturazione' :
                                                            'In attesa'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-600">
                                                {client.consultantAssigned}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* TAB: PROVIGIONI */}
                {activeTab === "provvigioni" && (
                    <div className="space-y-6">
                        {/* Stats */}
                        <div className="grid md:grid-cols-3 gap-6">
                            <div className="bg-gradient-to-br from-purple-600 to-purple-800 text-white rounded-2xl p-6">
                                <div className="text-sm opacity-80 mb-1">Totale Maturato</div>
                                <div className="text-3xl font-bold">€{data.commissions.totalEarned.toLocaleString()}</div>
                            </div>
                            <div className="bg-white rounded-2xl border border-gray-100 p-6">
                                <div className="text-sm text-gray-500 mb-1">Già Erogato</div>
                                <div className="text-3xl font-bold text-green-600">€{data.commissions.paid.toLocaleString()}</div>
                            </div>
                            <div className="bg-white rounded-2xl border border-gray-100 p-6">
                                <div className="text-sm text-gray-500 mb-1">In Attesa</div>
                                <div className="text-3xl font-bold text-orange-600">€{data.commissions.pending.toLocaleString()}</div>
                            </div>
                        </div>

                        {/* Dettaglio */}
                        <div className="bg-white rounded-2xl border border-gray-100 p-6">
                            <h3 className="font-bold text-lg mb-4">Dettaglio Provvigioni</h3>
                            <div className="space-y-3">
                                {data.commissions.breakdown.map((comm: any) => (
                                    <div key={comm.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                                        <div className="flex-1">
                                            <div className="font-bold text-[#1a2744]">{comm.client}</div>
                                            <div className="text-sm text-gray-500">
                                                {comm.project} • Valore: €{comm.projectValue.toLocaleString()} • {comm.commissionRate}%
                                            </div>
                                            {comm.note && (
                                                <div className="text-xs text-gray-400 mt-1 italic">{comm.note}</div>
                                            )}
                                        </div>
                                        <div className="text-right">
                                            <div className="text-xl font-bold text-purple-600">€{comm.commissionAmount.toLocaleString()}</div>
                                            <span className={`text-xs px-2 py-0.5 rounded-full ${comm.status === 'erogato' ? 'bg-green-100 text-green-700' :
                                                    comm.status === 'in_maturazione' ? 'bg-orange-100 text-orange-700' :
                                                        'bg-gray-100 text-gray-700'
                                                }`}>
                                                {comm.status === 'erogato' ? `✓ Erogato il ${new Date(comm.paidDate).toLocaleDateString('it-IT')}` :
                                                    comm.status === 'in_maturazione' ? 'In maturazione' : 'In attesa'}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB: STORICO DEAL */}
                {activeTab === "storico" && (
                    <div className="bg-white rounded-2xl border border-gray-100 p-6">
                        <h3 className="font-bold text-lg mb-4">Deal Chiusi con Successo</h3>
                        <div className="space-y-4">
                            {data.clients.filter((c: any) => c.status === 'completato').map((client: any) => (
                                <div key={client.id} className="flex items-center justify-between p-5 bg-green-50 border border-green-200 rounded-xl">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center text-white">
                                            <CheckCircle2 size={24} />
                                        </div>
                                        <div>
                                            <div className="font-bold text-[#1a2744]">{client.company}</div>
                                            <div className="text-sm text-gray-600">{client.projectName}</div>
                                            <div className="text-xs text-gray-500">Referenziato il: {new Date(client.dateReferred).toLocaleDateString('it-IT')}</div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-2xl font-bold text-green-600">€{client.value.toLocaleString()}</div>
                                        <div className="text-sm text-purple-600 font-medium">Provvigione: €{client.commissionEarned.toLocaleString()}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* TAB: MESSAGGI */}
                {activeTab === "messaggi" && (
                    <div className="bg-white rounded-2xl border border-gray-100 p-6">
                        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 mb-6">
                            <div className="flex items-start gap-3">
                                <AlertCircle size={20} className="text-purple-600 flex-shrink-0 mt-0.5" />
                                <div className="text-sm text-purple-900">
                                    <strong>Nota:</strong> I messaggi con l'Admin sono sempre in copia. Non hai accesso diretto ai clienti per mantenere la riservatezza della relazione.
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4 mb-6">
                            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold">A</div>
                                    <div>
                                        <div className="font-semibold text-[#1a2744]">Admin (Denis)</div>
                                        <div className="text-xs text-gray-500">13/07/2026 - 10:30</div>
                                    </div>
                                </div>
                                <p className="text-gray-700 text-sm pl-10">
                                    Ciao Marco, il cliente Green Energy ha firmato il contratto. La tua provvigione di €2.500 verrà erogata al primo SAL.
                                </p>
                            </div>
                            <div className="p-4 bg-white border border-gray-200 rounded-xl">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center text-white text-xs font-bold">M</div>
                                    <div>
                                        <div className="font-semibold text-[#1a2744]">Tu</div>
                                        <div className="text-xs text-gray-500">12/07/2026 - 15:45</div>
                                    </div>
                                </div>
                                <p className="text-gray-700 text-sm pl-10">
                                    Perfetto, grazie per l'aggiornamento. Ho un nuovo contatto interessante nel settore energia, vi giro i dettagli domani.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <input
                                type="text"
                                placeholder="Scrivi un messaggio all'Admin..."
                                className="flex-1 px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                            />
                            <button className="flex items-center gap-2 px-6 py-3 rounded-xl bg-purple-600 text-white font-medium hover:bg-purple-700">
                                Invia
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
