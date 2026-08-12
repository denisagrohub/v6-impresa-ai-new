"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import CallRoom from '@/components/CallRoom';
import {
    ArrowLeft, Loader2, AlertTriangle, CheckCircle2,
    Brain, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Bell, Star,
    Video, Download, Plus, X, Mail, FileText, LayoutDashboard, TrendingUp
} from "lucide-react";

// ============ TIPI ============
interface AreaStatus { nome: string; stato: 'VERDE' | 'GIALLO' | 'ROSSO'; gap: string; }
interface Deliverable { nome: string; stato: 'approvato' | 'consegnato' | 'in_corso' | 'atteso'; scadenza: string; }
interface Interazione { data: string; tipo: 'call' | 'email'; pattern: string[]; note: string; }
interface CommercialWindow {
    id: string; brand: string; serviceCode: string; serviceName: string;
    categoria: string; mese: string; evento: string; opportunita: string;
    azione: string; priorita: string; kairos_impact: string; settori_target: string[];
}
interface BrandInfo { nome: string; logo: string; colore: string; }
interface ProjectProgress {
    id: string; nome: string; cliente: string; settore: string; fase: string;
    livello?: string;
    sei_aree: AreaStatus[];
    kairos: { score: number; livello: 'BASSO' | 'MEDIO' | 'ALTO'; quadrante: 'PREPARA' | 'KAIROS_AUTENTICO' | 'QUICK_WIN' | 'PARCHEGGIO'; };
    heinrich: { verde: number; giallo: number; rosso: number };
    deliverable: Deliverable[];
    ultime_interazioni: Interazione[];
    servizi_attivi: string[];
}

// ============ DEMO DATA ============
const DEMO_PROJECT: ProjectProgress = {
    id: "PI-2026-0024", nome: "Business Plan Startup Tech", cliente: "Innovazione S.p.A.",
    settore: "tech", fase: "Diagnostica",
    sei_aree: [
        { nome: "Strategia e Visione", stato: "GIALLO", gap: "Visione non documentata" },
        { nome: "Economico-Finanziaria", stato: "ROSSO", gap: "Burn rate non calcolato" },
        { nome: "Operativa e Organizzativa", stato: "VERDE", gap: "MVP funzionante" },
        { nome: "Persone e Clima", stato: "GIALLO", gap: "Turnover medio" },
        { nome: "Conformità, Rischio ed Etica", stato: "VERDE", gap: "GDPR compliant" },
        { nome: "Continuità e Futuro", stato: "ROSSO", gap: "Nessuna exit strategy" }
    ],
    kairos: { score: 11, livello: "MEDIO", quadrante: "KAIROS_AUTENTICO" },
    heinrich: { verde: 3, giallo: 2, rosso: 1 },
    deliverable: [
        { nome: "Intervista Diagnostica", stato: "approvato", scadenza: "2026-07-10" },
        { nome: "Mappa 6 Aree con VAL", stato: "consegnato", scadenza: "2026-07-15" },
        { nome: "Pareto dei Rischi", stato: "in_corso", scadenza: "2026-07-20" },
        { nome: "Business Plan Draft v1", stato: "atteso", scadenza: "2026-08-01" }
    ],
    ultime_interazioni: [
        { data: "2026-07-14", tipo: "call", pattern: ["PL-02", "PL-12"], note: "Founder usa 'noi', parla di 'quando iniziamo a settembre'." },
        { data: "2026-07-12", tipo: "email", pattern: ["DM-06"], note: "Email lunga con domande su Use of Funds." },
        { data: "2026-07-08", tipo: "call", pattern: ["PL-05", "NV-07"], note: "'Interessante, ma il burn rate mi preoccupa'." }
    ],
    servizi_attivi: ["BP-BUDGET", "FISC-DEDUC", "CALL-LUNEDI"]
};

export const dynamic = 'force-dynamic';
export default function ProjectProgressDashboard() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const projectId = searchParams.get('id') || 'PI-2026-0024';
    const [loading, setLoading] = useState(true);
    const [activeSection, setActiveSection] = useState<'avanzamento' | 'calendario' | 'interazioni'>('avanzamento');
    const [project, setProject] = useState<ProjectProgress>(DEMO_PROJECT);
    const [windows, setWindows] = useState<CommercialWindow[]>([]);
    const [brands, setBrands] = useState<Record<string, BrandInfo>>({});
    const [settoriDisponibili, setSettoriDisponibili] = useState<any[]>([]);
    const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
    const [currentYear, setCurrentYear] = useState(new Date().getFullYear());


    // Modal stati
    const [showAppointmentModal, setShowAppointmentModal] = useState(false);
    const [selectedDay, setSelectedDay] = useState<number | null>(null);
    const [appointments, setAppointments] = useState<any[]>([]);
    const [appointmentForm, setAppointmentForm] = useState({
        type: 'Call Discovery (30 min, gratuita)',
        title: '',
        time: '10:00',
        notes: '',
        participants: [] as Array<{ name: string; email: string; source: string }>
    });

    const [availableLeads, setAvailableLeads] = useState<any[]>([]);
    const [showParticipantSelector, setShowParticipantSelector] = useState(false);
    const [generatedMeetingLink, setGeneratedMeetingLink] = useState<string | null>(null);

    const [showActionModal, setShowActionModal] = useState(false);
    const [selectedWindow, setSelectedWindow] = useState<CommercialWindow | null>(null);
    const [actionType, setActionType] = useState<'funnel' | 'email' | 'template' | 'dashboard'>('funnel');

    // Call AI stati
    const [showCallRoom, setShowCallRoom] = useState(false);
    const [callRoom, setCallRoom] = useState<{ url: string; token: string } | null>(null);
    const [isStartingCall, setIsStartingCall] = useState(false);
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        // Carica lead esistenti per la selezione
        fetch('/api/leads')
            .then(res => res.json())
            .then(data => setAvailableLeads(data.leads || []))
            .catch(err => console.error('Errore caricamento lead:', err));
    }, []);
    useEffect(() => {
        const session = localStorage.getItem("pi_session");
        if (session) setUser(JSON.parse(session));
    }, []);

    useEffect(() => {
        const session = localStorage.getItem("pi_session");
        if (!session) {
            router.push("/login");
            return;
        }

        fetch('/api/kb?module=commercial-windows&role=consultant')
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (data?.data?.finestre) setWindows(data.data.finestre);
                if (data?.data?.brands) setBrands(data.data.brands);
                if (data?.data?.settori_disponibili) setSettoriDisponibili(data.data.settori_disponibili);
            })
            .catch((err) => console.error("Errore nel caricamento KB:", err))
            .finally(() => setLoading(false));

        fetch(`/api/appointments?projectId=${projectId}`)
            .then(r => r.ok ? r.json() : { appointments: [] })
            .then(data => setAppointments(data.appointments || []))
            .catch((err) => console.error("Errore nel caricamento appuntamenti:", err));

        fetch('/api/leads')
            .then(res => res.ok ? res.json() : { leads: [] })
            .then(data => setAvailableLeads(data.leads || []))
            .catch(err => console.error('Errore caricamento lead:', err));

    }, [router, projectId]);

    // ============ HELPERS ============
    const MONTHS = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
    const DAYS = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

    const getDaysInMonth = (m: number, y: number) => new Date(y, m + 1, 0).getDate();
    const getFirstDayOfMonth = (m: number, y: number) => {
        const d = new Date(y, m, 1).getDay();
        return d === 0 ? 6 : d - 1;
    };

    const getAreaColor = (s: string) => s === 'VERDE' ? 'bg-green-50 border-green-400 text-green-800' : s === 'GIALLO' ? 'bg-yellow-50 border-yellow-400 text-yellow-800' : 'bg-red-50 border-red-400 text-red-800';
    const getAreaIcon = (s: string) => s === 'VERDE' ? '✅' : s === 'GIALLO' ? '⚠️' : '🔴';
    const getKairosColor = (q: string) => q === 'KAIROS_AUTENTICO' ? 'from-green-500 to-emerald-600' : q === 'QUICK_WIN' ? 'from-blue-500 to-cyan-600' : q === 'PREPARA' ? 'from-orange-500 to-amber-600' : 'from-gray-400 to-gray-500';

    const navigateMonth = (direction: number) => {
        let newMonth = currentMonth + direction;
        let newYear = currentYear;
        if (newMonth < 0) { newMonth = 11; newYear--; }
        else if (newMonth > 11) { newMonth = 0; newYear++; }
        setCurrentMonth(newMonth);
        setCurrentYear(newYear);
    };

    const getWindowsForMonth = (month: number) => {
        const monthName = MONTHS[month];
        return windows.filter((w: CommercialWindow) => {
            const matchMonth = w.mese.toLowerCase().includes(monthName.toLowerCase().slice(0, 4)) ||
                ['Continuo', 'Variabile', 'Primavera', 'Post-fiera', 'Post-audit interno', 'Lunedì mattina', 'Venerdì pomeriggio', 'Novembre-Marzo', 'Marzo-Aprile'].includes(w.mese);
            const matchSettore = w.settori_target.includes(project.settore) || w.settori_target.includes('generico');
            return matchMonth && matchSettore;
        });
    };

    const openActionModal = (w: CommercialWindow, action: 'funnel' | 'email' | 'template' | 'dashboard') => {
        setSelectedWindow(w);
        setActionType(action);
        setShowActionModal(true);
    };

    const handleAction = () => {
        if (!selectedWindow) return;
        const actionLabels = { funnel: 'Funnel upselling creato', email: 'Email programmata', template: 'Aggiunto al template documenti', dashboard: 'Visibile nella dashboard cliente' };
        alert(`✅ ${actionLabels[actionType]} per: ${selectedWindow.serviceName}`);
        setShowActionModal(false);
        setSelectedWindow(null);
    };

    const exportForCarbone = () => {
        const payload = {
            documento: "Business Plan Startup / PMI Innovativa",
            metadata: { azienda: project.cliente, settore: project.settore, livello: "L2", data: new Date().toISOString().split('T')[0], custode_metodo: "Denis D'Este" },
            executive_summary: { problema: project.sei_aree.find((a: AreaStatus) => a.stato === 'ROSSO')?.gap || "Nessun problema critico", soluzione: "Strutturazione tramite Metodo V6", trazione: "MVP funzionante", funding_ask: "Da definire" },
            diagnostica_v6: { kairos_score: project.kairos.score, kairos_livello: project.kairos.livello, quadrante_fp: project.kairos.quadrante },
            sei_aree_val: Object.fromEntries(project.sei_aree.map((a: AreaStatus) => [a.nome.split(' ')[0].toLowerCase(), a.stato])),
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `carbone-payload-${project.id}.json`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const startAICall = async () => {
        setIsStartingCall(true);

        try {
            // ✅ FIX: Pianifica nel calendario SENZA creare la room
            const now = new Date();
            const date = now.toISOString().split('T')[0];
            const time = now.toTimeString().split(' ')[0].substring(0, 5);
            await scheduleCallInCalendar(date, time);

            // ✅ FIX: Apri direttamente CallRoom (sarà lui a creare la room)
            setShowCallRoom(true);

        } catch (error) {
            console.error('Errore avvio call:', error);
            alert('Errore di connessione');
        } finally {
            setIsStartingCall(false);
        }
    };
    const scheduleCallInCalendar = async (date: string, time: string) => {
        try {
            const response = await fetch('/api/call/schedule', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: project.id,
                    projectName: project.nome,
                    clientName: project.cliente,
                    consultantId: user?.clientId || 'PART-004',
                    consultantName: user?.name || 'Christian Rossi',
                    date,
                    time,
                    duration: 60
                })
            });

            const data = await response.json();

            if (data.success) {
                console.log('✅ Call AI aggiunta al calendario');
            }
        } catch (error) {
            console.error('Errore pianificazione calendario:', error);
        }
    };

    const handleCallEnd = (analysis: any) => {
        setCallRoom(null);
        setShowCallRoom(false);

        if (analysis) {
            setProject(prev => ({
                ...prev,
                kairos: {
                    score: analysis.kairos_update.score,
                    livello: analysis.kairos_update.score >= 13 ? 'ALTO' : analysis.kairos_update.score >= 9 ? 'MEDIO' : 'BASSO',
                    quadrante: analysis.kairos_update.quadrante,
                },
                heinrich: {
                    verde: analysis.heinrich_signals?.verdi?.length || 0,
                    giallo: analysis.heinrich_signals?.gialle?.length || 0,
                    rosso: analysis.heinrich_signals?.rosse?.length || 0,
                },
            }));
            alert('✅ Call terminata. Dashboard aggiornata con analisi AI.');
        }
    };

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
            <Loader2 size={40} className="animate-spin text-orange-500" />
        </div>
    );

    return (
        <div className="min-h-screen bg-[#f8fafc]">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="mb-6">
                    <Link href="/consultant/dashboard" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 mb-2">
                        <ArrowLeft size={16} /> Torna alla dashboard
                    </Link>
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <div>
                            <div className="flex items-center gap-3 mb-1">
                                <h1 className="text-3xl font-bold text-[#1a2744]">{project.nome}</h1>
                                <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">{project.fase}</span>
                            </div>
                            <p className="text-gray-500">{project.cliente} • {project.id} • Settore: <strong>{project.settore}</strong></p>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                            <button
                                onClick={startAICall}
                                disabled={isStartingCall}
                                className="px-4 py-2 rounded-lg bg-gradient-to-r from-red-600 to-red-700 text-white font-medium hover:from-red-700 hover:to-red-800 flex items-center gap-2 shadow-sm disabled:opacity-50"
                            >
                                {isStartingCall ? <Loader2 size={16} className="animate-spin" /> : <Video size={16} />}
                                🎙️ Call AI
                            </button>
                            <button onClick={exportForCarbone} className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-purple-700 text-white font-medium hover:from-purple-700 hover:to-purple-800 flex items-center gap-2 shadow-sm">
                                <Download size={16} /> 📥 Carbone.io
                            </button>
                            <button onClick={() => setActiveSection('avanzamento')} className={`px-4 py-2 rounded-lg text-sm font-medium ${activeSection === 'avanzamento' ? 'bg-[#1a2744] text-white' : 'border border-gray-200 hover:bg-gray-50'}`}>📊</button>
                            <button onClick={() => setActiveSection('calendario')} className={`px-4 py-2 rounded-lg text-sm font-medium ${activeSection === 'calendario' ? 'bg-[#1a2744] text-white' : 'border border-gray-200 hover:bg-gray-50'}`}>📅</button>
                            <button onClick={() => setActiveSection('interazioni')} className={`px-4 py-2 rounded-lg text-sm font-medium ${activeSection === 'interazioni' ? 'bg-[#1a2744] text-white' : 'border border-gray-200 hover:bg-gray-50'}`}>🧠</button>
                        </div>
                    </div>
                </div>

                {/* ============ SEZIONE: AVANZAMENTO ============ */}
                {activeSection === 'avanzamento' && (
                    <div className="space-y-6">
                        <div className={`bg-gradient-to-r ${getKairosColor(project.kairos.quadrante)} rounded-2xl p-6 text-white`}>
                            <div className="flex items-center justify-between flex-wrap gap-6">
                                <div>
                                    <div className="text-sm opacity-80 mb-1">Matrice di Kairós</div>
                                    <div className="text-4xl font-bold">{project.kairos.score}/15</div>
                                    <div className="text-lg mt-1 font-medium">{project.kairos.quadrante.replace('_', ' ')}</div>
                                </div>
                                <div className="flex gap-4">
                                    {['VERDE', 'GIALLO', 'ROSSO'].map(stato => (
                                        <div key={stato} className="text-center">
                                            <div className="text-3xl font-bold">{project.sei_aree.filter((a: AreaStatus) => a.stato === stato).length}</div>
                                            <div className="text-xs opacity-80">{stato}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {project.sei_aree.map((area: AreaStatus, i: number) => (
                                <div key={i} className={`p-5 rounded-xl border-2 ${getAreaColor(area.stato)} transition-all hover:shadow-md`}>
                                    <div className="flex items-center justify-between mb-2">
                                        <h3 className="font-bold text-sm flex items-center gap-2">{getAreaIcon(area.stato)} {area.nome}</h3>
                                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white/60">{area.stato}</span>
                                    </div>
                                    <p className="text-xs leading-relaxed opacity-80">{area.gap}</p>
                                </div>
                            ))}
                        </div>
                        <div className="grid md:grid-cols-2 gap-6">
                            <div className="bg-white rounded-2xl border border-gray-100 p-6">
                                <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><AlertTriangle size={20} className="text-red-500" /> Triangolo di Heinrich</h3>
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                                        <span className="text-sm font-medium text-red-700">🔴 Rosse</span>
                                        <span className="text-2xl font-bold text-red-600">{project.heinrich.rosso}</span>
                                    </div>
                                    <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                                        <span className="text-sm font-medium text-yellow-700">🟡 Gialle</span>
                                        <span className="text-2xl font-bold text-yellow-600">{project.heinrich.giallo}</span>
                                    </div>
                                    <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                                        <span className="text-sm font-medium text-green-700">🟢 Near Miss</span>
                                        <span className="text-2xl font-bold text-green-600">{project.heinrich.verde}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-white rounded-2xl border border-gray-100 p-6">
                                <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><CheckCircle2 size={20} className="text-green-500" /> Deliverable</h3>
                                <div className="space-y-2">
                                    {project.deliverable.map((d: Deliverable, i: number) => (
                                        <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs ${d.stato === 'approvato' ? 'bg-green-500' : d.stato === 'consegnato' ? 'bg-blue-500' : d.stato === 'in_corso' ? 'bg-orange-500' : 'bg-gray-300'}`}>
                                                    {d.stato === 'approvato' ? '✓' : d.stato === 'in_corso' ? '◐' : i + 1}
                                                </div>
                                                <div>
                                                    <div className="text-sm font-medium text-[#1a2744]">{d.nome}</div>
                                                    <div className="text-xs text-gray-500">{new Date(d.scadenza).toLocaleDateString('it-IT')}</div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ============ SEZIONE: CALENDARIO ============ */}
                {activeSection === 'calendario' && (
                    <div className="space-y-6">
                        <div className="bg-white rounded-2xl border border-gray-100 p-6">
                            <div className="flex items-center justify-between flex-wrap gap-4">
                                <div className="flex items-center gap-4">
                                    <button onClick={() => navigateMonth(-1)} className="p-2 rounded-lg hover:bg-gray-100 transition-colors"><ChevronLeft size={20} /></button>
                                    <h2 className="text-2xl font-bold text-[#1a2744] min-w-[200px] text-center">{MONTHS[currentMonth]} {currentYear}</h2>
                                    <button onClick={() => navigateMonth(1)} className="p-2 rounded-lg hover:bg-gray-100 transition-colors"><ChevronRight size={20} /></button>
                                </div>
                                <button onClick={() => { setSelectedDay(new Date().getDate()); setShowAppointmentModal(true); }} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700">
                                    <Plus size={16} /> Nuovo Appuntamento
                                </button>
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl border border-gray-100 p-6">
                            <div className="grid grid-cols-7 gap-2 mb-2">
                                {DAYS.map(day => (<div key={day} className="text-center text-sm font-bold text-gray-500 py-2">{day}</div>))}
                            </div>
                            <div className="grid grid-cols-7 gap-2">
                                {Array.from({ length: getFirstDayOfMonth(currentMonth, currentYear) }).map((_, i) => (
                                    <div key={`empty-${i}`} className="h-24 bg-gray-50 rounded-lg"></div>
                                ))}
                                {Array.from({ length: getDaysInMonth(currentMonth, currentYear) }).map((_, i) => {
                                    const day = i + 1;
                                    const dayString = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                    const dayAppointments = appointments.filter((a: any) => a.date.split('T')[0] === dayString);
                                    const isToday = day === new Date().getDate() && currentMonth === new Date().getMonth() && currentYear === new Date().getFullYear();

                                    return (
                                        <button key={day} onClick={() => { setSelectedDay(day); setShowAppointmentModal(true); }} className={`h-24 p-2 rounded-lg border-2 transition-all hover:border-blue-300 text-left ${isToday ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                                            <div className={`text-sm font-bold mb-1 ${isToday ? 'text-orange-600' : 'text-gray-700'}`}>{day}</div>
                                            <div className="space-y-1">
                                                {dayAppointments.slice(0, 2).map((appt: any, idx: number) => (
                                                    <div key={appt.id || idx} className="text-xs px-2 py-1 rounded text-white truncate bg-blue-500" title={appt.title}>
                                                        {appt.time} {appt.title}
                                                    </div>
                                                ))}
                                                {dayAppointments.length > 2 && (<div className="text-xs text-gray-500 font-medium">+{dayAppointments.length - 2} altri</div>)}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {appointments.filter((a: any) => a.date.split('T')[0].startsWith(`${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`)).length > 0 && (
                            <div className="bg-white rounded-2xl border border-gray-100 p-6">
                                <h3 className="text-xl font-bold text-[#1a2744] mb-4">📅 Appuntamenti del mese</h3>
                                <div className="space-y-3">
                                    {appointments.filter((a: any) => a.date.split('T')[0].startsWith(`${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`)).map((a: any) => (
                                        <div key={a.id} className="flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-xl">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-lg bg-blue-600 text-white flex items-center justify-center text-xs font-bold">{a.date.split('T')[0].split('-')[2]}</div>
                                                <div>
                                                    <div className="font-bold text-sm text-[#1a2744]">{a.title}</div>
                                                    <div className="text-xs text-gray-600">{a.type} • {a.time}</div>
                                                    {a.notes && <div className="text-xs text-gray-500 mt-0.5">{a.notes}</div>}
                                                </div>
                                            </div>
                                            <button onClick={async () => {
                                                if (confirm('Cancellare questo appuntamento?')) {
                                                    await fetch(`/api/appointments?id=${a.id}`, { method: 'DELETE' });
                                                    setAppointments((prev: any[]) => prev.filter((x: any) => x.id !== a.id));
                                                }
                                            }} className="text-xs text-red-500 hover:text-red-700 font-medium">Cancella</button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ============ SEZIONE: INTERAZIONI ============ */}
                {activeSection === 'interazioni' && (
                    <div className="space-y-6">
                        <div className="bg-white rounded-2xl border border-gray-100 p-6">
                            <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Brain size={20} className="text-purple-500" /> Storico Interazioni</h3>
                            <div className="space-y-4">
                                {project.ultime_interazioni.map((int: Interazione, i: number) => (
                                    <div key={i} className="p-5 bg-gray-50 rounded-xl border border-gray-200">
                                        <div className="flex items-center gap-3 mb-3">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold ${int.tipo === 'call' ? 'bg-blue-500' : 'bg-gray-500'}`}>
                                                {int.tipo === 'call' ? '📞' : '✉️'}
                                            </div>
                                            <div>
                                                <div className="font-bold text-[#1a2744]">{int.tipo.toUpperCase()}</div>
                                                <div className="text-xs text-gray-500">{new Date(int.data).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap gap-2 mb-3">
                                            {int.pattern.map((p: string, j: number) => (
                                                <span key={j} className="px-3 py-1 rounded-full bg-purple-100 text-purple-700 text-xs font-mono font-bold">{p}</span>
                                            ))}
                                        </div>
                                        <p className="text-sm text-gray-700">{int.note}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border-2 border-indigo-200 rounded-2xl p-6">
                            <h3 className="font-bold text-lg mb-3">🧠 Sintesi Psicologica del Founder</h3>
                            <div className="grid md:grid-cols-2 gap-4 text-sm">
                                <div><div className="font-bold text-indigo-800 mb-1">Profilo DISC Stimato</div><p className="text-gray-700"><strong>D (Dominante)</strong> operativo, <strong>C (Coscienzioso)</strong> su budget.</p></div>
                                <div><div className="font-bold text-indigo-800 mb-1">Segnale Dominante</div><p className="text-gray-700"><strong>PL-02 + PL-12:</strong> Decisione mentalmente presa.</p></div>
                                <div><div className="font-bold text-indigo-800 mb-1">Obiezione Attiva</div><p className="text-gray-700"><strong>PL-05:</strong> Burn rate come preoccupazione reale.</p></div>
                                <div><div className="font-bold text-indigo-800 mb-1">Azione Suggerita</div><p className="text-gray-700">Inviare Financial Model con scenario worst-case.</p></div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* ============ MODAL: APPOINTMENT ============ */}
            {showAppointmentModal && selectedDay && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-2xl font-bold text-[#1a2744]">📅 Nuovo Appuntamento</h3>
                            <button onClick={() => {
                                setShowAppointmentModal(false);
                                setGeneratedMeetingLink(null);
                            }} className="p-2 hover:bg-gray-100 rounded-lg">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Info Data */}
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
                            <p className="text-sm text-blue-900">
                                <strong>📆 {selectedDay} {MONTHS[currentMonth]} {currentYear}</strong> • Progetto: {project.nome}
                            </p>
                        </div>

                        {/* PARTECIPANTI */}
                        <div className="mb-6">
                            <div className="flex items-center justify-between mb-3">
                                <label className="block text-sm font-bold text-gray-700">
                                    Partecipanti <span className="text-red-500">*</span>
                                </label>
                                <button
                                    onClick={() => setShowParticipantSelector(!showParticipantSelector)}
                                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                                >
                                    {showParticipantSelector ? 'Nascondi' : '+ Aggiungi'}
                                </button>
                            </div>

                            {/* Lista Partecipanti */}
                            {appointmentForm.participants.length === 0 ? (
                                <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl text-center">
                                    <p className="text-sm text-gray-500">Nessun partecipante aggiunto</p>
                                    <button
                                        onClick={() => {
                                            // Auto-compila con cliente del progetto
                                            setAppointmentForm({
                                                ...appointmentForm,
                                                participants: [{
                                                    name: project.cliente,
                                                    email: '', // Da recuperare dai dati progetto
                                                    source: 'project'
                                                }]
                                            });
                                        }}
                                        className="mt-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
                                    >
                                        Usa cliente del progetto
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {appointmentForm.participants.map((p, idx) => (
                                        <div key={idx} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                                            <div className="flex-1">
                                                <div className="text-sm font-medium text-[#1a2744]">{p.name}</div>
                                                <div className="text-xs text-gray-500">{p.email || 'Email non specificata'}</div>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    const updated = appointmentForm.participants.filter((_, i) => i !== idx);
                                                    setAppointmentForm({ ...appointmentForm, participants: updated });
                                                }}
                                                className="p-1.5 hover:bg-red-50 rounded-lg text-red-500"
                                            >
                                                <X size={16} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Selector Partecipanti */}
                            {showParticipantSelector && (
                                <div className="mt-4 p-4 bg-white border border-gray-200 rounded-xl space-y-4">
                                    {/* Opzione 1: Cliente del progetto */}
                                    <button
                                        onClick={() => {
                                            setAppointmentForm({
                                                ...appointmentForm,
                                                participants: [...appointmentForm.participants, {
                                                    name: project.cliente,
                                                    email: '',
                                                    source: 'project'
                                                }]
                                            });
                                            setShowParticipantSelector(false);
                                        }}
                                        className="w-full p-3 rounded-xl border-2 border-gray-200 hover:border-blue-300 text-left transition-all"
                                    >
                                        <div className="font-bold text-[#1a2744] text-sm">👤 Cliente del Progetto</div>
                                        <div className="text-xs text-gray-500 mt-1">{project.cliente}</div>
                                    </button>

                                    {/* Opzione 2: Seleziona da Lead */}
                                    {availableLeads.length > 0 && (
                                        <div>
                                            <div className="text-xs font-bold text-gray-500 uppercase mb-2">Oppure seleziona da Lead esistenti</div>
                                            <div className="space-y-2 max-h-40 overflow-y-auto">
                                                {availableLeads.map((lead) => (
                                                    <button
                                                        key={lead.id}
                                                        onClick={() => {
                                                            setAppointmentForm({
                                                                ...appointmentForm,
                                                                participants: [...appointmentForm.participants, {
                                                                    name: lead.data.nomeContatto || lead.data.azienda,
                                                                    email: lead.data.email || '',
                                                                    source: 'lead'
                                                                }]
                                                            });
                                                            setShowParticipantSelector(false);
                                                        }}
                                                        className="w-full p-3 rounded-xl border border-gray-200 hover:border-blue-300 text-left transition-all"
                                                    >
                                                        <div className="font-medium text-[#1a2744] text-sm">{lead.data.nomeContatto || lead.data.azienda}</div>
                                                        <div className="text-xs text-gray-500">{lead.data.email}</div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Opzione 3: Inserimento manuale */}
                                    <div>
                                        <div className="text-xs font-bold text-gray-500 uppercase mb-2">Oppure inserisci manualmente</div>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                placeholder="Nome"
                                                id="manual-name"
                                                className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm"
                                            />
                                            <input
                                                type="email"
                                                placeholder="Email"
                                                id="manual-email"
                                                className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm"
                                            />
                                            <button
                                                onClick={() => {
                                                    const name = (document.getElementById('manual-name') as HTMLInputElement).value;
                                                    const email = (document.getElementById('manual-email') as HTMLInputElement).value;
                                                    if (name && email) {
                                                        setAppointmentForm({
                                                            ...appointmentForm,
                                                            participants: [...appointmentForm.participants, { name, email, source: 'manual' }]
                                                        });
                                                        setShowParticipantSelector(false);
                                                    }
                                                }}
                                                className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
                                            >
                                                Aggiungi
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Dettagli Appuntamento */}
                        <div className="space-y-4 mb-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                                <select
                                    value={appointmentForm.type}
                                    onChange={(e) => setAppointmentForm({ ...appointmentForm, type: e.target.value })}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                                >
                                    <option>Call Discovery (30 min, gratuita)</option>
                                    <option>Review Progetto (60 min, inclusa)</option>
                                    <option>Consulenza Extra (60 min, €150)</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Oggetto</label>
                                <input
                                    type="text"
                                    value={appointmentForm.title}
                                    onChange={(e) => setAppointmentForm({ ...appointmentForm, title: e.target.value })}
                                    placeholder="Es: Review avanzamento SAL 2"
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Ora</label>
                                <input
                                    type="time"
                                    value={appointmentForm.time}
                                    onChange={(e) => setAppointmentForm({ ...appointmentForm, time: e.target.value })}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
                                <textarea
                                    rows={2}
                                    value={appointmentForm.notes}
                                    onChange={(e) => setAppointmentForm({ ...appointmentForm, notes: e.target.value })}
                                    placeholder="Argomenti da trattare..."
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm resize-none"
                                />
                            </div>
                        </div>

                        {/* Link Generato */}
                        {generatedMeetingLink && (
                            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-bold text-green-900">✅ Link Video Call Generato</span>
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(generatedMeetingLink);
                                            alert('Link copiato!');
                                        }}
                                        className="text-xs text-green-700 hover:text-green-800 font-medium"
                                    >
                                        📋 Copia
                                    </button>
                                </div>
                                <div className="text-xs text-green-800 font-mono break-all">{generatedMeetingLink}</div>
                                <p className="text-xs text-green-700 mt-2">
                                    Invia questo link ai partecipanti via email o WhatsApp
                                </p>
                            </div>
                        )}

                        {/* Azioni */}
                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setShowAppointmentModal(false);
                                    setGeneratedMeetingLink(null);
                                }}
                                className="flex-1 px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 font-medium"
                            >
                                Annulla
                            </button>
                            <button
                                onClick={async () => {
                                    // Validazione
                                    if (appointmentForm.participants.length === 0) {
                                        alert('⚠️ Aggiungi almeno un partecipante');
                                        return;
                                    }
                                    if (!appointmentForm.title.trim()) {
                                        alert('⚠️ Inserisci un oggetto');
                                        return;
                                    }

                                    // Conferma
                                    if (!confirm(`Creare appuntamento per ${appointmentForm.participants.length} partecipante/i?`)) {
                                        return;
                                    }

                                    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;

                                    try {
                                        // 1. Crea appuntamento
                                        const res = await fetch('/api/appointments', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({
                                                projectId: project.id,
                                                projectName: project.nome,
                                                clientName: project.cliente,
                                                date: dateStr,
                                                time: appointmentForm.time,
                                                type: appointmentForm.type,
                                                title: appointmentForm.title,
                                                notes: appointmentForm.notes,
                                                participants: appointmentForm.participants
                                            })
                                        });

                                        if (!res.ok) throw new Error('Errore creazione appuntamento');

                                        const data = await res.json();
                                        const appointment = data.appointment;

                                        // 2. Genera link Daily.co
                                        const roomRes = await fetch('/api/call/room', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({
                                                projectId: project.id,
                                                consultantId: user?.clientId || 'PART-004',
                                                duration: appointmentForm.type.includes('30') ? 30 : 60,
                                            })
                                        });

                                        if (roomRes.ok) {
                                            const roomData = await roomRes.json();
                                            if (roomData.success) {
                                                setGeneratedMeetingLink(roomData.room.url);

                                                // Aggiorna appuntamento con link
                                                await fetch('/api/appointments', {
                                                    method: 'PUT',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({
                                                        id: appointment.id,
                                                        meetingLink: roomData.room.url,
                                                    })
                                                });
                                            }
                                        }

                                        // 3. Aggiorna lista
                                        setAppointments(prev => [...prev, appointment]);

                                        // 4. Reset form (ma mantieni link visibile)
                                        setAppointmentForm({
                                            type: 'Call Discovery (30 min, gratuita)',
                                            title: '',
                                            time: '10:00',
                                            notes: '',
                                            participants: []
                                        });

                                        alert('✅ Appuntamento creato! Link generato.');

                                    } catch (err) {
                                        alert('❌ Errore: ' + (err as Error).message);
                                    }
                                }}
                                className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700"
                            >
                                {generatedMeetingLink ? 'Chiudi' : 'Conferma'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ============ MODAL: AZIONI FINESTRA ============ */}
            {showActionModal && selectedWindow && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowActionModal(false)}>
                    <div className="bg-white rounded-2xl p-6 max-w-lg w-full" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-bold flex items-center gap-2">
                                {actionType === 'funnel' && <TrendingUp size={24} className="text-orange-600" />}
                                {actionType === 'email' && <Mail size={24} className="text-blue-600" />}
                                {actionType === 'template' && <FileText size={24} className="text-purple-600" />}
                                {actionType === 'dashboard' && <LayoutDashboard size={24} className="text-green-600" />}
                                {actionType === 'funnel' && 'Crea Funnel Upselling'}
                                {actionType === 'email' && 'Programma Email'}
                                {actionType === 'template' && 'Aggiungi a Template Documenti'}
                                {actionType === 'dashboard' && 'Mostra in Dashboard Cliente'}
                            </h3>
                            <button onClick={() => setShowActionModal(false)} className="p-1 hover:bg-gray-100 rounded"><X size={20} /></button>
                        </div>
                        <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 mb-4">
                            <p className="text-sm text-gray-900 font-bold">{selectedWindow.serviceName}</p>
                            <p className="text-xs text-gray-600 mt-1">{selectedWindow.opportunita}</p>
                        </div>
                        <div className="space-y-3">
                            {actionType === 'funnel' && (
                                <>
                                    <div><label className="block text-xs font-medium text-gray-700 mb-1">Nome Funnel</label><input type="text" defaultValue={`Upselling ${selectedWindow.serviceName}`} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" /></div>
                                    <div><label className="block text-xs font-medium text-gray-700 mb-1">Step Iniziale</label><select className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"><option>Email di apertura</option><option>Call discovery</option><option>Invio proposta</option></select></div>
                                    <div><label className="block text-xs font-medium text-gray-700 mb-1">Obiettivo</label><textarea rows={2} placeholder="Es: Proporre audit HACCP come primo step" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm resize-none" /></div>
                                </>
                            )}
                            {actionType === 'email' && (
                                <>
                                    <div><label className="block text-xs font-medium text-gray-700 mb-1">Data Invio</label><input type="date" defaultValue={new Date().toISOString().split('T')[0]} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" /></div>
                                    <div><label className="block text-xs font-medium text-gray-700 mb-1">Oggetto Email</label><input type="text" defaultValue={`Opportunità: ${selectedWindow.serviceName}`} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" /></div>
                                    <div><label className="block text-xs font-medium text-gray-700 mb-1">Contenuto</label><textarea rows={4} placeholder="Scrivi il contenuto dell'email..." className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm resize-none" /></div>
                                </>
                            )}
                            {actionType === 'template' && (
                                <>
                                    <div><label className="block text-xs font-medium text-gray-700 mb-1">Seleziona Template</label><select className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"><option>Business Plan L2</option><option>Dossier Analisi 3 Pilastri</option><option>Piano ISMEA</option><option>Executive Summary</option></select></div>
                                    <div><label className="block text-xs font-medium text-gray-700 mb-1">Sezione del Template</label><input type="text" placeholder="Es: Sezione Opportunità di Mercato" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" /></div>
                                    <div><label className="block text-xs font-medium text-gray-700 mb-1">Note per il Template</label><textarea rows={3} placeholder="Aggiungi note su come integrare questa finestra..." className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm resize-none" /></div>
                                </>
                            )}
                            {actionType === 'dashboard' && (
                                <>
                                    <div className="bg-green-50 border border-green-200 rounded-xl p-3"><p className="text-sm text-green-900">✅ Questa finestra sarà visibile nella dashboard del cliente <strong>{project.cliente}</strong></p></div>
                                    <div><label className="block text-xs font-medium text-gray-700 mb-1">Messaggio per il Cliente</label><textarea rows={3} placeholder="Es: Abbiamo identificato un'opportunità per te:..." className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm resize-none" /></div>
                                    <div><label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" defaultChecked className="rounded" />Invia notifica email al cliente</label></div>
                                </>
                            )}
                        </div>
                        <div className="flex gap-3 mt-4">
                            <button onClick={() => setShowActionModal(false)} className="flex-1 px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 font-medium">Annulla</button>
                            <button onClick={handleAction} className="flex-1 px-4 py-2 rounded-lg bg-[#1a2744] text-white font-medium hover:bg-[#0f3460]">Conferma</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ============ CALL ROOM (FUORI DA TUTTE LE MODALI, A LIVELLO ROOT) ============ */}
            {showCallRoom && (
                <CallRoom
                    projectId={project.id}
                    projectName={project.nome}
                    clientName={project.cliente}
                    settore={project.settore}
                    livello={project.livello || 'L2'}
                    brand="progetto-impresa"
                    onClose={() => {
                        setShowCallRoom(false);
                        setCallRoom(null);
                    }}
                    onStartPresentation={() => {
                        alert('🚀 Modalità Presentazione: in arrivo nel prossimo sprint!');
                    }}
                />
            )}
        </div>
    );
}
