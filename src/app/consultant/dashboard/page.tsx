"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import CallRoom from '@/components/CallRoom';
import Link from "next/link";

import {
    LayoutDashboard, Clock, Euro, AlertTriangle, LogOut,
    CheckCircle2, Hourglass, FolderOpen, Plus, Users, AlertCircle,
    Calendar, ChevronLeft, ChevronRight, X, Globe, Video
} from "lucide-react";

export default function ConsultantDashboard() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("progetti");
    const [data, setData] = useState<any>(null);
   
    // Stati per Call AI generica
    const [showGenericCall, setShowGenericCall] = useState(false);
    const [showGenericCallRoom, setShowGenericCallRoom] = useState(false);
    const [genericClientName, setGenericClientName] = useState("");
    // Stati per il calendario
    const [calendarEvents, setCalendarEvents] = useState<any[]>([]);
    const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
    const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
    const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
    const [showEventModal, setShowEventModal] = useState(false);
    const [selectedDay, setSelectedDay] = useState<number | null>(null);
    const [isChief, setIsChief] = useState(false);
    const [eventForm, setEventForm] = useState({
        title: '',
        description: '',
        date: '',
        time: '10:00',
        duration: 60,
        type: 'review',
        projectId: 'PI-2026-0024',
        projectName: '',
        clientName: '',
        isPublic: false
    });
    const [calendarFilter, setCalendarFilter] = useState<'all' | 'mine' | 'team'>('mine');

    // Stati per il form Segnalazione
    const [reportForm, setReportForm] = useState({
        projectId: 'PI-2026-0024',
        level: 'yellow' as 'green' | 'yellow' | 'red',
        category: 'cliente',
        title: '',
        description: ''
    });
    const [submittingReport, setSubmittingReport] = useState(false);

    // Stati per il form Sconto
    const [discountForm, setDiscountForm] = useState({
        projectId: 'PI-2026-0024',
        type: 'admin_request' as 'self_discount' | 'admin_request',
        discountPercentage: 5,
        motivation: ''
    });
    const [submittingDiscount, setSubmittingDiscount] = useState(false);

    const [myRequests, setMyRequests] = useState({
        riskReports: [],
        transferRequests: [],
        discountRequests: []
    });

    useEffect(() => {
        const session = localStorage.getItem("pi_session");
        if (session) {
            try {
                const parsed = JSON.parse(session);
                setUser(parsed);
                setIsChief(parsed.isChief || false);
            } catch (e) {
                localStorage.removeItem("pi_session");
                router.push("/login");
            }
        } else {
            router.push("/login");
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
            fetch(`/api/consultant/requests?consultantId=${user.clientId}`)
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
            const res = await fetch(`/api/consultant/calendar?consultantId=${user.clientId}&startDate=${startDate}&endDate=${endDate}`);
            const data = await res.json();
            setCalendarEvents(data.events || []);
        } catch (error) {
            console.error('Errore caricamento calendario:', error);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem("pi_session");
        // ✅ Cancella anche il cookie
        document.cookie = "pi_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
        window.location.href = "/login";
    };

    const submitReport = async () => {
        if (!reportForm.title.trim() || !reportForm.description.trim()) {
            alert('Compila titolo e descrizione');
            return;
        }
        setSubmittingReport(true);
        try {
            const res = await fetch('/api/admin/requests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    category: 'riskReports',
                    projectId: reportForm.projectId,
                    projectName: 'Ristrutturazione Debito & Passaggio Generazionale',
                    consultantId: user?.clientId || 'CONS-001',
                    consultantName: user?.name || 'Christian',
                    level: reportForm.level,
                    issueCategory: reportForm.category,
                    title: reportForm.title,
                    description: reportForm.description
                })
            });
            if (res.ok) {
                alert('✅ Segnalazione inviata con successo!');
                setReportForm({ projectId: 'PI-2026-0024', level: 'yellow', category: 'cliente', title: '', description: '' });
                setActiveTab('richieste');
            }
        } catch (error) {
            alert('Errore invio');
        } finally {
            setSubmittingReport(false);
        }
    };

    const submitDiscount = async () => {
        if (!discountForm.motivation.trim()) {
            alert('Inserisci la motivazione');
            return;
        }
        if (discountForm.type === 'self_discount' && discountForm.discountPercentage > 5) {
            alert('Lo sconto proprio non può superare il 5%');
            return;
        }
        setSubmittingDiscount(true);
        try {
            const res = await fetch('/api/admin/requests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    category: 'discountRequests',
                    projectId: discountForm.projectId,
                    projectName: 'Ristrutturazione Debito & Passaggio Generazionale',
                    consultantId: user?.clientId || 'CONS-001',
                    consultantName: user?.name || 'Christian',
                    discountType: discountForm.type,
                    discountPercentage: discountForm.discountPercentage,
                    motivation: discountForm.motivation
                })
            });
            if (res.ok) {
                const msg = discountForm.type === 'self_discount'
                    ? '✅ Sconto proprio applicato e registrato!'
                    : '✅ Richiesta sconto inviata all\'Admin per approvazione!';
                alert(msg);
                setDiscountForm({ projectId: 'PI-2026-0024', type: 'admin_request', discountPercentage: 5, motivation: '' });
                setActiveTab('richieste');
            }
        } catch (error) {
            alert('Errore invio');
        } finally {
            setSubmittingDiscount(false);
        }
    };

    const createEvent = async () => {
        if (!eventForm.title.trim()) {
            alert('Inserisci un titolo');
            return;
        }
        try {
            const res = await fetch('/api/consultant/calendar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...eventForm,
                    consultantId: user?.clientId || 'PART-004',
                    consultantName: user?.name || 'Christian Rossi',
                    brand: 'progetto-impresa'
                })
            });
            if (res.ok) {
                alert('✅ Evento creato con successo!');
                setShowEventModal(false);
                setEventForm({ title: '', description: '', date: '', time: '10:00', duration: 60, type: 'review', projectId: 'PI-2026-0024', projectName: '', clientName: '', isPublic: false });
                loadCalendarEvents();
            }
        } catch (error) {
            alert('Errore creazione evento');
        }
    };

    const deleteEvent = async (eventId: string) => {
        if (!confirm('Cancellare questo evento?')) return;
        try {
            await fetch(`/api/consultant/calendar?id=${eventId}`, { method: 'DELETE' });
            loadCalendarEvents();
        } catch (error) {
            alert('Errore eliminazione');
        }
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">Caricamento...</div>;
    if (!data) return null;

    const menuItems = [
        { id: "progetti", label: "I Miei Progetti", icon: FolderOpen },
        { id: "calendario", label: "Calendario", icon: Calendar },
        { id: "timesheet", label: "Timesheet & Ore", icon: Clock },
        { id: "provvigioni", label: "Provvigioni", icon: Euro },
        { id: "richieste", label: "Richieste & Segnalazioni", icon: AlertTriangle },
    ];

    const MONTHS = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
    const DAYS = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
    const getDaysInMonth = (m: number, y: number) => new Date(y, m + 1, 0).getDate();
    const getFirstDayOfMonth = (m: number, y: number) => {
        const d = new Date(y, m, 1).getDay();
        return d === 0 ? 6 : d - 1;
    };

    const getEventsForDay = (day: number) => {
        const dayString = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        return calendarEvents.filter((e: any) => e.date === dayString);
    };

    const navigateMonth = (direction: number) => {
        let newMonth = currentMonth + direction;
        let newYear = currentYear;
        if (newMonth < 0) {
            newMonth = 11;
            newYear--;
        } else if (newMonth > 11) {
            newMonth = 0;
            newYear++;
        }
        setCurrentMonth(newMonth);
        setCurrentYear(newYear);
    };

    return (
        <div className="min-h-screen bg-[#f8fafc] flex">
            {/* Sidebar Consulente */}
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
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all text-left ${activeTab === item.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-gray-600 hover:bg-gray-100'
                                }`}
                        >
                            <item.icon size={18} />
                            {item.label}
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
                        {activeTab === 'progetti' && 'I Miei Progetti Assegnati'}
                        {activeTab === 'calendario' && 'Calendario Generale'}
                        {activeTab === 'timesheet' && 'Registrazione Ore (Timesheet)'}
                        {activeTab === 'provvigioni' && 'Riepilogo Provvigioni'}
                        {activeTab === 'richieste' && 'Richieste Speciali & Segnalazioni'}
                        {activeTab === 'nuova-segnalazione' && 'Nuova Segnalazione'}
                        {activeTab === 'nuovo-sconto' && 'Richiedi Sconto'}
                    </h1>
                    <p className="text-gray-500 mt-1">
                        {activeTab === 'calendario' ? 'Gestisci i tuoi appuntamenti e visualizza la disponibilità del team' : (
                            <>
                                Tariffa oraria di riferimento:
                                <span className="font-bold text-blue-600 ml-1">€{data.consultant.hourlyRate}/h</span>
                                {data.consultant.commissionRate && (
                                    <span className="ml-4">• Provvigione: <span className="font-bold text-green-600">{data.consultant.commissionRate}%</span></span>
                                )}
                            </>
                        )}
                    </p>
                    <button
                        onClick={() => setShowGenericCall(true)}
                        className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-red-600 to-red-700 text-white font-medium hover:shadow-lg transition-all"
                    >
                        <Video size={20} />
                        <div className="text-left">
                            <div className="font-bold text-sm">🎙️ Avvia Call AI Generica</div>
                            <div className="text-xs opacity-90">Call conoscitiva senza progetto</div>
                        </div>
                    </button>
                </header>
                {isChief && (
                    <Link
                        href="/consultant/team-dashboard"
                        className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all text-gray-600 hover:bg-gray-100"
                    >
                        <Users size={18} />
                        Dashboard Team
                        <span className="ml-auto px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-xs font-bold">CHIEF</span>
                    </Link>
                )}
                
                {/* TAB: PROGETTI */}
                {activeTab === "progetti" && (
                    <div className="grid md:grid-cols-2 gap-6">
                        {data.projects.map((proj: any) => (
                            <div key={proj.id} className="bg-white rounded-2xl border border-gray-100 p-6 hover:shadow-lg transition-all">
                                <div className="flex justify-between items-start mb-4">
                                    <span className={`text-xs px-2 py-1 rounded-full font-bold ${proj.level === 'L3' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                        {proj.level}
                                    </span>
                                    <span className={`text-xs px-2 py-1 rounded-full ${proj.status === 'in_corso' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
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

                {/* TAB: CALENDARIO */}
                {activeTab === "calendario" && (
                    <div className="space-y-4">
                        {/* Toolbar Calendario */}
                        <div className="bg-white rounded-xl border border-gray-100 p-4">
                            <div className="flex items-center justify-between flex-wrap gap-3">
                                <div className="flex items-center gap-3">
                                    <button onClick={() => navigateMonth(-1)} className="p-1.5 rounded-lg hover:bg-gray-100">
                                        <ChevronLeft size={18} />
                                    </button>
                                    <h2 className="text-lg font-bold text-[#1a2744] min-w-[160px] text-center">
                                        {MONTHS[currentMonth]} {currentYear}
                                    </h2>
                                    <button onClick={() => navigateMonth(1)} className="p-1.5 rounded-lg hover:bg-gray-100">
                                        <ChevronRight size={18} />
                                    </button>
                                </div>

                                <div className="flex items-center gap-2">
                                    {/* Toggle Vista */}
                                    <div className="flex bg-gray-100 rounded-lg p-0.5">
                                        <button
                                            onClick={() => setViewMode('month')}
                                            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === 'month' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-600'}`}
                                        >
                                            Mese
                                        </button>
                                        <button
                                            onClick={() => setViewMode('week')}
                                            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === 'week' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-600'}`}
                                        >
                                            Settimana
                                        </button>
                                    </div>

                                    {/* Filtro */}
                                    <select
                                        value={calendarFilter}
                                        onChange={(e) => setCalendarFilter(e.target.value as any)}
                                        className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs"
                                    >
                                        <option value="mine">I Miei Eventi</option>
                                        <option value="team">Team (Solo Disponibilità)</option>
                                    </select>

                                    {/* Nuovo Evento */}
                                    <button
                                        onClick={() => {
                                            setSelectedDay(new Date().getDate());
                                            setEventForm({
                                                ...eventForm,
                                                date: `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`
                                            });
                                            setShowEventModal(true);
                                        }}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700"
                                    >
                                        <Plus size={14} /> Nuovo
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Vista Mese */}
                        {viewMode === 'month' && (
                            <div className="bg-white rounded-xl border border-gray-100 p-4">
                                <div className="grid grid-cols-7 gap-1 mb-1">
                                    {DAYS.map(day => (
                                        <div key={day} className="text-center text-xs font-bold text-gray-500 py-1">{day}</div>
                                    ))}
                                </div>
                                <div className="grid grid-cols-7 gap-1">
                                    {Array.from({ length: getFirstDayOfMonth(currentMonth, currentYear) }).map((_, i) => (
                                        <div key={`empty-${i}`} className="h-16 bg-gray-50 rounded"></div>
                                    ))}
                                    {Array.from({ length: getDaysInMonth(currentMonth, currentYear) }).map((_, i) => {
                                        const day = i + 1;
                                        const dayEvents = getEventsForDay(day);
                                        const isToday = day === new Date().getDate() && currentMonth === new Date().getMonth() && currentYear === new Date().getFullYear();
                                        return (
                                            <button
                                                key={day}
                                                onClick={() => {
                                                    setSelectedDay(day);
                                                    setEventForm({
                                                        ...eventForm,
                                                        date: `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                                                    });
                                                    setShowEventModal(true);
                                                }}
                                                className={`h-16 p-1.5 rounded border transition-all hover:border-blue-300 text-left ${isToday ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:bg-gray-50'}`}
                                            >
                                                <div className={`text-xs font-bold mb-0.5 ${isToday ? 'text-orange-600' : 'text-gray-700'}`}>{day}</div>
                                                <div className="space-y-0.5">
                                                    {dayEvents.slice(0, 2).map((event: any) => (
                                                        <div
                                                            key={event.id}
                                                            className={`text-[10px] px-1.5 py-0.5 rounded text-white truncate ${event.type === 'call-ai' ? 'bg-purple-500' : 'bg-blue-500'
                                                                }`}
                                                            title={`${event.time} - ${event.title}`}
                                                        >
                                                            {event.type === 'call-ai' && '🎙️ '}
                                                            {event.time} {event.title}
                                                        </div>
                                                    ))}
                                                    {dayEvents.length > 2 && <div className="text-[9px] text-gray-500 font-medium">+{dayEvents.length - 2}</div>}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Vista Settimana */}
                        {viewMode === 'week' && (
                            <div className="bg-white rounded-xl border border-gray-100 p-4">
                                <div className="grid grid-cols-7 gap-2">
                                    {DAYS.map((day, i) => {
                                        const today = new Date();
                                        const currentDay = new Date(currentYear, currentMonth, today.getDate() - today.getDay() + i + 1);
                                        const dayString = `${currentDay.getFullYear()}-${String(currentDay.getMonth() + 1).padStart(2, '0')}-${String(currentDay.getDate()).padStart(2, '0')}`;
                                        const dayEvents = calendarEvents.filter((e: any) => e.date === dayString);
                                        const isToday = currentDay.toDateString() === today.toDateString();

                                        return (
                                            <div key={day} className={`p-2 rounded-lg ${isToday ? 'bg-orange-50 border-2 border-orange-500' : 'bg-gray-50'}`}>
                                                <div className={`text-xs font-bold mb-2 ${isToday ? 'text-orange-600' : 'text-gray-700'}`}>
                                                    {day} {currentDay.getDate()}
                                                </div>
                                                <div className="space-y-1">
                                                    {dayEvents.map((event: any) => (
                                                        <div
                                                            key={event.id}
                                                            className="text-[10px] px-1.5 py-1 rounded text-white truncate bg-blue-500 cursor-pointer hover:bg-blue-600"
                                                            onClick={() => alert(`${event.title}\n${event.time} - ${event.duration} min\n${event.description || 'Nessuna descrizione'}`)}
                                                            title={event.title}
                                                        >
                                                            {event.time} {event.title}
                                                        </div>
                                                    ))}
                                                    {dayEvents.length === 0 && <div className="text-[9px] text-gray-400">Libero</div>}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Vista Team (solo disponibilità) */}
                        {calendarFilter === 'team' && (
                            <div className="bg-white rounded-xl border border-gray-100 p-4">
                                <h3 className="text-sm font-bold text-[#1a2744] mb-3">Disponibilità Team</h3>
                                <div className="space-y-2">
                                    <div className="p-3 bg-gray-50 rounded-lg flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold">DN</div>
                                            <div>
                                                <div className="font-bold text-sm text-[#1a2744]">Davide Neri</div>
                                                <div className="text-xs text-gray-500">Consulente Senior</div>
                                            </div>
                                        </div>
                                        <span className="text-xs font-medium text-green-600">3 slot liberi oggi</span>
                                    </div>
                                    <div className="p-3 bg-gray-50 rounded-lg flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white text-xs font-bold">LB</div>
                                            <div>
                                                <div className="font-bold text-sm text-[#1a2744]">Laura Bianchi</div>
                                                <div className="text-xs text-gray-500">Consulente Junior</div>
                                            </div>
                                        </div>
                                        <span className="text-xs font-medium text-orange-600">Occupato fino alle 15:00</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Lista Eventi del Mese */}
                        {calendarEvents.length > 0 && calendarFilter !== 'team' && (
                            <div className="bg-white rounded-xl border border-gray-100 p-4">
                                <h3 className="text-sm font-bold text-[#1a2744] mb-3">Eventi di {MONTHS[currentMonth]} ({calendarEvents.length})</h3>
                                <div className="space-y-2">
                                    {calendarEvents.map((event: any) => (
                                        <div key={event.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold bg-blue-500 text-xs">
                                                    {new Date(event.date).getDate()}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-sm text-[#1a2744]">{event.title}</div>
                                                    <div className="text-xs text-gray-600">{event.time} • {event.duration} min</div>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => deleteEvent(event.id)}
                                                className="p-1.5 rounded-lg hover:bg-red-50 text-red-600"
                                                title="Elimina"
                                            >
                                                <X size={14} />
                                            </button>
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
                            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                                <Plus size={20} className="text-blue-600" /> Registra Nuova Attività
                            </h3>
                            <div className="grid md:grid-cols-4 gap-4">
                                <select className="px-4 py-2 rounded-lg border border-gray-200">
                                    <option>PI-2026-0024 (Ristrutturazione Debito)</option>
                                </select>
                                <input type="date" className="px-4 py-2 rounded-lg border border-gray-200" />
                                <input type="number" placeholder="Ore (es. 4)" className="px-4 py-2 rounded-lg border border-gray-200" />
                                <button className="bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">Salva Ore</button>
                            </div>
                            <input type="text" placeholder="Descrizione attività svolta..." className="w-full mt-4 px-4 py-2 rounded-lg border border-gray-200" />
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
                                            <td className="px-6 py-4 text-sm font-bold text-green-600">€{(ts.hours * (ts.hourlyRate || data.consultant.hourlyRate)).toLocaleString()}</td>
                                            <td className="px-6 py-4">
                                                <span className={`text-xs px-2 py-1 rounded-full font-medium ${ts.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
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

                {/* TAB: PROVIGIONI */}
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
                                <div className="text-sm text-gray-500 mb-1">In Attesa di Chiusura</div>
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
                                            <span className={`text-xs px-2 py-0.5 rounded-full ${comm.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                                                {comm.status === 'paid' ? 'Erogato' : 'In maturazione'}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB: RICHIESTE & SEGNALAZIONI */}
                {activeTab === "richieste" && (
                    <div className="space-y-6">
                        <div className="grid md:grid-cols-3 gap-6">
                            <div className="bg-white rounded-2xl border border-gray-100 p-6">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center"><AlertTriangle size={20} className="text-red-600" /></div>
                                    <h3 className="font-bold text-[#1a2744] text-sm">Segnalazioni Attive</h3>
                                </div>
                                <div className="text-3xl font-bold text-red-600">{myRequests.riskReports.filter((r: any) => r.status === 'open').length}</div>
                            </div>
                            <div className="bg-white rounded-2xl border border-gray-100 p-6">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center"><Euro size={20} className="text-orange-600" /></div>
                                    <h3 className="font-bold text-[#1a2744] text-sm">Richieste Sconto</h3>
                                </div>
                                <div className="text-3xl font-bold text-orange-600">{myRequests.discountRequests.filter((d: any) => d.status === 'pending').length}</div>
                            </div>
                            <div className="bg-white rounded-2xl border border-gray-100 p-6">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center"><Users size={20} className="text-blue-600" /></div>
                                    <h3 className="font-bold text-[#1a2744] text-sm">Progetti Team (Read-Only)</h3>
                                </div>
                                <div className="text-3xl font-bold text-blue-600">5</div>
                            </div>
                        </div>

                        <div className="grid md:grid-cols-2 gap-6">
                            <button onClick={() => setActiveTab('nuova-segnalazione')} className="bg-gradient-to-br from-red-500 to-red-700 text-white rounded-2xl p-6 hover:shadow-lg transition-all text-left">
                                <AlertTriangle size={32} className="mb-3" />
                                <h3 className="text-xl font-bold mb-2">🚩 Nuova Segnalazione</h3>
                                <p className="text-sm opacity-90">Segnala un blocco, richiedi supporto o escalation</p>
                            </button>
                            <button onClick={() => setActiveTab('nuovo-sconto')} className="bg-gradient-to-br from-orange-500 to-orange-700 text-white rounded-2xl p-6 hover:shadow-lg transition-all text-left">
                                <Euro size={32} className="mb-3" />
                                <h3 className="text-xl font-bold mb-2">💰 Richiedi Sconto</h3>
                                <p className="text-sm opacity-90">Proponi sconto al cliente o richiedi eccezione admin</p>
                            </button>
                        </div>

                        <div className="bg-white rounded-2xl border border-gray-100 p-6">
                            <h3 className="font-bold text-lg mb-4">Le Mie Segnalazioni ({myRequests.riskReports.length})</h3>
                            <div className="space-y-3">
                                {myRequests.riskReports.length === 0 ? (
                                    <div className="text-center py-8 text-gray-400"><AlertTriangle size={32} className="mx-auto mb-2 opacity-30" /><p>Nessuna segnalazione inviata</p></div>
                                ) : (
                                    myRequests.riskReports.map((report: any) => (
                                        <div key={report.id} className={`flex items-center justify-between p-4 rounded-xl border ${report.level === 'red' ? 'bg-red-50 border-red-200' : report.level === 'yellow' ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-200'}`}>
                                            <div className="flex items-center gap-3">
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white ${report.level === 'red' ? 'bg-red-500' : report.level === 'yellow' ? 'bg-yellow-500' : 'bg-green-500'}`}><AlertTriangle size={20} /></div>
                                                <div>
                                                    <div className="font-bold text-[#1a2744]">{report.title}</div>
                                                    <div className="text-sm text-gray-600">{report.projectId} • Livello {report.level}</div>
                                                    {report.adminNotes && <div className="text-xs text-blue-600 mt-1 italic">💬 {report.adminNotes}</div>}
                                                </div>
                                            </div>
                                            <span className={`text-xs px-2 py-1 rounded-full font-medium ${report.status === 'open' ? 'bg-orange-100 text-orange-700' : report.status === 'resolved' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                                                {report.status === 'open' ? 'In attesa' : report.status === 'resolved' ? 'Risolta' : 'Ignorata'}
                                            </span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB: NUOVA SEGNALAZIONE */}
                {activeTab === 'nuova-segnalazione' && (
                    <div className="bg-white rounded-2xl border border-gray-100 p-6">
                        <h3 className="text-xl font-bold text-[#1a2744] mb-6">🚩 Nuova Segnalazione (Triangolo di Heinrich)</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Progetto</label>
                                <select value={reportForm.projectId} onChange={(e) => setReportForm({ ...reportForm, projectId: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 bg-white">
                                    <option value="PI-2026-0024">PI-2026-0024 - Ristrutturazione Debito & Passaggio Generazionale</option>
                                    <option value="PI-2026-0018">PI-2026-0018 - Business Plan Startup Tech</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Livello di Gravità</label>
                                <div className="grid grid-cols-3 gap-3">
                                    <button type="button" onClick={() => setReportForm({ ...reportForm, level: 'green' })} className={`p-4 rounded-xl border-2 text-left transition-all ${reportForm.level === 'green' ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-green-300 bg-white'}`}>
                                        <div className={`font-bold mb-1 ${reportForm.level === 'green' ? 'text-green-700' : 'text-gray-700'}`}>🟢 Verde</div>
                                        <div className="text-xs text-gray-600">Segnalazione preventiva, nessun blocco</div>
                                    </button>
                                    <button type="button" onClick={() => setReportForm({ ...reportForm, level: 'yellow' })} className={`p-4 rounded-xl border-2 text-left transition-all ${reportForm.level === 'yellow' ? 'border-yellow-500 bg-yellow-50' : 'border-gray-200 hover:border-yellow-300 bg-white'}`}>
                                        <div className={`font-bold mb-1 ${reportForm.level === 'yellow' ? 'text-yellow-700' : 'text-gray-700'}`}>🟡 Giallo</div>
                                        <div className="text-xs text-gray-600">Richiesta supporto, blocco parziale</div>
                                    </button>
                                    <button type="button" onClick={() => setReportForm({ ...reportForm, level: 'red' })} className={`p-4 rounded-xl border-2 text-left transition-all ${reportForm.level === 'red' ? 'border-red-500 bg-red-50' : 'border-gray-200 hover:border-red-300 bg-white'}`}>
                                        <div className={`font-bold mb-1 ${reportForm.level === 'red' ? 'text-red-700' : 'text-gray-700'}`}>🔴 Rosso</div>
                                        <div className="text-xs text-gray-600">Blocco critico, escalation immediata</div>
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Categoria</label>
                                <select value={reportForm.category} onChange={(e) => setReportForm({ ...reportForm, category: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 bg-white">
                                    <option value="cliente">Problema con il cliente</option>
                                    <option value="tecnico">Richiesta supporto tecnico</option>
                                    <option value="admin">Richiesta amministrativa</option>
                                    <option value="altro">Altro</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Titolo *</label>
                                <input type="text" value={reportForm.title} onChange={(e) => setReportForm({ ...reportForm, title: e.target.value })} placeholder="Es: Ritardo invio documenti" className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Descrizione Dettagliata *</label>
                                <textarea rows={5} value={reportForm.description} onChange={(e) => setReportForm({ ...reportForm, description: e.target.value })} placeholder="Descrivi il problema, il contesto e l'impatto sul progetto..." className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 resize-none" />
                            </div>
                            <div className="flex gap-3">
                                <button onClick={submitReport} disabled={submittingReport} className="flex-1 px-6 py-3 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 disabled:opacity-50">{submittingReport ? 'Invio in corso...' : '🚩 Invia Segnalazione'}</button>
                                <button onClick={() => setActiveTab('richieste')} className="px-6 py-3 rounded-xl border border-gray-200 hover:bg-gray-50 font-medium">Annulla</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB: NUOVO SCONTO */}
                {activeTab === 'nuovo-sconto' && (
                    <div className="bg-white rounded-2xl border border-gray-100 p-6">
                        <h3 className="text-xl font-bold text-[#1a2744] mb-6">💰 Richiedi Sconto</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Progetto</label>
                                <select value={discountForm.projectId} onChange={(e) => setDiscountForm({ ...discountForm, projectId: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 bg-white">
                                    <option value="PI-2026-0024">PI-2026-0024 - Ristrutturazione Debito & Passaggio Generazionale</option>
                                    <option value="PI-2026-0018">PI-2026-0018 - Business Plan Startup Tech</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Tipo di Sconto</label>
                                <div className="grid grid-cols-2 gap-4">
                                    <button type="button" onClick={() => setDiscountForm({ ...discountForm, type: 'self_discount', discountPercentage: Math.min(discountForm.discountPercentage, 5) })} className={`p-4 rounded-xl border-2 text-left transition-all ${discountForm.type === 'self_discount' ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:border-orange-300 bg-white'}`}>
                                        <div className={`font-bold mb-1 ${discountForm.type === 'self_discount' ? 'text-orange-700' : 'text-gray-700'}`}>A) Sconto Mio (Max 5%)</div>
                                        <div className="text-xs text-gray-600">Detratto dalla mia provvigione. Approvazione automatica.</div>
                                    </button>
                                    <button type="button" onClick={() => setDiscountForm({ ...discountForm, type: 'admin_request' })} className={`p-4 rounded-xl border-2 text-left transition-all ${discountForm.type === 'admin_request' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300 bg-white'}`}>
                                        <div className={`font-bold mb-1 ${discountForm.type === 'admin_request' ? 'text-blue-700' : 'text-gray-700'}`}>B) Richiesta Admin</div>
                                        <div className="text-xs text-gray-600">Sconto straordinario. Richiede approvazione admin.</div>
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Percentuale Sconto (%) {discountForm.type === 'self_discount' && <span className="text-red-600 ml-2">max 5%</span>}</label>
                                <input type="number" min="1" max={discountForm.type === 'self_discount' ? 5 : 50} value={discountForm.discountPercentage} onChange={(e) => setDiscountForm({ ...discountForm, discountPercentage: Number(e.target.value) })} className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20" />
                                <p className="text-xs text-gray-500 mt-1">{discountForm.type === 'self_discount' ? 'Max 5%. Verrà detratto automaticamente dalla tua provvigione.' : 'Nessun limite, ma l\'Admin valuterà caso per caso.'}</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Motivazione *</label>
                                <textarea rows={4} value={discountForm.motivation} onChange={(e) => setDiscountForm({ ...discountForm, motivation: e.target.value })} placeholder="Spiega perché questo sconto è necessario e quale beneficio porta..." className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 resize-none" />
                            </div>
                            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                                <div className="flex items-start gap-3">
                                    <AlertCircle size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
                                    <div className="text-sm text-blue-900">
                                        <strong>Nota:</strong> Se scegli "Sconto Mio", l'importo verrà automaticamente detratto dalla tua provvigione finale. Se scegli "Richiesta Admin", la richiesta verrà valutata dall'amministratore.
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <button onClick={submitDiscount} disabled={submittingDiscount} className="flex-1 px-6 py-3 rounded-xl bg-orange-600 text-white font-bold hover:bg-orange-700 disabled:opacity-50">{submittingDiscount ? 'Invio in corso...' : '💰 Invia Richiesta Sconto'}</button>
                                <button onClick={() => setActiveTab('richieste')} className="px-6 py-3 rounded-xl border border-gray-200 hover:bg-gray-50 font-medium">Annulla</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* MODAL: NUOVO EVENTO CALENDARIO */}
            {showEventModal && selectedDay && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowEventModal(false)}>
                    <div className="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-2xl font-bold text-[#1a2744]">📅 Nuovo Evento</h3>
                            <button onClick={() => setShowEventModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Titolo Evento *</label>
                                <input type="text" value={eventForm.title} onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })} placeholder="Es: Review SAL 2 - Banca Generali" className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Descrizione</label>
                                <textarea rows={3} value={eventForm.description} onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })} placeholder="Dettagli dell'appuntamento..." className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none" />
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Data</label>
                                    <input type="date" value={eventForm.date} onChange={(e) => setEventForm({ ...eventForm, date: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Ora</label>
                                    <input type="time" value={eventForm.time} onChange={(e) => setEventForm({ ...eventForm, time: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Durata (min)</label>
                                    <input type="number" value={eventForm.duration} onChange={(e) => setEventForm({ ...eventForm, duration: Number(e.target.value) })} className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Tipo Evento</label>
                                <select value={eventForm.type} onChange={(e) => setEventForm({ ...eventForm, type: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white">
                                    <option value="discovery">Call Discovery (30 min, gratuita)</option>
                                    <option value="review">Review Progetto (60 min, inclusa)</option>
                                    <option value="call">Consulenza Extra (60 min, €150)</option>
                                    <option value="public">Slot Pubblico (prenotabile)</option>
                                </select>
                            </div>
                            <div className="flex items-center gap-2">
                                <input type="checkbox" id="isPublic" checked={eventForm.isPublic} onChange={(e) => setEventForm({ ...eventForm, isPublic: e.target.checked })} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                                <label htmlFor="isPublic" className="text-sm font-medium text-gray-700">Rendi questo slot prenotabile dal pubblico</label>
                            </div>
                            <div className="flex gap-3 pt-4 border-t border-gray-200">
                                <button onClick={() => setShowEventModal(false)} className="flex-1 px-6 py-3 rounded-xl border border-gray-200 hover:bg-gray-50 font-medium">Annulla</button>
                                <button onClick={createEvent} className="flex-1 px-6 py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700">Crea Evento</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* MODAL: NUOVA CALL GENERICA */}
            {/* MODAL: NUOVA CALL GENERICA */}
            {showGenericCall && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl p-6 max-w-md w-full">
                        <h3 className="text-xl font-bold mb-4">🎙️ Nuova Call Conoscitiva</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nome Cliente / Azienda</label>
                                <input
                                    type="text"
                                    value={genericClientName}
                                    onChange={(e) => setGenericClientName(e.target.value)}
                                    placeholder="Es: Mario Rossi / Innovazione S.p.A."
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-red-500/20"
                                />
                            </div>
                            <div className="flex gap-3 mt-6">
                                <button
                                    onClick={() => {
                                        setShowGenericCall(false);
                                        setGenericClientName("");
                                    }}
                                    className="flex-1 px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 font-medium"
                                >
                                    Annulla
                                </button>
                                <button
                                    onClick={() => {
                                        if (!genericClientName.trim()) {
                                            alert("Inserisci il nome del cliente");
                                            return;
                                        }
                                        setShowGenericCall(false);
                                        setShowGenericCallRoom(true);
                                    }}
                                    className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700"
                                >
                                    Avvia Call
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* CALL ROOM GENERICA */}
            {showGenericCallRoom && (
                <CallRoom
                    projectId="GENERIC"
                    projectName="Call Conoscitiva"
                    clientName={genericClientName}
                    settore="generico"
                    livello="L1"
                    brand="progetto-impresa"
                    onClose={() => {
                        setShowGenericCallRoom(false);
                        setGenericClientName("");
                    }}
                />
            )}
        </div>
    );
}
