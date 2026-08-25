"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    LayoutDashboard, Clock, Euro, AlertTriangle, LogOut,
    FolderOpen, Users, AlertCircle, Calendar, Video,
    CheckCircle2, TrendingUp, FileText
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

                {/* TAB: PROGETTI */}
                {activeTab === "progetti" && (
                    <div className="grid md:grid-cols-2 gap-6">
                        {data.projects.map((proj: any) => (
                            <div key={proj.id} className="bg-white rounded-2xl border border-gray-100 p-6 hover:shadow-lg transition-all">
                                <div className="flex justify-between items-start mb-4">
                                    <span className={`text-xs px-2 py-1 rounded-full font-bold ${
                                        proj.level === 'L3' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                                    }`}>
                                        {proj.level}
                                    </span>
                                    <span className={`text-xs px-2 py-1 rounded-full ${
                                        proj.status === 'in_corso' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                                    }`}>
                                        {proj.status === 'in_corso' ? 'In Corso' : 'Completato'}
                                    </span>
                                </div>
                                <h3 className="text-xl font-bold text-[#1a2744] mb-1">{proj.name}</h3>
                                <p className="text-sm text-gray-500 mb-4">Cliente: {proj.client}</p>
                                <div className="flex items-center justify-between text-sm border-t border-gray-100 pt-4">
                                    <div className="flex items-center gap-2 text-gray-600">
                                        <Clock size={16} />
                                        <span>Scadenza: {proj.nextDeadline}</span>
                                    </div>
                                    <Link href={`/consultant/project-progress?id=${proj.id}`} className="text-blue-600 font-medium hover:underline flex items-center gap-1">
                                        Vedi dettagli →
                                    </Link>
                                </div>
                            </div>
                        ))}
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

                {/* TAB: RICHIESTE */}
                {activeTab === "richieste" && (
                    <div className="bg-white rounded-2xl border border-gray-100 p-6">
                        <h3 className="text-lg font-bold text-[#1a2744] mb-4">Richieste Speciali</h3>
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                            <p className="text-sm text-blue-800">
                                <strong>📌 Nota:</strong> Da qui puoi gestire trasferimenti, sconti e segnalazioni.
                            </p>
                        </div>
                        <div className="grid md:grid-cols-2 gap-4 mt-6">
                            <button className="p-6 border-2 border-dashed border-gray-300 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-colors text-left">
                                <AlertTriangle size={24} className="text-gray-400 mb-2" />
                                <h4 className="font-bold text-[#1a2744]">Nuova Segnalazione</h4>
                                <p className="text-sm text-gray-500">Segnala un problema o un blocco</p>
                            </button>
                            <button className="p-6 border-2 border-dashed border-gray-300 rounded-xl hover:border-orange-500 hover:bg-orange-50 transition-colors text-left">
                                <Euro size={24} className="text-gray-400 mb-2" />
                                <h4 className="font-bold text-[#1a2744]">Richiedi Sconto</h4>
                                <p className="text-sm text-gray-500">Proponi uno sconto al cliente</p>
                            </button>
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
