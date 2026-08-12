"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
    Loader2, ArrowLeft, CheckCircle2, XCircle, AlertTriangle,
    TrendingUp, Users, FileText, Brain, DollarSign, Clock,
    Calendar, MessageSquare, Shield, Eye, Lock
} from "lucide-react";

interface Project {
    id: string;
    nome: string;
    cliente: string;
    settore: string;
    fase: string;
    livello: string;
    consulente: string;
    stato: string;
    dataInizio: string;
    sei_aree: any[];
    kairos: any;
    heinrich: any;
    deliverable: any[];
    ultime_interazioni: any[];
}

interface Request {
    id: string;
    type: string;
    category?: string;
    consultantName: string;
    discountPercentage?: number;
    motivation: string;
    status: string;
    createdAt: string;
}

export default function AdminProjectSupervision() {
    const router = useRouter();
    const params = useParams();
    const projectId = params.id as string;
    const [loading, setLoading] = useState(true);
    const [project, setProject] = useState<Project | null>(null);
    const [requests, setRequests] = useState<Request[]>([]);
    const [activeTab, setActiveTab] = useState<'overview' | 'requests' | 'documents' | 'timeline'>('overview');

    useEffect(() => {
        const session = localStorage.getItem("pi_session");
        if (!session || JSON.parse(session).role !== 'admin') {
            router.push("/login");
            return;
        }
        loadData();
    }, [projectId, router]);

    const loadData = async () => {
        try {
            // Mock project data (in produzione: fetch da /api/admin/projects/[id])
            const mockProject: Project = {
                id: projectId,
                nome: "Ristrutturazione Debito & Passaggio Generazionale",
                cliente: "Innovazione S.p.A.",
                settore: "tech",
                fase: "Diagnostica",
                livello: "L2",
                consulente: "Christian Rossi",
                stato: "in_corso",
                dataInizio: "2026-07-10",
                sei_aree: [
                    { nome: "Strategia e Visione", stato: "GIALLO" },
                    { nome: "Economico-Finanziaria", stato: "ROSSO" },
                    { nome: "Operativa e Organizzativa", stato: "VERDE" },
                    { nome: "Persone e Clima", stato: "GIALLO" },
                    { nome: "Conformità, Rischio ed Etica", stato: "VERDE" },
                    { nome: "Continuità e Futuro", stato: "ROSSO" }
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
                    { data: "2026-07-12", tipo: "email", pattern: ["DM-06"], note: "Email lunga con domande su Use of Funds." }
                ]
            };
            setProject(mockProject);

            // Mock requests
            const mockRequests: Request[] = [
                {
                    id: "DR-001",
                    type: "discountRequests",
                    category: "discountRequests",
                    consultantName: "Christian Rossi",
                    discountPercentage: 8,
                    motivation: "Cliente strategico nel settore farmaceutico. Possibile caso studio.",
                    status: "pending",
                    createdAt: "2026-07-13T11:20:00.000Z"
                }
            ];
            setRequests(mockRequests);
        } catch (error) {
            console.error("Errore caricamento dati:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleRequestAction = async (requestId: string, category: string, status: string) => {
        try {
            await fetch('/api/admin/requests', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ category, id: requestId, status })
            });
            loadData();
        } catch (error) {
            console.error("Errore aggiornamento richiesta:", error);
            alert("Errore durante l'aggiornamento");
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
                <Loader2 size={40} className="animate-spin text-orange-500" />
            </div>
        );
    }

    if (!project) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-[#1a2744] mb-2">Progetto non trovato</h2>
                    <Link href="/admin/projects" className="text-orange-600 hover:underline">Torna alla lista progetti</Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f8fafc]">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <Link href="/admin/projects" className="p-2 rounded-lg hover:bg-gray-200 transition-colors">
                            <ArrowLeft size={20} className="text-gray-600" />
                        </Link>
                        <div>
                            <div className="flex items-center gap-3 mb-1">
                                <h1 className="text-3xl font-bold text-[#1a2744]">{project.nome}</h1>
                                <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">{project.fase}</span>
                                <span className="px-3 py-1 rounded-full bg-purple-100 text-purple-700 text-xs font-bold">ADMIN VIEW</span>
                            </div>
                            <p className="text-gray-500">
                                {project.cliente} • {project.id} • Consulente: <strong>{project.consulente}</strong>
                            </p>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="bg-white rounded-2xl border border-gray-100 p-2 mb-6 flex gap-2">
                    <button
                        onClick={() => setActiveTab('overview')}
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === 'overview' ? 'bg-[#1a2744] text-white shadow-lg' : 'text-gray-600 hover:bg-gray-100'
                            }`}
                    >
                        <TrendingUp size={18} /> Overview
                    </button>
                    <button
                        onClick={() => setActiveTab('requests')}
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === 'requests' ? 'bg-[#1a2744] text-white shadow-lg' : 'text-gray-600 hover:bg-gray-100'
                            }`}
                    >
                        <AlertTriangle size={18} /> Richieste ({requests.filter(r => r.status === 'pending').length})
                    </button>
                    <button
                        onClick={() => setActiveTab('documents')}
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === 'documents' ? 'bg-[#1a2744] text-white shadow-lg' : 'text-gray-600 hover:bg-gray-100'
                            }`}
                    >
                        <FileText size={18} /> Documenti
                    </button>
                    <button
                        onClick={() => setActiveTab('timeline')}
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === 'timeline' ? 'bg-[#1a2744] text-white shadow-lg' : 'text-gray-600 hover:bg-gray-100'
                            }`}
                    >
                        <Clock size={18} /> Timeline
                    </button>
                </div>

                {/* Tab Content */}
                {activeTab === 'overview' && (
                    <div className="space-y-6">
                        {/* Kairós Card */}
                        <div className={`bg-gradient-to-r ${project.kairos.quadrante === 'KAIROS_AUTENTICO' ? 'from-green-500 to-emerald-600' :
                                project.kairos.quadrante === 'QUICK_WIN' ? 'from-blue-500 to-cyan-600' :
                                    project.kairos.quadrante === 'PREPARA' ? 'from-orange-500 to-amber-600' :
                                        'from-gray-400 to-gray-500'
                            } rounded-2xl p-6 text-white`}>
                            <div className="flex items-center justify-between flex-wrap gap-6">
                                <div>
                                    <div className="text-sm opacity-80 mb-1">Matrice di Kairós</div>
                                    <div className="text-4xl font-bold">{project.kairos.score}/15</div>
                                    <div className="text-lg mt-1 font-medium">{project.kairos.quadrante.replace('_', ' ')}</div>
                                </div>
                                <div className="flex gap-4">
                                    {['VERDE', 'GIALLO', 'ROSSO'].map(stato => (
                                        <div key={stato} className="text-center">
                                            <div className="text-3xl font-bold">
                                                {project.sei_aree.filter((a: any) => a.stato === stato).length}
                                            </div>
                                            <div className="text-xs opacity-80">{stato}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* 6 Aree Grid */}
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {project.sei_aree.map((area: any, i: number) => (
                                <div key={i} className={`p-5 rounded-xl border-2 ${area.stato === 'VERDE' ? 'border-green-400 bg-green-50' :
                                        area.stato === 'GIALLO' ? 'border-yellow-400 bg-yellow-50' :
                                            'border-red-400 bg-red-50'
                                    }`}>
                                    <div className="flex items-center justify-between mb-2">
                                        <h3 className="font-bold text-sm flex items-center gap-2">
                                            {area.stato === 'VERDE' ? '✅' : area.stato === 'GIALLO' ? '⚠️' : '🔴'} {area.nome}
                                        </h3>
                                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full bg-white/60`}>
                                            {area.stato}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Heinrich Triangle */}
                        <div className="bg-white rounded-2xl border border-gray-100 p-6">
                            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                                <AlertTriangle size={20} className="text-red-500" /> Triangolo di Heinrich
                            </h3>
                            <div className="grid md:grid-cols-3 gap-4">
                                <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg">
                                    <span className="text-sm font-medium text-red-700">🔴 Rosse</span>
                                    <span className="text-2xl font-bold text-red-600">{project.heinrich.rosso}</span>
                                </div>
                                <div className="flex items-center justify-between p-4 bg-yellow-50 rounded-lg">
                                    <span className="text-sm font-medium text-yellow-700">🟡 Gialle</span>
                                    <span className="text-2xl font-bold text-yellow-600">{project.heinrich.giallo}</span>
                                </div>
                                <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                                    <span className="text-sm font-medium text-green-700">🟢 Near Miss</span>
                                    <span className="text-2xl font-bold text-green-600">{project.heinrich.verde}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'requests' && (
                    <div className="space-y-6">
                        {requests.filter(r => r.status === 'pending').length === 0 ? (
                            <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
                                <CheckCircle2 size={48} className="mx-auto mb-4 text-green-500" />
                                <h3 className="text-xl font-bold text-[#1a2744] mb-2">Nessuna richiesta pendente</h3>
                                <p className="text-gray-500">Tutte le richieste sono state gestite</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {requests.filter(r => r.status === 'pending').map((req) => (
                                    <div key={req.id} className="bg-white rounded-2xl border border-gray-100 p-6">
                                        <div className="flex items-start justify-between mb-4">
                                            <div>
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className={`text-xs px-2 py-1 rounded-full font-bold ${req.type === 'discountRequests' || req.category === 'discountRequests'
                                                            ? 'bg-orange-100 text-orange-700'
                                                            : req.type === 'transferRequests' || req.category === 'transferRequests'
                                                                ? 'bg-blue-100 text-blue-700'
                                                                : 'bg-red-100 text-red-700'
                                                        }`}>
                                                        {req.type === 'discountRequests' || req.category === 'discountRequests'
                                                            ? 'Richiesta Sconto'
                                                            : req.type === 'transferRequests' || req.category === 'transferRequests'
                                                                ? 'Trasferimento'
                                                                : 'Segnalazione'}
                                                    </span>
                                                    <span className="text-sm font-medium text-gray-700">{req.consultantName}</span>
                                                </div>
                                                {req.discountPercentage && (
                                                    <div className="text-2xl font-bold text-orange-600">{req.discountPercentage}%</div>
                                                )}
                                            </div>
                                            <div className="text-xs text-gray-500">
                                                {new Date(req.createdAt).toLocaleDateString('it-IT')}
                                            </div>
                                        </div>
                                        <p className="text-sm text-gray-700 mb-4">{req.motivation}</p>
                                        <div className="flex gap-3">
                                            <button
                                                onClick={() => handleRequestAction(req.id, req.category || req.type, 'approved')}
                                                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700"
                                            >
                                                <CheckCircle2 size={16} /> Approva
                                            </button>
                                            <button
                                                onClick={() => handleRequestAction(req.id, req.category || req.type, 'rejected')}
                                                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700"
                                            >
                                                <XCircle size={16} /> Rifiuta
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'documents' && (
                    <div className="bg-white rounded-2xl border border-gray-100 p-6">
                        <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                            <FileText size={20} className="text-blue-500" /> Documenti Progetto
                        </h3>
                        <div className="space-y-3">
                            {project.deliverable.map((doc: any, i: number) => (
                                <div key={i} className={`flex items-center justify-between p-4 rounded-xl border ${doc.stato === 'approvato' || doc.stato === 'consegnato'
                                        ? 'bg-white border-gray-200'
                                        : 'bg-gray-50 border-gray-100 opacity-70'
                                    }`}>
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${doc.stato === 'approvato' || doc.stato === 'consegnato'
                                                ? 'bg-blue-100 text-blue-600'
                                                : 'bg-gray-200 text-gray-400'
                                            }`}>
                                            {doc.stato === 'approvato' || doc.stato === 'consegnato' ? (
                                                <FileText size={18} />
                                            ) : (
                                                <Lock size={18} />
                                            )}
                                        </div>
                                        <div>
                                            <div className="text-sm font-medium text-[#1a2744]">{doc.nome}</div>
                                            <div className="text-xs text-gray-500">
                                                Scadenza: {new Date(doc.scadenza).toLocaleDateString('it-IT')}
                                            </div>
                                        </div>
                                    </div>
                                    <span className={`text-xs px-3 py-1 rounded-full font-bold ${doc.stato === 'approvato' ? 'bg-green-100 text-green-700' :
                                            doc.stato === 'consegnato' ? 'bg-blue-100 text-blue-700' :
                                                doc.stato === 'in_corso' ? 'bg-orange-100 text-orange-700' :
                                                    'bg-gray-100 text-gray-700'
                                        }`}>
                                        {doc.stato === 'approvato' ? 'Approvato' :
                                            doc.stato === 'consegnato' ? 'Consegnato' :
                                                doc.stato === 'in_corso' ? 'In Corso' : 'Atteso'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'timeline' && (
                    <div className="bg-white rounded-2xl border border-gray-100 p-6">
                        <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                            <Clock size={20} className="text-purple-500" /> Timeline Attività
                        </h3>
                        <div className="space-y-4">
                            {project.ultime_interazioni.map((int: any, i: number) => (
                                <div key={i} className="p-5 bg-gray-50 rounded-xl border border-gray-200">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold ${int.tipo === 'call' ? 'bg-blue-500' : 'bg-gray-500'
                                            }`}>
                                            {int.tipo === 'call' ? '📞' : '✉️'}
                                        </div>
                                        <div>
                                            <div className="font-bold text-[#1a2744]">{int.tipo.toUpperCase()}</div>
                                            <div className="text-xs text-gray-500">
                                                {new Date(int.data).toLocaleDateString('it-IT', {
                                                    weekday: 'long',
                                                    day: 'numeric',
                                                    month: 'long'
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-2 mb-3">
                                        {int.pattern.map((p: string, j: number) => (
                                            <span key={j} className="px-3 py-1 rounded-full bg-purple-100 text-purple-700 text-xs font-mono font-bold">
                                                {p}
                                            </span>
                                        ))}
                                    </div>
                                    <p className="text-sm text-gray-700">{int.note}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
