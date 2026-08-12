"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    Loader2, ArrowLeft, Search, Filter, Eye, MoreVertical,
    Users, TrendingUp, AlertCircle, CheckCircle2, Clock
} from "lucide-react";

interface Project {
    id: string;
    nome: string;
    cliente: string;
    settore: string;
    livello: string;
    stato: "in_corso" | "completato" | "in_attesa" | "bloccato";
    consulente: string;
    consulenteId: string;
    dataInizio: string;
    kairos?: { score: number; quadrante: string };
}

export default function AdminProjectsPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [projects, setProjects] = useState<Project[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [filterConsultant, setFilterConsultant] = useState("");
    const [filterStatus, setFilterStatus] = useState("");
    const [filterSector, setFilterSector] = useState("");
    const [consultants, setConsultants] = useState<any[]>([]);

    useEffect(() => {
        const session = localStorage.getItem("pi_session");
        if (!session) {
            router.push("/admin/login");
            return;
        }
        loadProjects();
        loadConsultants();
    }, [router]);

    const loadProjects = async () => {
        try {
            const res = await fetch('/api/admin/projects');
            if (res.ok) {
                const data = await res.json();
                setProjects(data.projects || []);
            }
        } catch (error) {
            console.error('Errore caricamento progetti:', error);
            // Fallback mock data
            setProjects([
                {
                    id: "PI-2026-0024",
                    nome: "Business Plan Startup Tech",
                    cliente: "Innovazione S.p.A.",
                    settore: "tech",
                    livello: "L1",
                    stato: "in_corso",
                    consulente: "Christian Rossi",
                    consulenteId: "PART-004",
                    dataInizio: "2026-07-10",
                    kairos: { score: 11, quadrante: "KAIROS_AUTENTICO" }
                },
                {
                    id: "PI-2026-0025",
                    nome: "Piano Industriale PMI",
                    cliente: "Metalmeccanica Srl",
                    settore: "manifatturiero",
                    livello: "L2",
                    stato: "in_attesa",
                    consulente: "Laura Neri",
                    consulenteId: "PART-003",
                    dataInizio: "2026-07-15",
                    kairos: { score: 8, quadrante: "PREPARA" }
                },
                {
                    id: "PI-2026-0026",
                    nome: "Advisory M&A",
                    cliente: "Banca Generali",
                    settore: "finance",
                    livello: "L3",
                    stato: "completato",
                    consulente: "Davide Bianchi",
                    consulenteId: "PART-001",
                    dataInizio: "2026-06-01",
                    kairos: { score: 14, quadrante: "KAIROS_AUTENTICO" }
                },
            ]);
        } finally {
            setLoading(false);
        }
    };

    const loadConsultants = async () => {
        try {
            const res = await fetch('/api/admin/partners?type=consultant');
            if (res.ok) {
                const data = await res.json();
                setConsultants(data.partners || []);
            }
        } catch (error) {
            console.error('Errore caricamento consulenti:', error);
        }
    };

    const filteredProjects = projects.filter(p => {
        const matchSearch = p.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.cliente.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.id.toLowerCase().includes(searchTerm.toLowerCase());
        const matchConsultant = !filterConsultant || p.consulenteId === filterConsultant;
        const matchStatus = !filterStatus || p.stato === filterStatus;
        const matchSector = !filterSector || p.settore === filterSector;
        return matchSearch && matchConsultant && matchStatus && matchSector;
    });

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
                        <Link href="/admin/dashboard" className="p-2 rounded-lg hover:bg-gray-200 transition-colors">
                            <ArrowLeft size={20} className="text-gray-600" />
                        </Link>
                        <div>
                            <h1 className="text-3xl font-bold text-[#1a2744]">Gestione Progetti</h1>
                            <p className="text-gray-500">Panoramica e controllo di tutti i progetti attivi</p>
                        </div>
                    </div>
                    <Link
                        href="/admin/projects/new"
                        className="px-4 py-2 rounded-lg bg-[#1a2744] text-white font-medium hover:bg-[#0f3460] flex items-center gap-2"
                    >
                        + Nuovo Progetto
                    </Link>
                </div>

                {/* Stats Cards */}
                <div className="grid md:grid-cols-4 gap-6 mb-8">
                    <div className="bg-white rounded-2xl border border-gray-100 p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                                <TrendingUp size={24} className="text-blue-600" />
                            </div>
                        </div>
                        <div className="text-3xl font-bold text-[#1a2744] mb-1">{projects.length}</div>
                        <div className="text-sm text-gray-500">Progetti Totali</div>
                    </div>
                    <div className="bg-white rounded-2xl border border-gray-100 p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
                                <CheckCircle2 size={24} className="text-green-600" />
                            </div>
                        </div>
                        <div className="text-3xl font-bold text-[#1a2744] mb-1">{projects.filter(p => p.stato === 'in_corso').length}</div>
                        <div className="text-sm text-gray-500">In Corso</div>
                    </div>
                    <div className="bg-white rounded-2xl border border-gray-100 p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className="w-12 h-12 rounded-xl bg-yellow-100 flex items-center justify-center">
                                <Clock size={24} className="text-yellow-600" />
                            </div>
                        </div>
                        <div className="text-3xl font-bold text-[#1a2744] mb-1">{projects.filter(p => p.stato === 'in_attesa').length}</div>
                        <div className="text-sm text-gray-500">In Attesa</div>
                    </div>
                    <div className="bg-white rounded-2xl border border-gray-100 p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center">
                                <AlertCircle size={24} className="text-red-600" />
                            </div>
                        </div>
                        <div className="text-3xl font-bold text-[#1a2744] mb-1">{projects.filter(p => p.stato === 'bloccato').length}</div>
                        <div className="text-sm text-gray-500">Bloccati</div>
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
                            <label className="block text-sm font-medium text-gray-700 mb-1">Stato</label>
                            <select
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value)}
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
                                onChange={(e) => setFilterSector(e.target.value)}
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

                {/* Table */}
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">ID Progetto</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Nome / Cliente</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Livello</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Consulente</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Kairós</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Stato</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Data Inizio</th>
                                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Azioni</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {filteredProjects.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                                            Nessun progetto trovato
                                        </td>
                                    </tr>
                                ) : (
                                    filteredProjects.map((project) => (
                                        <tr key={project.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-mono font-medium text-gray-900">
                                                {project.id}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-sm font-semibold text-[#1a2744]">{project.nome}</div>
                                                <div className="text-xs text-gray-500">{project.cliente} • {project.settore}</div>
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
                                                {getStatusBadge(project.stato)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {new Date(project.dataInizio).toLocaleDateString('it-IT')}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <Link
                                                        href={`/admin/projects/${project.id}`}
                                                        className="p-2 rounded-lg hover:bg-blue-50 text-blue-600"
                                                        title="Supervisione Progetto"
                                                    >
                                                        <Eye size={18} />
                                                    </Link>
                                                    <button className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
                                                        <MoreVertical size={18} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
