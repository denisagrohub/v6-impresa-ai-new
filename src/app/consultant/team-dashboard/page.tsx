"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    Loader2, ArrowLeft, Filter, Users, TrendingUp,
    CheckCircle2, Clock, AlertCircle, BarChart3, Eye
} from "lucide-react";

interface Project {
    id: string;
    nome: string;
    cliente: string;
    settore: string;
    livello: string;
    stato: "in_corso" | "completato" | "in_attesa" | "bloccato";
    consulenteId: string;
    consulenteName: string;
    dataInizio: string;
    kairos?: { score: number; quadrante: string };
}

interface TeamConsultant {
    id: string;
    name: string;
    email: string;
}

export default function TeamDashboard() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [projects, setProjects] = useState<Project[]>([]);
    const [teamConsultants, setTeamConsultants] = useState<TeamConsultant[]>([]);
    const [stats, setStats] = useState<any>(null);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [user, setUser] = useState<any>(null);

    // Filtri
    const [filterConsultant, setFilterConsultant] = useState<string>("");
    const [filterStatus, setFilterStatus] = useState<string>("");
    const [filterSector, setFilterSector] = useState<string>("");

    useEffect(() => {
        const session = localStorage.getItem("pi_session");
        if (!session) {
            router.push("/login");
            return;
        }
        setUser(JSON.parse(session));
        loadTeamProjects(JSON.parse(session).clientId);
    }, [router]);

    const loadTeamProjects = async (consultantId: string) => {
        try {
            const params = new URLSearchParams({ consultantId });
            if (filterConsultant) params.append('filterConsultant', filterConsultant);
            if (filterStatus) params.append('filterStatus', filterStatus);
            if (filterSector) params.append('filterSector', filterSector);

            const res = await fetch(`/api/consultant/team-projects?${params}`);

            if (res.status === 403) {
                alert('Accesso negato. Solo Chief Consultant possono accedere a questa dashboard.');
                router.push('/consultant/dashboard');
                return;
            }

            const data = await res.json();
            setProjects(data.projects || []);
            setTeamConsultants(data.teamConsultants || []);
            setStats(data.stats);
            setCurrentUser(data.currentUser);
        } catch (error) {
            console.error('Errore caricamento progetti team:', error);
        } finally {
            setLoading(false);
        }
    };

    const getStatusBadge = (stato: string) => {
        switch (stato) {
            case "in_corso": return <span className="px-2 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">In Corso</span>;
            case "completato": return <span className="px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs font-bold">Completato</span>;
            case "in_attesa": return <span className="px-2 py-1 rounded-full bg-yellow-100 text-yellow-700 text-xs font-bold">In Attesa</span>;
            case "bloccato": return <span className="px-2 py-1 rounded-full bg-red-100 text-red-700 text-xs font-bold">Bloccato</span>;
            default: return <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-700 text-xs font-bold">{stato}</span>;
        }
    };

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
        <div className="min-h-screen bg-[#f8fafc]">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <Link href="/consultant/dashboard" className="p-2 rounded-lg hover:bg-gray-200 transition-colors">
                            <ArrowLeft size={20} className="text-gray-600" />
                        </Link>
                        <div>
                            <div className="flex items-center gap-3">
                                <h1 className="text-3xl font-bold text-[#1a2744]">Dashboard Team</h1>
                                <span className="px-3 py-1 rounded-full bg-purple-100 text-purple-700 text-xs font-bold">
                                    CHIEF CONSULTANT
                                </span>
                            </div>
                            <p className="text-gray-500">Supervisione progetti del team • {currentUser?.name}</p>
                        </div>
                    </div>
                </div>

                {/* Stats Cards */}
                {stats && (
                    <div className="grid md:grid-cols-4 gap-6 mb-8">
                        <div className="bg-white rounded-2xl border border-gray-100 p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                                    <BarChart3 size={24} className="text-blue-600" />
                                </div>
                            </div>
                            <div className="text-3xl font-bold text-[#1a2744] mb-1">{stats.total}</div>
                            <div className="text-sm text-gray-500">Progetti Totali</div>
                        </div>
                        <div className="bg-white rounded-2xl border border-gray-100 p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
                                    <CheckCircle2 size={24} className="text-green-600" />
                                </div>
                            </div>
                            <div className="text-3xl font-bold text-[#1a2744] mb-1">{stats.active}</div>
                            <div className="text-sm text-gray-500">In Corso</div>
                        </div>
                        <div className="bg-white rounded-2xl border border-gray-100 p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div className="w-12 h-12 rounded-xl bg-yellow-100 flex items-center justify-center">
                                    <Clock size={24} className="text-yellow-600" />
                                </div>
                            </div>
                            <div className="text-3xl font-bold text-[#1a2744] mb-1">{stats.pending}</div>
                            <div className="text-sm text-gray-500">In Attesa</div>
                        </div>
                        <div className="bg-white rounded-2xl border border-gray-100 p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center">
                                    <AlertCircle size={24} className="text-red-600" />
                                </div>
                            </div>
                            <div className="text-3xl font-bold text-[#1a2744] mb-1">{stats.blocked}</div>
                            <div className="text-sm text-gray-500">Bloccati</div>
                        </div>
                    </div>
                )}

                {/* Filters */}
                <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
                    <h3 className="text-lg font-bold text-[#1a2744] mb-4 flex items-center gap-2">
                        <Filter size={20} className="text-orange-500" />
                        Filtri
                    </h3>
                    <div className="grid md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Consulente</label>
                            <select
                                value={filterConsultant}
                                onChange={(e) => {
                                    setFilterConsultant(e.target.value);
                                    loadTeamProjects(user.clientId);
                                }}
                                className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 bg-white"
                            >
                                <option value="">Tutti i consulenti</option>
                                {teamConsultants.map((c) => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Stato</label>
                            <select
                                value={filterStatus}
                                onChange={(e) => {
                                    setFilterStatus(e.target.value);
                                    loadTeamProjects(user.clientId);
                                }}
                                className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 bg-white"
                            >
                                <option value="">Tutti gli stati</option>
                                <option value="in_corso">In Corso</option>
                                <option value="completato">Completato</option>
                                <option value="in_attesa">In Attesa</option>
                                <option value="bloccato">Bloccato</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Settore</label>
                            <select
                                value={filterSector}
                                onChange={(e) => {
                                    setFilterSector(e.target.value);
                                    loadTeamProjects(user.clientId);
                                }}
                                className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 bg-white"
                            >
                                <option value="">Tutti i settori</option>
                                <option value="tech">Tech</option>
                                <option value="manifatturiero">Manifatturiero</option>
                                <option value="finance">Finance</option>
                                <option value="food">Food</option>
                                <option value="hospitality">Hospitality</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Projects Table */}
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">ID</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Progetto / Cliente</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Consulente</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Livello</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Kairós</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Stato</th>
                                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Azioni</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {projects.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                                            Nessun progetto trovato
                                        </td>
                                    </tr>
                                ) : (
                                    projects.map((project) => (
                                        <tr key={project.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-mono font-medium text-gray-900">
                                                {project.id}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-sm font-semibold text-[#1a2744]">{project.nome}</div>
                                                <div className="text-xs text-gray-500">{project.cliente} • {project.settore}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold">
                                                        {project.consulenteName?.charAt(0) || '?'}
                                                    </div>
                                                    <span className="text-sm text-gray-700">{project.consulenteName}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`px-2 py-1 rounded text-xs font-bold ${project.livello === 'L3' ? 'bg-purple-100 text-purple-700' :
                                                        project.livello === 'L2' ? 'bg-blue-100 text-blue-700' :
                                                            'bg-gray-100 text-gray-700'
                                                    }`}>
                                                    {project.livello}
                                                </span>
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
                                                {getStatusBadge(project.stato)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right">
                                                <Link
                                                    href={`/consultant/project-progress?id=${project.id}`}
                                                    className="p-2 rounded-lg hover:bg-blue-50 text-blue-600 inline-flex items-center gap-1"
                                                    title="Vedi dettagli"
                                                >
                                                    <Eye size={18} />
                                                    <span className="text-xs font-medium">Dettagli</span>
                                                </Link>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Team Members */}
                <div className="bg-white rounded-2xl border border-gray-100 p-6 mt-6">
                    <h3 className="text-lg font-bold text-[#1a2744] mb-4 flex items-center gap-2">
                        <Users size={20} className="text-blue-500" />
                        Membri del Team ({teamConsultants.length})
                    </h3>
                    <div className="grid md:grid-cols-3 gap-4">
                        {teamConsultants.map((consultant) => {
                            const consultantProjects = projects.filter(p => p.consulenteId === consultant.id);
                            return (
                                <div key={consultant.id} className="p-4 bg-gray-50 rounded-xl">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold">
                                            {consultant.name.charAt(0)}
                                        </div>
                                        <div>
                                            <div className="font-bold text-[#1a2744]">{consultant.name}</div>
                                            <div className="text-xs text-gray-500">{consultant.email}</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm">
                                        <TrendingUp size={14} className="text-green-600" />
                                        <span className="text-gray-700">{consultantProjects.length} progetti</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
