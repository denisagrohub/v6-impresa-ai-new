"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
    LayoutDashboard, FileText, CreditCard, FolderKanban,
    MessageSquare, LogOut, CheckCircle2, Clock, Lock,
    Download, TrendingUp, Loader2, AlertCircle, Send
} from "lucide-react";
// ✅ La funzione viene importata da qui, non definita in questo file!
import { getDashboardData, type DashboardData } from '@/lib/dashboard-adapter';

export default function ClientDashboard() {
    const [client, setClient] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("panoramica");
    const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);

    // 🔒 Protezione login
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const session = localStorage.getItem("pi_session");
        if (!session) {
            window.location.href = "/login";
        } else {
            try {
                const parsed = JSON.parse(session);
                if (parsed.role !== 'client') {
                    window.location.href = "/admin/dashboard";
                } else {
                    setClient(parsed);
                    setLoading(false);
                }
            } catch (e) {
                localStorage.removeItem("pi_session");
                window.location.href = "/login";
            }
        }
    }, []);

    // Carica dati dashboard
    useEffect(() => {
        if (client) {
            getDashboardData(client.clientId || 'client_001').then(setDashboardData);
        }
    }, [client]);

    // Ricarica i dati quando l'utente torna sulla pagina (es. dopo un pagamento)
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && client) {
                getDashboardData(client.clientId || 'client_001').then(setDashboardData);
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [client]);

    const handleLogout = () => {
        localStorage.removeItem("pi_session");
        // ✅ Cancella anche il cookie
        document.cookie = "pi_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
        window.location.href = "/login";
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
                <Loader2 size={40} className="animate-spin text-orange-500" />
            </div>
        );
    }

    if (!client || !dashboardData) return null;

    const { progetto, pagamenti, documenti, messaggi, stats } = dashboardData;
    const messaggiNonLetti = messaggi.filter((m: any) => !m.letto).length;

    const menuItems = [
        { id: "panoramica", label: "Panoramica", icon: LayoutDashboard, badge: null },
        { id: "pagamenti", label: "Pagamenti", icon: CreditCard, badge: pagamenti.filter((p: any) => p.stato === 'in_attesa' || p.stato === 'scaduto').length },
        { id: "documenti", label: "Documenti", icon: FileText, badge: null },
        { id: "messaggi", label: "Messaggi", icon: MessageSquare, badge: messaggiNonLetti },
    ];

    return (
        <div className="min-h-screen bg-[#f8fafc] flex">
            {/* Sidebar */}
            <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
                <div className="p-6 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#1a2744] to-[#0f3460] flex items-center justify-center text-white font-bold">
                            PI
                        </div>
                        <div>
                            <div className="font-bold text-[#1a2744]">Area Cliente</div>
                            <div className="text-xs text-gray-500 truncate">{client.name}</div>
                        </div>
                    </div>
                </div>

                <nav className="flex-1 p-4 space-y-1">
                    {menuItems.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id)}
                            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all text-left ${activeTab === item.id
                                    ? 'bg-[#1a2744] text-white shadow-lg shadow-blue-900/20'
                                    : 'text-gray-600 hover:bg-gray-100'
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

                <div className="p-4 border-t border-gray-100 space-y-1">
                    <Link href="/" className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100">
                        <LayoutDashboard size={18} /> Torna al sito
                    </Link>
                    <button onClick={handleLogout} className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-gray-600 hover:bg-red-50 hover:text-red-600 w-full">
                        <LogOut size={18} /> Esci
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 overflow-auto">
                <header className="bg-white border-b border-gray-200 px-8 py-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <span className="font-mono text-sm text-gray-500">#{progetto.codice}</span>
                                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-bold">
                                    {progetto.livello}
                                </span>
                            </div>
                            <h1 className="text-2xl font-bold text-[#1a2744]">{progetto.nome}</h1>
                            <p className="text-sm text-gray-500 mt-1">Consulente: <span className="font-medium text-[#1a2744]">{progetto.consulente}</span></p>
                        </div>
                        <div className="text-right">
                            <div className="text-sm text-gray-500 mb-1">Avanzamento</div>
                            <div className="flex items-center gap-3">
                                <div className="w-48 h-2 bg-gray-200 rounded-full overflow-hidden">
                                    <div className="h-full bg-gradient-to-r from-orange-500 to-orange-600" style={{ width: `${progetto.avanzamento}%` }} />
                                </div>
                                <span className="text-lg font-bold text-[#1a2744]">{progetto.avanzamento}%</span>
                            </div>
                        </div>
                    </div>
                </header>

                <div className="p-8">
                    {activeTab === "panoramica" && (
                        <div className="space-y-6">
                            <div className="grid md:grid-cols-4 gap-6">
                                <div className="bg-white rounded-2xl border border-gray-100 p-6">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center"><FolderKanban size={20} className="text-blue-600" /></div>
                                        <h3 className="font-bold text-[#1a2744] text-sm">Fase Attuale</h3>
                                    </div>
                                    <div className="text-3xl font-bold text-[#1a2744]">{progetto.faseAttuale}/{progetto.totaleFasi}</div>
                                    <p className="text-sm text-gray-500 mt-1">{progetto.fasi[progetto.faseAttuale - 1]?.titolo}</p>
                                </div>
                                <div className="bg-white rounded-2xl border border-gray-100 p-6">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center"><TrendingUp size={20} className="text-green-600" /></div>
                                        <h3 className="font-bold text-[#1a2744] text-sm">Totale Progetto</h3>
                                    </div>
                                    <div className="text-3xl font-bold text-[#1a2744]">€{stats.totaleProgetto.toLocaleString()}</div>
                                    <p className="text-sm text-gray-500 mt-1">Valore complessivo</p>
                                </div>
                                <div className="bg-white rounded-2xl border border-gray-100 p-6">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center"><CreditCard size={20} className="text-orange-600" /></div>
                                        <h3 className="font-bold text-[#1a2744] text-sm">Da Pagare</h3>
                                    </div>
                                    <div className="text-3xl font-bold text-orange-600">€{stats.daPagare.toLocaleString()}</div>
                                    {stats.prossimaScadenza && <p className="text-sm text-gray-500 mt-1">Scadenza: {stats.prossimaScadenza}</p>}
                                </div>
                                <div className="bg-white rounded-2xl border border-gray-100 p-6">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center"><CheckCircle2 size={20} className="text-purple-600" /></div>
                                        <h3 className="font-bold text-[#1a2744] text-sm">Pagato</h3>
                                    </div>
                                    <div className="text-3xl font-bold text-green-600">€{stats.pagato.toLocaleString()}</div>
                                    <p className="text-sm text-gray-500 mt-1">{Math.round((stats.pagato / stats.totaleProgetto) * 100)}% del totale</p>
                                </div>
                            </div>

                            <div className="bg-white rounded-2xl border border-gray-100 p-6">
                                <h2 className="text-xl font-bold text-[#1a2744] mb-6">Avanzamento Metodo V6</h2>
                                <div className="space-y-4">
                                    {progetto.fasi.map((fase: any) => (
                                        <div key={fase.n} className="flex items-center gap-4">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${fase.stato === 'completato' ? 'bg-green-500 text-white' : fase.stato === 'in_corso' ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                                                {fase.stato === 'completato' ? <CheckCircle2 size={20} /> : fase.n}
                                            </div>
                                            <div className="flex-1"><div className="font-semibold text-[#1a2744]">{fase.titolo}</div></div>
                                            <span className={`text-xs px-3 py-1 rounded-full font-medium ${fase.stato === 'completato' ? 'bg-green-100 text-green-700' : fase.stato === 'in_corso' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'}`}>
                                                {fase.stato === 'completato' ? 'Completato' : fase.stato === 'in_corso' ? 'In lavorazione' : 'In attesa'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === "pagamenti" && (
                        <div className="space-y-6">
                            <div className="bg-gradient-to-br from-[#1a2744] to-[#0f3460] text-white rounded-2xl p-6">
                                <h2 className="text-xl font-bold mb-4">Riepilogo Pagamenti</h2>
                                <div className="grid md:grid-cols-3 gap-6">
                                    <div><div className="text-sm text-gray-300 mb-1">Totale Progetto</div><div className="text-3xl font-bold">€{stats.totaleProgetto.toLocaleString()}</div></div>
                                    <div><div className="text-sm text-gray-300 mb-1">Già Pagato</div><div className="text-3xl font-bold text-green-400">€{stats.pagato.toLocaleString()}</div></div>
                                    <div><div className="text-sm text-gray-300 mb-1">Da Pagare</div><div className="text-3xl font-bold text-orange-400">€{stats.daPagare.toLocaleString()}</div></div>
                                </div>
                            </div>
                            <div className="bg-white rounded-2xl border border-gray-100 p-6">
                                <h2 className="text-xl font-bold text-[#1a2744] mb-6">Stato Avanzamento Lavori (SAL)</h2>
                                <div className="space-y-4">
                                    {pagamenti.map((item: any) => (
                                        <div key={item.id} className={`flex items-center justify-between p-5 rounded-xl border ${item.stato === 'pagato' ? 'bg-green-50 border-green-200' : item.stato === 'in_attesa' ? 'bg-orange-50 border-orange-200' : item.stato === 'scaduto' ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200 opacity-75'}`}>
                                            <div className="flex items-center gap-4">
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${item.stato === 'pagato' ? 'bg-green-500 text-white' : item.stato === 'in_attesa' ? 'bg-orange-500 text-white' : item.stato === 'scaduto' ? 'bg-red-500 text-white' : 'bg-gray-300 text-gray-600'}`}>
                                                    {item.stato === 'pagato' ? <CheckCircle2 size={20} /> : item.stato === 'in_attesa' ? <Clock size={20} /> : item.stato === 'scaduto' ? <AlertCircle size={20} /> : <Lock size={20} />}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-[#1a2744]">{item.desc}</div>
                                                    <div className="text-sm text-gray-500">
                                                        {item.stato === 'in_attesa' && item.scadenza && `Scadenza: ${item.scadenza}`}
                                                        {item.stato === 'pagato' && `Pagato il: ${item.data}`}
                                                        {item.stato === 'bloccato' && 'Sblocca con il SAL precedente'}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-xl font-bold text-[#1a2744]">€{item.importo.toLocaleString()}</div>
                                                {item.stato === 'in_attesa' && (
                                                    <Link href={item.linkPagamento || "/checkout/INV-DEMO-001"} className="mt-2 inline-block px-4 py-2 rounded-lg bg-[#1a2744] text-white text-sm font-medium hover:bg-[#0f3460] transition-colors">Paga ora</Link>
                                                )}
                                                {item.stato === 'pagato' && <span className="text-sm font-medium text-green-700">✓ Pagato</span>}
                                                {item.stato === 'bloccato' && <span className="text-sm text-gray-500">Bloccato</span>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === "documenti" && (
                        <div className="bg-white rounded-2xl border border-gray-100 p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-bold text-[#1a2744]">Data Room Documenti</h2>
                                <div className="text-sm text-gray-500">{documenti.filter((d: any) => d.scaricabile).length} di {documenti.length} disponibili</div>
                            </div>
                            <div className="space-y-3">
                                {documenti.map((doc: any, i: number) => (
                                    <div key={i} className={`flex items-center justify-between p-4 rounded-xl border ${doc.scaricabile ? 'bg-white border-gray-200 hover:border-orange-300' : 'bg-gray-50 border-gray-100'} transition-colors`}>
                                        <div className="flex items-center gap-4">
                                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${doc.scaricabile ? 'bg-blue-100 text-blue-600' : 'bg-gray-200 text-gray-400'}`}>
                                                {doc.scaricabile ? <FileText size={20} /> : <Lock size={20} />}
                                            </div>
                                            <div>
                                                <div className={`font-medium ${doc.scaricabile ? 'text-[#1a2744]' : 'text-gray-400'}`}>{doc.nome}</div>
                                                <div className="text-xs text-gray-500 flex items-center gap-2">
                                                    <span>Fase {doc.fase}</span><span>•</span><span>{doc.data}</span>
                                                    {doc.dimensione && <><span>•</span><span>{doc.dimensione}</span></>}
                                                </div>
                                            </div>
                                        </div>
                                        {doc.scaricabile ? (
                                            <button className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-sm font-medium text-[#1a2744]"><Download size={16} /> Scarica</button>
                                        ) : (
                                            <span className="text-xs text-gray-400 flex items-center gap-1"><Lock size={12} /> Sblocca con SAL {doc.fase}</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === "messaggi" && (
                        <div className="bg-white rounded-2xl border border-gray-100 p-6">
                            <h2 className="text-xl font-bold text-[#1a2744] mb-6">Messaggi</h2>
                            <div className="space-y-4">
                                {messaggi.map((msg: any) => (
                                    <div key={msg.id} className={`p-4 rounded-xl border ${!msg.letto ? 'bg-orange-50 border-orange-200' : 'bg-white border-gray-200'}`}>
                                        <div className="flex items-start justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${msg.ruolo === 'consulente' ? 'bg-blue-500' : msg.ruolo === 'sistema' ? 'bg-gray-500' : 'bg-orange-500'}`}>
                                                    {msg.mittente.charAt(0)}
                                                </div>
                                                <div>
                                                    <div className="font-semibold text-[#1a2744]">{msg.mittente}</div>
                                                    <div className="text-xs text-gray-500">{msg.data}</div>
                                                </div>
                                            </div>
                                            {!msg.letto && <span className="text-xs px-2 py-1 rounded-full bg-orange-500 text-white font-medium">Nuovo</span>}
                                        </div>
                                        <p className="text-gray-700 text-sm pl-10">{msg.contenuto}</p>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-6 pt-6 border-t border-gray-100">
                                <div className="flex items-center gap-3">
                                    <input type="text" placeholder="Scrivi un messaggio al tuo consulente..." className="flex-1 px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20" />
                                    <button className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[#1a2744] text-white font-medium hover:bg-[#0f3460]"><Send size={18} /> Invia</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
