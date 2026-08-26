"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    LayoutDashboard, Clock, Euro, AlertTriangle, LogOut,
    FolderOpen, Users, AlertCircle, Calendar, Video,
    CheckCircle2, TrendingUp, FileText, PlusCircle, Eye, Check, X, Loader2
} from "lucide-react";
import { CalendarWithHeinrich } from "@/components/calendar/CalendarWithHeinrich";
import { ConsultantBookingLinks } from "@/components/booking/ConsultantBookingLinks";

export default function ConsultantDashboard() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("progetti");
    const [data, setData] = useState<any>(null);
    const [myRequests, setMyRequests] = useState<any>(null);    const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());   const [currentYear, setCurrentYear] = useState(new Date().getFullYear());    const [calendarEvents, setCalendarEvents] = useState<any[]>([]);

    // Tab "Progetti" e "Richieste" collegati per davvero a Odoo il
    // 25/08/2026 (compito "dashboard consulente", compito 2) - prima
    // mostravano solo data.projects (mock) e bottoni finti senza azione.
    // isAdmin distingue le azioni in piu' del ruolo (compito 3): il filtro
    // sui DATI resta comunque garantito lato Odoo (record rule + controllo
    // esplicito in consultant_api.py), qui e' solo mostra/nascondi azioni.
    const isAdmin = user?.role === 'admin';
    const [projectsData, setProjectsData] = useState<any>(null);
    const [projectsLoading, setProjectsLoading] = useState(false);
    const [showAllConsultants, setShowAllConsultants] = useState(false);

    const [richiesteData, setRichiesteData] = useState<any>(null);
    const [richiesteLoading, setRichiesteLoading] = useState(false);
    const [richiesteError, setRichiesteError] = useState<string | null>(null);
    const [decidingId, setDecidingId] = useState<number | null>(null);
    const [newRichiesta, setNewRichiesta] = useState({ leadId: '', tipo: 'assegnami', motivo: '' });
    const [creatingRichiesta, setCreatingRichiesta] = useState(false);

    async function loadProjects() {
        if (!user?.token) return;
        setProjectsLoading(true);
        try {
            const res = await fetch(`/api/consultant/projects${showAllConsultants ? '?all=1' : ''}`, {
                headers: { Authorization: `JWT ${user.token}` },
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json?.error || 'Errore caricamento progetti');
            setProjectsData(json);
        } catch (err) {
            console.error('Errore caricamento progetti reali:', err);
            setProjectsData(null);
        } finally {
            setProjectsLoading(false);
        }
    }

    async function loadRichieste() {
        if (!user?.token) return;
        setRichiesteLoading(true);
        setRichiesteError(null);
        try {
            const res = await fetch('/api/consultant/richieste', {
                headers: { Authorization: `JWT ${user.token}` },
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json?.error || 'Errore caricamento richieste');
            setRichiesteData(json);
        } catch (err: any) {
            console.error('Errore caricamento richieste reali:', err);
            setRichiesteError(err.message || 'Errore caricamento richieste');
        } finally {
            setRichiesteLoading(false);
        }
    }

    async function handleCreateRichiesta(e: React.FormEvent) {
        e.preventDefault();
        if (!user?.token || !newRichiesta.leadId.trim()) return;
        setCreatingRichiesta(true);
        setRichiesteError(null);
        try {
            const res = await fetch('/api/consultant/richieste', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `JWT ${user.token}` },
                body: JSON.stringify({
                    lead_id: Number(newRichiesta.leadId),
                    tipo: newRichiesta.tipo,
                    motivo: newRichiesta.motivo || undefined,
                }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json?.error || 'Impossibile creare la richiesta');
            setNewRichiesta({ leadId: '', tipo: 'assegnami', motivo: '' });
            await loadRichieste();
        } catch (err: any) {
            setRichiesteError(err.message || 'Impossibile creare la richiesta');
        } finally {
            setCreatingRichiesta(false);
        }
    }

    async function handleDecideRichiesta(id: number, decision: 'approve' | 'reject') {
        if (!user?.token) return;
        setDecidingId(id);
        setRichiesteError(null);
        try {
            const res = await fetch(`/api/consultant/richieste/${id}/decide`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `JWT ${user.token}` },
                body: JSON.stringify({ decision }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json?.error || 'Decisione non riuscita');
            await loadRichieste();
        } catch (err: any) {
            setRichiesteError(err.message || 'Decisione non riuscita');
        } finally {
            setDecidingId(null);
        }
    }

    // Dati mock
    const mockData = {
        consultant: {
            id: "PART-004",
            name: "Christian Rossi",
            email: "christian@progettoimpresa.it",
            hourlyRate: 100,
            commissionRate: 20,
        },
        projects: [
            {
                id: "PI-2026-0024",
                name: "Business Plan Startup Tech",
                client: "Innovazione S.p.A.",
                level: "L2",
                status: "in_corso",
                nextDeadline: "2026-07-30",
            },
            {
                id: "PI-2026-0018",
                name: "Ristrutturazione Debito & Passaggio Generazionale",
                client: "GreenEnergy S.r.l.",
                level: "L3",
                status: "in_corso",
                nextDeadline: "2026-08-15",
            },
        ],
        timesheet: [
            { id: 1, date: "2026-07-20", projectId: "PI-2026-0024", description: "Analisi di mercato", hours: 4, hourlyRate: 100, status: "approved" },
            { id: 2, date: "2026-07-21", projectId: "PI-2026-0018", description: "Financial modeling", hours: 3, hourlyRate: 100, status: "pending" },
        ],
        commissions: {
            totalEstimated: 4500,
            paid: 1500,
            pending: 3000,
            breakdown: [
                { project: "PI-2026-0024", date: "2026-07-15", amount: 1500, status: "paid" },
                { project: "PI-2026-0018", date: "2026-07-22", amount: 3000, status: "pending" },
            ],
        },
    };

    useEffect(() => {
        const session = localStorage.getItem("pi_session");
        if (!session) {
            router.push("/login");
            return;
        }
        try {
            const parsed = JSON.parse(session);
            if (parsed.role !== 'consultant' && parsed.role !== 'admin') {
                router.push("/login");
                return;
            }
            setUser(parsed);
            setData(mockData);
        } catch (e) {
            router.push("/login");
        } finally {
            setLoading(false);
        }
    }, [router]);

    // ✅ FIX: Carica i dati della dashboard quando l'utente è definito
    useEffect(() => {
        if (user?.clientId) {
            // 1. Carica i dati principali (progetti, timesheet, provvigioni)
            fetch('/api/consultant/dashboard')
                .then(res => {
                    if (!res.ok) throw new Error('Errore caricamento dashboard');
                    return res.json();
                })
                .then(dashboardData => {
                    setData(dashboardData);
                    setLoading(false);
                })
                .catch(err => {
                    console.error('Errore caricamento dashboard:', err);
                    setLoading(false);
                });

            // 2. Carica le richieste/segnalazioni
            fetch(`/api/consultant/requests?consultantId=${user.clientId || user.id}`)
                .then(res => res.json())
                .then(reqData => setMyRequests(reqData))
                .catch(err => console.error('Errore caricamento richieste:', err));
        }
    }, [user]);

    useEffect(() => {
        if (activeTab === 'calendario' && user?.clientId) {
            loadCalendarEvents();
        }
    }, [activeTab, user, currentMonth, currentYear]);

    useEffect(() => {
        if (activeTab === 'progetti' && user?.token) {
            loadProjects();
        }
    }, [activeTab, user, showAllConsultants]);

    useEffect(() => {
        if (activeTab === 'richieste' && user?.token) {
            loadRichieste();
        }
    }, [activeTab, user]);

    const loadCalendarEvents = async () => {
        try {
            const startDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
            const endDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-31`;
            const res = await fetch(`/api/consultant/calendar?consultantId=${user.clientId || user.id}&startDate=${startDate}&endDate=${endDate}`);
            const data = await res.json();
            setCalendarEvents(data.events || []);
        } catch (error) {
            console.error('Errore caricamento calendario:', error);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem("pi_session");
        document.cookie = "pi_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
        window.location.href = "/login";
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-8 max-w-md text-center">
                    <AlertCircle size={48} className="mx-auto mb-4 text-yellow-500" />
                    <h2 className="text-xl font-bold text-yellow-800">Nessun dato disponibile</h2>
                    <p className="text-yellow-600 mt-2">Contatta l'amministratore.</p>
                </div>
            </div>
        );
    }

    const menuItems = [
        { id: "progetti", label: "I Miei Progetti", icon: FolderOpen },
        { id: "timesheet", label: "Timesheet & Ore", icon: Clock },
        { id: "provvigioni", label: "Provvigioni", icon: Euro },
        { id: "richieste", label: "Richieste", icon: AlertTriangle },
        { id: "calendario", label: "Calendario", icon: Calendar },
    ];

    return (
        <div className="min-h-screen bg-[#f8fafc] flex">
            {/* Sidebar */}
            <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
                <div className="p-6 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center text-white font-bold">
                            {user?.name?.charAt(0) || 'C'}
                        </div>
                        <div>
                            <div className="font-bold text-[#1a2744]">Area Consulente</div>
                            <div className="text-xs text-gray-500 truncate">{user?.name}</div>
                        </div>
                    </div>
                </div>

                <nav className="flex-1 p-4 space-y-1">
                    {menuItems.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id)}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all text-left ${
                                activeTab === item.id 
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' 
                                    : 'text-gray-600 hover:bg-gray-100'
                            }`}
                        >
                            <item.icon size={18} />
                            {item.label}
                        </button>
                    ))}
                </nav>

                <div className="p-4 border-t border-gray-100">
                    <button 
                        onClick={handleLogout} 
                        className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-gray-600 hover:bg-red-50 hover:text-red-600 w-full"
                    >
                        <LogOut size={18} /> Esci
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 overflow-auto p-8">
                <header className="mb-8">
                    <h1 className="text-3xl font-bold text-[#1a2744]">
                        {activeTab === 'progetti' && 'I Miei Progetti Assegnati'}
                        {activeTab === 'timesheet' && 'Registrazione Ore'}
                        {activeTab === 'provvigioni' && 'Riepilogo Provvigioni'}
                        {activeTab === 'richieste' && 'Richieste & Segnalazioni'}
                        {activeTab === 'calendario' && 'Calendario e Rischi'}
                    </h1>
                    <p className="text-gray-500 mt-1">
                        Tariffa oraria: <span className="font-bold text-blue-600">€{data.consultant.hourlyRate}/h</span>
                        {data.consultant.commissionRate && (
                            <span className="ml-4">• Provvigione: <span className="font-bold text-green-600">{data.consultant.commissionRate}%</span></span>
                        )}
                    </p>
                </header>

                {/* TAB: PROGETTI - collegato per davvero a erpv6.production.order/
                    crm.lead (25/08/2026, compito "dashboard consulente"):
                    prima mostrava solo data.projects (mock, PI-2026-0024/0018
                    hardcoded). "Vedi tutti i consulenti" e' l'azione in piu'
                    riservata a Responsabile/Admin (compito 3) - il filtro sui
                    dati resta comunque garantito lato Odoo. */}
                {activeTab === "progetti" && (
                    <div className="space-y-6">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <Link
                                href="/consultant/nuovo-lead"
                                className="inline-flex items-center gap-2 bg-orange-500 text-white px-4 py-2.5 rounded-xl font-medium hover:bg-orange-600 transition-colors"
                            >
                                <PlusCircle size={18} /> Nuovo cliente (intervista)
                            </Link>
                            {isAdmin && (
                                <label className="inline-flex items-center gap-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-xl px-4 py-2.5">
                                    <input
                                        type="checkbox"
                                        checked={showAllConsultants}
                                        onChange={(e) => setShowAllConsultants(e.target.checked)}
                                    />
                                    <Eye size={16} /> Vedi tutti i consulenti (Admin)
                                </label>
                            )}
                        </div>

                        {projectsLoading && (
                            <div className="flex items-center gap-2 text-gray-500 text-sm">
                                <Loader2 size={16} className="animate-spin" /> Carico i progetti da Odoo...
                            </div>
                        )}

                        {!projectsLoading && projectsData && projectsData.orders.length === 0 && projectsData.leads_senza_produzione.length === 0 && (
                            <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-500">
                                Nessun progetto reale trovato{showAllConsultants ? '' : ' per te'}. Avvia un'intervista per un nuovo cliente per crearne uno.
                            </div>
                        )}

                        {!projectsLoading && !projectsData && (
                            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-yellow-800 text-sm">
                                Impossibile caricare i progetti reali da Odoo in questo momento.
                            </div>
                        )}

                        {projectsData && projectsData.orders.length > 0 && (
                            <div className="grid md:grid-cols-2 gap-6">
                                {projectsData.orders.map((proj: any) => (
                                    <div key={proj.id} className="bg-white rounded-2xl border border-gray-100 p-6 hover:shadow-lg transition-all">
                                        <div className="flex justify-between items-start mb-4 gap-2">
                                            <div className="flex flex-wrap gap-1.5">
                                                {(proj.ruoli_miei || []).map((r: string) => (
                                                    <span key={r} className="text-xs px-2 py-1 rounded-full font-bold bg-blue-100 text-blue-700">{r}</span>
                                                ))}
                                                {proj.verticale && (
                                                    <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600">{proj.verticale}</span>
                                                )}
                                            </div>
                                            <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 whitespace-nowrap">
                                                {proj.phase || 'senza fase'}
                                            </span>
                                        </div>
                                        <h3 className="text-xl font-bold text-[#1a2744] mb-1">{proj.name}</h3>
                                        <p className="text-sm text-gray-500 mb-4">
                                            Cliente: {proj.client || '—'}
                                            {showAllConsultants && proj.consulente && (
                                                <span className="ml-2 text-xs text-gray-400">· Consulente: {proj.consulente}</span>
                                            )}
                                        </p>
                                        <div className="flex items-center justify-between text-sm border-t border-gray-100 pt-4">
                                            <div className="flex items-center gap-2 text-gray-600">
                                                <Clock size={16} />
                                                <span>Lead #{proj.lead_id}</span>
                                            </div>
                                            <Link href={`/consultant/project-progress?id=${proj.id}`} className="text-blue-600 font-medium hover:underline flex items-center gap-1">
                                                Vedi dettagli →
                                            </Link>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {projectsData && projectsData.leads_senza_produzione.length > 0 && (
                            <div>
                                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">
                                    Lead senza produzione avviata (intervista non ancora completata)
                                </h3>
                                <div className="grid md:grid-cols-2 gap-4">
                                    {projectsData.leads_senza_produzione.map((lead: any) => (
                                        <div key={lead.id} className="bg-white rounded-xl border border-dashed border-gray-300 p-4">
                                            <div className="flex items-center justify-between">
                                                <span className="font-medium text-[#1a2744]">{lead.name}</span>
                                                <span className="text-xs text-gray-400">Lead #{lead.id}</span>
                                            </div>
                                            <p className="text-sm text-gray-500 mt-1">Cliente: {lead.client || '—'}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* TAB: TIMESHEET */}
                {activeTab === "timesheet" && (
                    <div className="space-y-6">
                        <div className="bg-white rounded-2xl border border-gray-100 p-6">
                            <h3 className="font-bold text-lg mb-4">Registra Nuova Attività</h3>
                            <div className="grid md:grid-cols-4 gap-4">
                                <select className="px-4 py-2 rounded-lg border border-gray-200">
                                    {data.projects.map((p: any) => (
                                        <option key={p.id} value={p.id}>{p.id} - {p.name}</option>
                                    ))}
                                </select>
                                <input type="date" className="px-4 py-2 rounded-lg border border-gray-200" />
                                <input type="number" placeholder="Ore" className="px-4 py-2 rounded-lg border border-gray-200" />
                                <button className="bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">Salva Ore</button>
                            </div>
                            <input type="text" placeholder="Descrizione attività..." className="w-full mt-4 px-4 py-2 rounded-lg border border-gray-200" />
                        </div>
                        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                            <table className="w-full">
                                <thead className="bg-gray-50 border-b border-gray-200">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Progetto</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Descrizione</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ore</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Valore</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stato</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {data.timesheet.map((ts: any) => (
                                        <tr key={ts.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 text-sm text-gray-900">{ts.date}</td>
                                            <td className="px-6 py-4 text-sm font-medium text-[#1a2744]">{ts.projectId}</td>
                                            <td className="px-6 py-4 text-sm text-gray-600">{ts.description}</td>
                                            <td className="px-6 py-4 text-sm font-bold text-blue-600">{ts.hours}h</td>
                                            <td className="px-6 py-4 text-sm font-bold text-green-600">€{(ts.hours * ts.hourlyRate).toLocaleString()}</td>
                                            <td className="px-6 py-4">
                                                <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                                                    ts.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                                                }`}>
                                                    {ts.status === 'approved' ? '✓ Approvato' : '⏳ In attesa'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* TAB: PROVVIGIONI */}
                {activeTab === "provvigioni" && (
                    <div className="space-y-6">
                        <div className="grid md:grid-cols-3 gap-6">
                            <div className="bg-gradient-to-br from-blue-600 to-blue-800 text-white rounded-2xl p-6">
                                <div className="text-sm opacity-80 mb-1">Totale Stimato</div>
                                <div className="text-3xl font-bold">€{data.commissions.totalEstimated.toLocaleString()}</div>
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
                        <div className="bg-white rounded-2xl border border-gray-100 p-6">
                            <h3 className="font-bold text-lg mb-4">Dettaglio per Progetto</h3>
                            <div className="space-y-3">
                                {data.commissions.breakdown.map((comm: any, i: number) => (
                                    <div key={i} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                                        <div>
                                            <div className="font-bold text-[#1a2744]">{comm.project}</div>
                                            <div className="text-sm text-gray-500">{comm.date}</div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-xl font-bold text-blue-600">€{comm.amount.toLocaleString()}</div>
                                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                                                comm.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                                            }`}>
                                                {comm.status === 'paid' ? 'Erogato' : 'In maturazione'}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB: RICHIESTE - collegato per davvero a
                    erpv6.consulente.richiesta (25/08/2026, compito "dashboard
                    consulente"): prima erano due bottoni finti senza azione.
                    Approva/Rifiuta e' l'azione in piu' riservata a
                    Responsabile/Admin (compito 3, projectsData.can_decide) -
                    il controllo VERO resta comunque lato Odoo
                    (action_approve/action_reject), mai solo qui. */}
                {activeTab === "richieste" && (
                    <div className="space-y-6">
                        <div className="bg-white rounded-2xl border border-gray-100 p-6">
                            <h3 className="text-lg font-bold text-[#1a2744] mb-4">Nuova richiesta su un lead</h3>
                            <form onSubmit={handleCreateRichiesta} className="grid md:grid-cols-4 gap-3 items-start">
                                <input
                                    type="number"
                                    placeholder="ID lead"
                                    required
                                    value={newRichiesta.leadId}
                                    onChange={(e) => setNewRichiesta((s) => ({ ...s, leadId: e.target.value }))}
                                    className="px-4 py-2 rounded-lg border border-gray-200"
                                />
                                <select
                                    value={newRichiesta.tipo}
                                    onChange={(e) => setNewRichiesta((s) => ({ ...s, tipo: e.target.value }))}
                                    className="px-4 py-2 rounded-lg border border-gray-200"
                                >
                                    <option value="assegnami">Vorrei essere assegnato</option>
                                    <option value="non_assegnarmi">Preferirei non essere assegnato</option>
                                </select>
                                <input
                                    type="text"
                                    placeholder="Motivo (facoltativo)"
                                    value={newRichiesta.motivo}
                                    onChange={(e) => setNewRichiesta((s) => ({ ...s, motivo: e.target.value }))}
                                    className="px-4 py-2 rounded-lg border border-gray-200 md:col-span-1"
                                />
                                <button
                                    type="submit"
                                    disabled={creatingRichiesta || !newRichiesta.leadId.trim()}
                                    className="bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 px-4 py-2 disabled:opacity-50"
                                >
                                    {creatingRichiesta ? 'Invio...' : 'Invia richiesta'}
                                </button>
                            </form>
                        </div>

                        {richiesteError && (
                            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{richiesteError}</div>
                        )}

                        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                                <h3 className="font-bold text-lg">
                                    {richiesteData?.can_decide ? 'Tutte le richieste (Responsabile/Admin)' : 'Le mie richieste'}
                                </h3>
                                {richiesteLoading && <Loader2 size={16} className="animate-spin text-gray-400" />}
                            </div>
                            {richiesteData && richiesteData.richieste.length === 0 && (
                                <div className="p-6 text-center text-gray-500 text-sm">Nessuna richiesta trovata.</div>
                            )}
                            {richiesteData && richiesteData.richieste.length > 0 && (
                                <table className="w-full">
                                    <thead className="bg-gray-50 border-b border-gray-200">
                                        <tr>
                                            {richiesteData.can_decide && (
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Consulente</th>
                                            )}
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Lead</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Richiesta</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Motivo</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stato</th>
                                            {richiesteData.can_decide && (
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Azioni</th>
                                            )}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                        {richiesteData.richieste.map((r: any) => (
                                            <tr key={r.id} className="hover:bg-gray-50">
                                                {richiesteData.can_decide && (
                                                    <td className="px-6 py-4 text-sm text-gray-900">{r.consulente}</td>
                                                )}
                                                <td className="px-6 py-4 text-sm font-medium text-[#1a2744]">
                                                    {r.lead_name} <span className="text-gray-400">#{r.lead_id}</span>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-600">
                                                    {r.tipo === 'assegnami' ? 'Vorrei essere assegnato' : 'Preferirei non essere assegnato'}
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate" title={r.motivo}>{r.motivo || '—'}</td>
                                                <td className="px-6 py-4">
                                                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                                                        r.state === 'approvata' ? 'bg-green-100 text-green-700'
                                                        : r.state === 'rifiutata' ? 'bg-red-100 text-red-700'
                                                        : 'bg-orange-100 text-orange-700'
                                                    }`}>
                                                        {r.state === 'approvata' ? 'Approvata' : r.state === 'rifiutata' ? 'Rifiutata' : 'In attesa'}
                                                    </span>
                                                </td>
                                                {richiesteData.can_decide && (
                                                    <td className="px-6 py-4">
                                                        {r.state === 'in_attesa' ? (
                                                            <div className="flex gap-2">
                                                                <button
                                                                    disabled={decidingId === r.id}
                                                                    onClick={() => handleDecideRichiesta(r.id, 'approve')}
                                                                    className="p-2 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 disabled:opacity-50"
                                                                    title="Approva"
                                                                >
                                                                    <Check size={16} />
                                                                </button>
                                                                <button
                                                                    disabled={decidingId === r.id}
                                                                    onClick={() => handleDecideRichiesta(r.id, 'reject')}
                                                                    className="p-2 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-50"
                                                                    title="Rifiuta"
                                                                >
                                                                    <X size={16} />
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <span className="text-xs text-gray-400">{r.responsabile ? `da ${r.responsabile}` : '—'}</span>
                                                        )}
                                                    </td>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                )}

                {/* TAB: CALENDARIO */}
                {activeTab === "calendario" && (
                    <div className="space-y-6">
                        {/* Collegato per davvero a Odoo il 25/08/2026 (Denis:
                            "la parte da salvare e' sicuramente la call") -
                            erpv6.booking.token reale, non piu' un JSON su
                            disco. Vedi report: il modello reale non ha
                            giorno/ora, e' un link monouso con scadenza. */}
                        <ConsultantBookingLinks consultantId={user?.bookingConsultantId ?? null} token={user?.token} />
                        {/* CalendarWithHeinrich resta un widget SEPARATO e
                            ancora 100% con dati finti hardcoded (scadenze/
                            review/rischio progetto) - non riguarda la
                            prenotazione call, non toccato in questo giro
                            (solo analisi, vedi report). */}
                        <CalendarWithHeinrich />
                    </div>
                )}
            </div>
        </div>
    );
}
