"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { Loader2, ArrowLeft, Calendar, User, Building2 } from "lucide-react";
import HeinrichPanel from "@/components/admin/HeinrichPanel";
import NotesBoard from "@/components/admin/NotesBoard";

interface Project {
    id: number;
    nome: string;
    cliente: string;
    fase: string;
    consulente: string;
    dataInizio: string | null;
    kairos: { score: number; prontezzaLabel: string; impattoLabel: string; quadrante: string } | null;
}

interface Interazione {
    tipo: string;
    descrizione: string;
    data: string;
}

const QUADRANTE_COLOR: Record<string, string> = {
    KAIROS_AUTENTICO: 'bg-green-100 text-green-700',
    QUICK_WIN: 'bg-blue-100 text-blue-700',
    PREPARA: 'bg-orange-100 text-orange-700',
    PARCHEGGIO: 'bg-gray-100 text-gray-700',
};

export default function AdminProjectDetail() {
    const router = useRouter();
    const params = useParams();
    const id = params?.id as string;

    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [project, setProject] = useState<Project | null>(null);
    const [interazioni, setInterazioni] = useState<Interazione[]>([]);

    useEffect(() => {
        const session = localStorage.getItem("pi_session");
        if (!session || JSON.parse(session).role !== 'admin') {
            router.push("/login");
            return;
        }
        (async () => {
            try {
                const res = await fetch(`/api/admin/projects/${id}`);
                const data = await res.json();
                if (!res.ok || !data.success) {
                    setLoadError(data.error || 'Odoo non raggiungibile');
                    return;
                }
                setProject(data.project);
                setInterazioni(data.interazioni || []);
            } catch (error: any) {
                setLoadError(error.message || 'Errore di rete');
            } finally {
                setLoading(false);
            }
        })();
    }, [id, router]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
                <Loader2 size={40} className="animate-spin text-orange-500" />
            </div>
        );
    }

    if (loadError || !project) {
        return (
            <div className="min-h-screen bg-[#f8fafc]">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <Link href="/admin/projects" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 mb-6">
                        <ArrowLeft size={16} /> Torna ai progetti
                    </Link>
                    <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">{loadError || 'Progetto non trovato'}</div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f8fafc]">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <Link href="/admin/projects" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 mb-6">
                    <ArrowLeft size={16} /> Torna ai progetti
                </Link>

                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-[#1a2744]">{project.nome}</h1>
                    <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-gray-500">
                        <span className="flex items-center gap-1"><Building2 size={14} /> {project.cliente}</span>
                        <span className="flex items-center gap-1"><User size={14} /> {project.consulente}</span>
                        {project.dataInizio && (
                            <span className="flex items-center gap-1"><Calendar size={14} /> {new Date(project.dataInizio).toLocaleDateString('it-IT')}</span>
                        )}
                        <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-700 text-xs font-bold">{project.fase}</span>
                    </div>
                </div>

                {project.kairos && (
                    <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-8">
                        <h2 className="text-sm font-bold text-[#1a2744] mb-3">Kairós</h2>
                        <div className="flex flex-wrap items-center gap-3">
                            <span className="text-2xl font-bold text-[#1a2744]">{project.kairos.score}/15</span>
                            <span className={`text-xs px-2 py-1 rounded-full font-medium ${QUADRANTE_COLOR[project.kairos.quadrante] || 'bg-gray-100 text-gray-700'}`}>
                                {project.kairos.quadrante.replace('_', ' ')}
                            </span>
                            <span className="text-xs text-gray-500">Prontezza: {project.kairos.prontezzaLabel} · Impatto: {project.kairos.impattoLabel}</span>
                        </div>
                    </div>
                )}

                <div className="mb-8">
                    <NotesBoard resModel="erpv6.production.order" resId={project.id} />
                </div>

                <div className="mb-8">
                    <HeinrichPanel resModel="erpv6.production.order" resId={project.id} />
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 p-6">
                    <h2 className="text-sm font-bold text-[#1a2744] mb-3">Ultime Interazioni</h2>
                    {interazioni.length === 0 ? (
                        <p className="text-sm text-gray-400">Nessuna interazione registrata.</p>
                    ) : (
                        <div className="space-y-2 max-h-96 overflow-y-auto">
                            {interazioni.map((int, i) => (
                                <div key={i} className="flex items-start gap-3 p-2 rounded-lg bg-gray-50">
                                    <div className="flex-1">
                                        <span className="text-sm">{int.tipo}{int.descrizione ? `: ${int.descrizione}` : ''}</span>
                                        <div className="text-xs text-gray-400">{int.data ? new Date(int.data).toLocaleString('it-IT') : ''}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
