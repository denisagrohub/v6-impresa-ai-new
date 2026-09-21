"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
    ArrowLeft, Loader2, AlertCircle, Building2, User, Mail,
    Target as TargetIcon, FileText, TrendingUp, RefreshCw
} from "lucide-react";

interface Target {
    id: number;
    name: string;
    partner_id: number | null;
    partner_name: string;
    contatto_id: number | null;
    contatto_name: string;
    stage_id: number | null;
    stage_name: string;
    state: string;
}

interface EmailLog {
    id: number;
    subject: string;
    sender_email: string;
    recipient_user_id: number | null;
    create_date: string;
}

interface MioCompenso {
    pct: number;
    base_tipo: string;
    base_valore: number;
    base_unita: string;
    approvato: boolean;
}

interface ProjectDetail {
    id: number;
    name: string;
    is_admin: boolean;
    project_phase: string;
    targets: Target[];
    emails: EmailLog[];
    mio_compenso: MioCompenso | null;
}

export default function PartnerProjectDetail() {
    const router = useRouter();
    const params = useParams();
    const id = params?.id as string;

    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<ProjectDetail | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'targets' | 'email' | 'compenso'>('targets');

    const loadData = async () => {
        if (!user?.token || !id) return;
        try {
            const res = await fetch(`/api/consultant/partner-projects/${id}`, {
                headers: { Authorization: `JWT ${user.token}` },
            });
            const d = await res.json();
            if (!res.ok || d.error) {
                setError(d.error || 'Impossibile caricare il progetto');
                return;
            }
            setData(d);
        } catch (e: any) {
            setError(e.message || 'Errore di rete');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const session = localStorage.getItem("pi_session");
        if (!session) { router.push("/login"); return; }
        try {
            const parsed = JSON.parse(session);
            if (parsed.role !== 'consultant' && parsed.role !== 'admin') {
                router.push("/login");
                return;
            }
            setUser(parsed);
        } catch { router.push("/login"); }
    }, [router]);

    useEffect(() => { if (user) loadData(); }, [user, id]);

    if (loading || !user) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
                <Loader2 size={32} className="animate-spin text-blue-500" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f8fafc]">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
                {/* HEADER */}
                <div className="flex items-center gap-3 mb-6">
                    <Link href="/consultant/dashboard" className="p-2 rounded-lg hover:bg-gray-200 transition-colors">
                        <ArrowLeft size={18} className="text-gray-600" />
                    </Link>
                    <div className="flex-1">
                        <h1 className="text-2xl font-bold text-[#1a2744] flex items-center gap-2">
                            <Building2 size={22} className="text-blue-600" />
                            {data?.name || 'Progetto'}
                        </h1>
                        <p className="text-sm text-gray-500">
                            Fase: <span className="font-medium">{data?.project_phase || '—'}</span>
                        </p>
                    </div>
                    <button
                        onClick={loadData}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-gray-200 text-sm text-gray-600 hover:bg-gray-50"
                    >
                        <RefreshCw size={14} /> Aggiorna
                    </button>
                </div>

                {error && (
                    <div className="mb-6 rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700 flex items-center gap-2">
                        <AlertCircle size={16} /> {error}
                    </div>
                )}

                {data && (
                    <>
                        {/* TABS */}
                        <div className="flex gap-1 mb-6 bg-white rounded-xl border border-gray-100 p-1">
                            {[
                                { id: 'targets', label: `Target (${data.targets.length})`, icon: TargetIcon },
                                { id: 'email', label: `Email (${data.emails.length})`, icon: Mail },
                                { id: 'compenso', label: 'Mio compenso', icon: TrendingUp },
                            ].map(t => (
                                <button
                                    key={t.id}
                                    onClick={() => setActiveTab(t.id as any)}
                                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                                        activeTab === t.id
                                            ? 'bg-blue-600 text-white'
                                            : 'text-gray-600 hover:bg-gray-50'
                                    }`}
                                >
                                    <t.icon size={14} /> {t.label}
                                </button>
                            ))}
                        </div>

                        {/* TAB TARGETS */}
                        {activeTab === 'targets' && (
                            <div className="space-y-3">
                                {data.targets.length === 0 ? (
                                    <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-500">
                                        Nessun target in questo progetto.
                                    </div>
                                ) : (
                                    data.targets.map((t) => (
                                        <div key={t.id} className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md transition-shadow">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex-1 min-w-0">
                                                    <h3 className="font-bold text-[#1a2744] flex items-center gap-2">
                                                        <Building2 size={16} className="text-gray-400" />
                                                        {t.partner_name || t.name}
                                                    </h3>
                                                    {t.contatto_name && (
                                                        <p className="text-sm text-gray-500 mt-1 flex items-center gap-1.5">
                                                            <User size={13} /> {t.contatto_name}
                                                        </p>
                                                    )}
                                                </div>
                                                <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${
                                                    t.state === 'attivo' ? 'bg-green-100 text-green-700' :
                                                    t.state === 'bocciato' ? 'bg-red-100 text-red-700' :
                                                    'bg-gray-100 text-gray-600'
                                                }`}>
                                                    {t.stage_name || t.state}
                                                </span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}

                        {/* TAB EMAIL */}
                        {activeTab === 'email' && (
                            <div className="space-y-3">
                                {data.emails.length === 0 ? (
                                    <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-500">
                                        Nessuna email per questo progetto.
                                    </div>
                                ) : (
                                    data.emails.map((e) => (
                                        <div key={e.id} className="bg-white rounded-2xl border border-gray-100 p-4">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="font-medium text-[#1a2744] truncate">{e.subject}</h4>
                                                    <p className="text-xs text-gray-500 mt-0.5 truncate">Da: {e.sender_email}</p>
                                                </div>
                                                <span className="text-xs text-gray-400 whitespace-nowrap">
                                                    {e.create_date ? new Date(e.create_date).toLocaleDateString('it-IT') : ''}
                                                </span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}

                        {/* TAB COMPENSO */}
                        {activeTab === 'compenso' && (
                            <div className="bg-white rounded-2xl border border-gray-100 p-6">
                                {data.mio_compenso ? (
                                    <>
                                        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">Il mio compenso</h3>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <div className="text-xs text-gray-500">Mia quota</div>
                                                <div className="text-3xl font-bold text-blue-600">{data.mio_compenso.pct}%</div>
                                            </div>
                                            <div>
                                                <div className="text-xs text-gray-500">Base</div>
                                                <div className="text-xl font-bold text-gray-800">
                                                    {data.mio_compenso.base_valore}
                                                    {data.mio_compenso.base_tipo === 'fisso_unita'
                                                        ? ` EUR/${data.mio_compenso.base_unita || 'u'}`
                                                        : '% sul valore'}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="mt-4 pt-4 border-t border-gray-100">
                                            <div className="text-xs text-gray-500">Quota teorica per unità</div>
                                            <div className="text-2xl font-bold text-emerald-600">
                                                {(data.mio_compenso.base_valore * data.mio_compenso.pct / 100).toFixed(4)}
                                                {data.mio_compenso.base_tipo === 'fisso_unita'
                                                    ? ` EUR/${data.mio_compenso.base_unita || 'u'}`
                                                    : ' %'}
                                            </div>
                                        </div>
                                        <div className="mt-4">
                                            <span className={`inline-block text-xs px-2 py-1 rounded-full ${
                                                data.mio_compenso.approvato ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'
                                            }`}>
                                                {data.mio_compenso.approvato ? 'Split approvato' : 'Split in bozza'}
                                            </span>
                                        </div>
                                    </>
                                ) : (
                                    <div className="text-center text-gray-500 py-6">
                                        Non sei ancora configurato nello Split V6 di questo progetto.
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
