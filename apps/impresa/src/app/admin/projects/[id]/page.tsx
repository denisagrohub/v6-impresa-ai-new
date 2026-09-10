"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { Loader2, ArrowLeft, Calendar, User, Building2, FileText, Download, MessageSquareText, ShieldCheck } from "lucide-react";
import HeinrichPanel from "@/components/admin/HeinrichPanel";
import NotesBoard from "@/components/admin/NotesBoard";

interface Project {
    id: number;
    nome: string;
    cliente: string;
    fase: string;
    consulente: string;
    dataInizio: string | null;
    emailDestinatario: string | null;
    kairos: { score: number; prontezzaLabel: string; impattoLabel: string; quadrante: string } | null;
}

interface Intervista {
    score: number | null;
    pacchetto: string | null;
    budget: string | null;
    tempistiche: string | null;
    tipoProgetto: string | null;
    destinatario: string | null;
    fatturato: string | null;
}

interface Documento {
    id: number;
    nome: string;
    categoria: string;
    fileName: string | null;
    finale: boolean;
    blockchainStatus: string | null;
    data: string;
}

interface Interazione {
    tipo: string;
    descrizione: string;
    data: string;
}

interface ContrattoInfo {
    id: number;
    stato: string;
    certificato: boolean;
    firmatoIl: string | null;
}

const CONTRACT_STATE_LABEL: Record<string, string> = {
    draft: 'Bozza', sent: 'Inviato', signed: 'Firmato', certified: 'Certificato', expired: 'Scaduto',
};

const QUADRANTE_COLOR: Record<string, string> = {
    KAIROS_AUTENTICO: 'bg-green-100 text-green-700',
    QUICK_WIN: 'bg-blue-100 text-blue-700',
    PREPARA: 'bg-orange-100 text-orange-700',
    PARCHEGGIO: 'bg-gray-100 text-gray-700',
};

// 10/09/2026 (Denis: "fai una analisi della pagina dei dettagli di
// tutti i progetti per renderla una suite di lavoro, non un elenco di
// caselle... performante e lean") - layout a due colonne invece di
// blocchi impilati: colonna principale = lavoro attivo (lavagna,
// interazioni), colonna laterale = contesto a colpo d'occhio (Kairós,
// affidabilità, risposte intervista, documenti). Niente dati caricati
// per pagine mai aperte: una sola chiamata per il dettaglio, il resto
// (Heinrich) si carica da solo quando il pannello è visibile.
export default function AdminProjectDetail() {
    const router = useRouter();
    const params = useParams();
    const id = params?.id as string;

    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [project, setProject] = useState<Project | null>(null);
    const [intervista, setIntervista] = useState<Intervista | null>(null);
    const [documenti, setDocumenti] = useState<Documento[]>([]);
    const [interazioni, setInterazioni] = useState<Interazione[]>([]);
    const [contratto, setContratto] = useState<ContrattoInfo | null>(null);
    const [creatingContract, setCreatingContract] = useState(false);

    const load = async () => {
        try {
            const res = await fetch(`/api/admin/projects/${id}`);
            const data = await res.json();
            if (!res.ok || !data.success) {
                setLoadError(data.error || 'Odoo non raggiungibile');
                return;
            }
            setProject(data.project);
            setIntervista(data.intervista);
            setDocumenti(data.documenti || []);
            setInterazioni(data.interazioni || []);
            setContratto(data.contratto || null);
        } catch (error: any) {
            setLoadError(error.message || 'Errore di rete');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const session = localStorage.getItem("pi_session");
        if (!session || JSON.parse(session).role !== 'admin') {
            router.push("/login");
            return;
        }
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id, router]);

    const handleCreateContract = async () => {
        setCreatingContract(true);
        try {
            const res = await fetch(`/api/admin/projects/${id}/create-contract`, { method: 'POST' });
            const data = await res.json();
            if (data.success) load();
            else alert(data.error || 'Creazione fallita');
        } finally {
            setCreatingContract(false);
        }
    };

    const handleSendEmail = async (note: { title: string; body: string; note_type: string }) => {
        if (!project?.emailDestinatario) {
            return { ok: false, text: 'Nessuna email sul contatto di questo progetto.' };
        }
        const res = await fetch(`/api/admin/projects/${id}/send-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                subject: note.title || (note.note_type === 'brief' ? 'Brief progetto' : note.note_type === 'debrief' ? 'Debrief progetto' : 'Aggiornamento progetto'),
                message: note.body,
            }),
        });
        const data = await res.json();
        return data.success
            ? { ok: true, text: `Inviata a ${data.sentTo}` }
            : { ok: false, text: data.error || 'Invio fallito' };
    };

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
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <Link href="/admin/projects" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 mb-6">
                        <ArrowLeft size={16} /> Torna ai progetti
                    </Link>
                    <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">{loadError || 'Progetto non trovato'}</div>
                </div>
            </div>
        );
    }

    const hasIntervista = intervista && (intervista.budget || intervista.tempistiche || intervista.tipoProgetto || intervista.destinatario || intervista.fatturato || intervista.score);

    return (
        <div className="min-h-screen bg-[#f8fafc]">
            <div className="w-full px-4 sm:px-6 lg:px-8 py-8">
                <Link href="/admin/projects" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 mb-4">
                    <ArrowLeft size={16} /> Torna ai progetti
                </Link>

                <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-bold text-[#1a2744]">{project.nome}</h1>
                        <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-gray-500">
                            <span className="flex items-center gap-1"><Building2 size={14} /> {project.cliente}</span>
                            <span className="flex items-center gap-1"><User size={14} /> {project.consulente}</span>
                            {project.dataInizio && (
                                <span className="flex items-center gap-1"><Calendar size={14} /> {new Date(project.dataInizio).toLocaleDateString('it-IT')}</span>
                            )}
                        </div>
                    </div>
                    <span className="px-3 py-1.5 rounded-full bg-gray-100 text-gray-700 text-xs font-bold">{project.fase}</span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px_380px] gap-6 items-start">
                    {/* Colonna 1: lavoro attivo */}
                    <div className="space-y-6 min-w-0">
                        <div className="bg-white rounded-2xl border border-gray-100 p-6">
                            <h2 className="text-sm font-bold text-[#1a2744] mb-3 flex items-center gap-2">
                                <MessageSquareText size={16} className="text-gray-400" /> Ultime Interazioni
                            </h2>
                            {interazioni.length === 0 ? (
                                <p className="text-sm text-gray-400">Nessuna interazione registrata.</p>
                            ) : (
                                <div className="space-y-2 max-h-64 overflow-y-auto">
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

                    {/* Colonna 2: contesto a colpo d'occhio */}
                    <div className="space-y-6 min-w-0">
                        {project.kairos && (
                            <div className="bg-white rounded-2xl border border-gray-100 p-5">
                                <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Kairós</h2>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-xl font-bold text-[#1a2744]">{project.kairos.score}/15</span>
                                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${QUADRANTE_COLOR[project.kairos.quadrante] || 'bg-gray-100 text-gray-700'}`}>
                                        {project.kairos.quadrante.replace('_', ' ')}
                                    </span>
                                </div>
                                <p className="text-xs text-gray-500">Prontezza: {project.kairos.prontezzaLabel} · Impatto: {project.kairos.impattoLabel}</p>
                            </div>
                        )}

                        <div className="bg-white rounded-2xl border border-gray-100 p-5">
                            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-2">
                                <ShieldCheck size={14} /> Contratto
                            </h2>
                            {contratto ? (
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm font-medium text-[#1a2744]">{CONTRACT_STATE_LABEL[contratto.stato] || contratto.stato}</span>
                                    {contratto.certificato && (
                                        <span className="text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-700">Certificato</span>
                                    )}
                                    {contratto.firmatoIl && (
                                        <span className="text-xs text-gray-400">Firmato il {new Date(contratto.firmatoIl).toLocaleDateString('it-IT')}</span>
                                    )}
                                </div>
                            ) : (
                                <button
                                    onClick={handleCreateContract}
                                    disabled={creatingContract}
                                    className="w-full px-3 py-2 rounded-lg bg-[#1a2744] text-white text-xs font-medium hover:bg-[#0f3460] disabled:opacity-50"
                                >
                                    {creatingContract ? 'Creo...' : 'Crea Contratto'}
                                </button>
                            )}
                        </div>

                        <div className="bg-white rounded-2xl border border-gray-100 p-5">
                            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Affidabilità</h2>
                            <HeinrichPanel resModel="erpv6.production.order" resId={project.id} compact />
                        </div>

                        {hasIntervista && (
                            <div className="bg-white rounded-2xl border border-gray-100 p-5">
                                <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Risposte Intervista</h2>
                                <dl className="space-y-2 text-sm">
                                    {intervista?.tipoProgetto && <div><dt className="text-xs text-gray-400">Tipo Progetto</dt><dd className="text-[#1a2744]">{intervista.tipoProgetto}</dd></div>}
                                    {intervista?.budget && <div><dt className="text-xs text-gray-400">Budget</dt><dd className="text-[#1a2744]">{intervista.budget}</dd></div>}
                                    {intervista?.tempistiche && <div><dt className="text-xs text-gray-400">Tempistiche</dt><dd className="text-[#1a2744]">{intervista.tempistiche}</dd></div>}
                                    {intervista?.destinatario && <div><dt className="text-xs text-gray-400">Destinatario</dt><dd className="text-[#1a2744]">{intervista.destinatario}</dd></div>}
                                    {intervista?.fatturato && <div><dt className="text-xs text-gray-400">Fatturato</dt><dd className="text-[#1a2744]">{intervista.fatturato}</dd></div>}
                                    {intervista?.score != null && <div><dt className="text-xs text-gray-400">Score</dt><dd className="text-[#1a2744]">{intervista.score}</dd></div>}
                                </dl>
                            </div>
                        )}

                        <div className="bg-white rounded-2xl border border-gray-100 p-5">
                            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-2">
                                <FileText size={14} /> Documenti
                            </h2>
                            {documenti.length === 0 ? (
                                <p className="text-sm text-gray-400">Nessun documento generato.</p>
                            ) : (
                                <div className="space-y-2">
                                    {documenti.map((d) => (
                                        <a key={d.id} href={`/api/admin/documents/${d.id}/download`}
                                            className="flex items-center justify-between p-2 rounded-lg bg-gray-50 hover:bg-gray-100 text-sm">
                                            <div>
                                                <div className="text-[#1a2744] font-medium">{d.nome}</div>
                                                <div className="text-xs text-gray-400">{d.categoria}{d.finale ? ' · finale' : ''}</div>
                                            </div>
                                            <Download size={14} className="text-gray-400" />
                                        </a>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Colonna 3: lavagna di lavoro */}
                    <div className="lg:sticky lg:top-8 lg:h-[calc(100vh-4rem)] min-w-0">
                        <NotesBoard resModel="erpv6.production.order" resId={project.id} onSendEmail={handleSendEmail} />
                    </div>
                </div>
            </div>
        </div>
    );
}
