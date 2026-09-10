"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    Loader2, ArrowLeft, Search, Filter, Eye, MoreVertical,
    TrendingUp, AlertTriangle, Clock3
} from "lucide-react";

interface Project {
    id: number;
    leadId: number | null;
    nome: string;
    cliente: string;
    stato: string;
    consulente: string;
    consulenteId: number | null;
    dataInizio: string | null;
    ultimoAggiornamento: string | null;
    priorita: string;
    kairos: { score: number; quadrante: string } | null;
}

const STALE_DAYS = 14;

// 10/09/2026 (Denis: "voglio vedere se può esserci una sistemazione lean
// e kaizen migliore"): le due card "Con valutazione Kairós"/"Fasi
// distinte" erano vanity metric (nessuna decisione dipende da quei
// numeri) - sostituite con "Bloccati" (nessun aggiornamento da
// STALE_DAYS) e "Urgenti" (priority >= '2', vedi sotto), entrambe
// azionabili: dicono a chi guarda la pagina DOVE guardare per primo,
// stesso principio Pareto del resto del sistema. priority è il campo
// NATIVO crm.lead ("un'azione che colora il lead di giallo o arancio"),
// mai usato prima in questo progetto - riusato, non inventato.
const PRIORITY_STYLE: Record<string, { rowBg: string; label: string; dot: string }> = {
    '1': { rowBg: 'bg-yellow-50/60', label: 'Da monitorare', dot: 'bg-yellow-400' },
    '2': { rowBg: 'bg-orange-50/70', label: 'Urgente', dot: 'bg-orange-500' },
    '3': { rowBg: 'bg-orange-50/70', label: 'Urgente', dot: 'bg-orange-500' },
};

export default function AdminProjectsPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [projects, setProjects] = useState<Project[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [filterConsultant, setFilterConsultant] = useState("");
    const [filterStatus, setFilterStatus] = useState("");
    const [openMenuId, setOpenMenuId] = useState<number | null>(null);
    const [updatingId, setUpdatingId] = useState<number | null>(null);

    useEffect(() => {
        const session = localStorage.getItem("pi_session");
        if (!session) {
            router.push("/login");
            return;
        }
        loadProjects();
    }, [router]);

    const loadProjects = async () => {
        try {
            const res = await fetch('/api/admin/projects');
            const data = await res.json();
            if (!res.ok || !data.success) {
                setLoadError(data.error || 'Odoo non raggiungibile');
                return;
            }
            setProjects(data.projects || []);
        } catch (error: any) {
            console.error('Errore caricamento progetti:', error);
            setLoadError(error.message || 'Errore di rete');
        } finally {
            setLoading(false);
        }
    };

    const handleSetPriority = async (project: Project, priority: string) => {
        if (!project.leadId) return;
        setUpdatingId(project.id);
        setOpenMenuId(null);
        try {
            const res = await fetch(`/api/admin/leads/${project.leadId}/priority`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ priority }),
            });
            const data = await res.json();
            if (data.success) {
                setProjects((prev) => prev.map((p) => p.id === project.id ? { ...p, priorita: priority } : p));
            }
        } finally {
            setUpdatingId(null);
        }
    };

    const isStale = (p: Project) => {
        if (!p.ultimoAggiornamento) return false;
        const days = (Date.now() - new Date(p.ultimoAggiornamento).getTime()) / (1000 * 60 * 60 * 24);
        return days > STALE_DAYS;
    };
    const isUrgent = (p: Project) => p.priorita === '2' || p.priorita === '3';

    // Consulenti per il filtro: derivati dai progetti reali appena caricati
    // (non da /api/admin/partners, che oggi passa dal gateway mock -
    // avrebbe ID diversi da quelli reali e il filtro non avrebbe mai
    // trovato corrispondenze).
    const consultants = Array.from(
        new Map(
            projects
                .filter((p): p is Project & { consulenteId: number } => p.consulenteId != null)
                .map(p => [p.consulenteId, { id: p.consulenteId, name: p.consulente }])
        ).values()
    );

    const filteredProjects = projects.filter(p => {
        const matchSearch = p.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.cliente.toLowerCase().includes(searchTerm.toLowerCase()) ||
            String(p.id).includes(searchTerm);
        const matchConsultant = !filterConsultant || String(p.consulenteId) === filterConsultant;
        const matchStatus = !filterStatus || p.stato === filterStatus;
        return matchSearch && matchConsultant && matchStatus;
    });

    const statuses = Array.from(new Set(projects.map(p => p.stato)));
    const staleCount = projects.filter(isStale).length;
    const urgentCount = projects.filter(isUrgent).length;

    const getKairosColor = (quadrante?: string) => {
        if (!quadrante) return 'bg-gray-100';
        switch (quadrante) {
            case 'KAIROS_AUTENTICO': return 'bg-green-100 text-green-700';
            case 'QUICK_WIN': return 'bg-blue-100 text-blue-700';
            case 'PREPARA': return 'bg-orange-100 text-orange-700';
            case 'PARCHEGGIO': return 'bg-gray-100 text-gray-700';
            default: return 'bg-gray-100';
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
                <Loader2 size={40} className="animate-spin text-orange-500" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f8fafc]" onClick={() => setOpenMenuId(null)}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <Link href="/admin/dashboard" className="p-2 rounded-lg hover:bg-gray-200 transition-colors">
                            <ArrowLeft size={20} className="text-gray-600" />
                        </Link>
                        <div>
                            <h1 className="text-3xl font-bold text-[#1a2744]">Gestione Progetti</h1>
                            <p className="text-gray-500">Panoramica e controllo di tutti i progetti attivi</p>
                        </div>
                    </div>
                </div>

                {loadError && (
                    <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                        Dati non aggiornati: {loadError}
                    </div>
                )}

                {/* Stats Cards */}
                <div className="grid md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-white rounded-2xl border border-gray-100 p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                                <TrendingUp size={24} className="text-blue-600" />
                            </div>
                        </div>
                        <div className="text-3xl font-bold text-[#1a2744] mb-1">{projects.length}</div>
                        <div className="text-sm text-gray-500">Progetti Totali</div>
                    </div>
                    <div className={`rounded-2xl border p-6 ${staleCount > 0 ? 'bg-gray-50 border-gray-300' : 'bg-white border-gray-100'}`}>
                        <div className="flex items-center justify-between mb-4">
                            <div className="w-12 h-12 rounded-xl bg-gray-200 flex items-center justify-center">
                                <Clock3 size={24} className="text-gray-600" />
                            </div>
                        </div>
                        <div className="text-3xl font-bold text-[#1a2744] mb-1">{staleCount}</div>
                        <div className="text-sm text-gray-500">Bloccati (&gt;{STALE_DAYS}gg senza aggiornamenti)</div>
                    </div>
                    <div className={`rounded-2xl border p-6 ${urgentCount > 0 ? 'bg-orange-50 border-orange-200' : 'bg-white border-gray-100'}`}>
                        <div className="flex items-center justify-between mb-4">
                            <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center">
                                <AlertTriangle size={24} className="text-orange-600" />
                            </div>
                        </div>
                        <div className="text-3xl font-bold text-[#1a2744] mb-1">{urgentCount}</div>
                        <div className="text-sm text-gray-500">Segnati urgenti</div>
                    </div>
                </div>

                {/* Filters */}
                <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
                    <h3 className="text-lg font-bold text-[#1a2744] mb-4 flex items-center gap-2">
                        <Filter size={20} className="text-orange-500" />
                        Filtri
                    </h3>
                    <div className="grid md:grid-cols-4 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Cerca</label>
                            <div className="relative">
                                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Nome, cliente o ID..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Consulente</label>
                            <select
                                value={filterConsultant}
                                onChange={(e) => setFilterConsultant(e.target.value)}
                                className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 bg-white"
                            >
                                <option value="">Tutti i consulenti</option>
                                {consultants.map((c) => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Fase</label>
                            <select
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value)}
                                className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 bg-white"
                            >
                                <option value="">Tutte le fasi</option>
                                {statuses.map((s) => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {/* Table */}
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">ID Progetto</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Nome / Cliente</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Consulente</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Kairós</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Stato</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Ultimo Aggiornamento</th>
                                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Azioni</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {filteredProjects.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                                            Nessun progetto trovato
                                        </td>
                                    </tr>
                                ) : (
                                    filteredProjects.map((project) => {
                                        const priorityStyle = PRIORITY_STYLE[project.priorita];
                                        const stale = isStale(project);
                                        return (
                                            <tr key={project.id} className={`hover:brightness-95 transition-all ${priorityStyle?.rowBg || ''}`}>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-mono font-medium text-gray-900">
                                                    <div className="flex items-center gap-2">
                                                        {priorityStyle && <span className={`w-2 h-2 rounded-full ${priorityStyle.dot}`} title={priorityStyle.label} />}
                                                        #{project.id}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="text-sm font-semibold text-[#1a2744]">{project.nome}</div>
                                                    <div className="text-xs text-gray-500">{project.cliente}</div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold">
                                                            {project.consulente?.charAt(0) || '?'}
                                                        </div>
                                                        <span className="text-sm text-gray-700">{project.consulente}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    {project.kairos ? (
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-sm font-bold text-gray-700">{project.kairos.score}/15</span>
                                                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getKairosColor(project.kairos.quadrante)}`}>
                                                                {project.kairos.quadrante.replace('_', ' ')}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-gray-400">N/A</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-700 text-xs font-bold">
                                                        {project.stato}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                    <span className={stale ? 'text-gray-500 font-semibold' : 'text-gray-500'}>
                                                        {project.ultimoAggiornamento ? new Date(project.ultimoAggiornamento).toLocaleDateString('it-IT') : '—'}
                                                    </span>
                                                    {stale && <span className="ml-1.5 text-xs text-gray-400">(fermo)</span>}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right">
                                                    <div className="flex items-center justify-end gap-2 relative">
                                                        <Link
                                                            href={`/admin/projects/${project.id}`}
                                                            className="p-2 rounded-lg hover:bg-blue-50 text-blue-600"
                                                            title="Supervisione Progetto"
                                                        >
                                                            <Eye size={18} />
                                                        </Link>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === project.id ? null : project.id); }}
                                                            disabled={updatingId === project.id}
                                                            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
                                                        >
                                                            {updatingId === project.id ? <Loader2 size={18} className="animate-spin" /> : <MoreVertical size={18} />}
                                                        </button>
                                                        {openMenuId === project.id && (
                                                            <div
                                                                onClick={(e) => e.stopPropagation()}
                                                                className="absolute right-0 top-10 z-10 w-56 bg-white border border-gray-200 rounded-xl shadow-lg py-1.5 text-left"
                                                            >
                                                                <Link href={`/admin/projects/${project.id}`} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                                                                    Apri progetto
                                                                </Link>
                                                                <button
                                                                    disabled={!project.leadId}
                                                                    onClick={() => handleSetPriority(project, '2')}
                                                                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-orange-50 flex items-center gap-2 disabled:opacity-40"
                                                                >
                                                                    <span className="w-2 h-2 rounded-full bg-orange-500" /> Segna urgente (arancio)
                                                                </button>
                                                                <button
                                                                    disabled={!project.leadId}
                                                                    onClick={() => handleSetPriority(project, '1')}
                                                                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-yellow-50 flex items-center gap-2 disabled:opacity-40"
                                                                >
                                                                    <span className="w-2 h-2 rounded-full bg-yellow-400" /> Segna da monitorare (giallo)
                                                                </button>
                                                                {project.priorita !== '0' && (
                                                                    <button
                                                                        disabled={!project.leadId}
                                                                        onClick={() => handleSetPriority(project, '0')}
                                                                        className="w-full text-left px-4 py-2 text-sm text-gray-500 hover:bg-gray-50"
                                                                    >
                                                                        Rimuovi evidenziazione
                                                                    </button>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
