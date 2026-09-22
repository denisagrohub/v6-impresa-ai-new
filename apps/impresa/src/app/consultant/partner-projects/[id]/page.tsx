"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
    ArrowLeft, Loader2, AlertCircle, Building2, User, Mail, Phone, X,
    Target as TargetIcon, FileText, TrendingUp, RefreshCw, Users,
} from "lucide-react";

type Tab = 'copertina' | 'parti' | 'documenti' | 'email' | 'target' | 'kpi' | 'compenso';

export default function PartnerProjectDetail() {
    const router = useRouter();
    const params = useParams();
    const id = params?.id as string;

    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [tab, setTab] = useState<Tab>('copertina');
    const [documents, setDocuments] = useState<any[]>([]);
    const [kpiData, setKpiData] = useState<any>(null);
    const [targetDetail, setTargetDetail] = useState<any>(null);
    const [targetDetailLoading, setTargetDetailLoading] = useState(false);

    const loadData = async () => {
        if (!user?.token || !id) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/consultant/partner-projects/${id}`, {
                headers: { Authorization: `JWT ${user.token}` },
            });
            const d = await res.json();
            if (!res.ok || d.error) { setError(d.error || 'Impossibile caricare il progetto'); return; }
            setData(d);
        } catch (e: any) {
            setError(e.message || 'Errore di rete');
        } finally { setLoading(false); }
    };

    useEffect(() => {
        const session = localStorage.getItem("pi_session");
        if (!session) { router.push("/login"); return; }
        try {
            const parsed = JSON.parse(session);
            if (parsed.role !== 'consultant' && parsed.role !== 'admin') { router.push("/login"); return; }
            setUser(parsed);
        } catch { router.push("/login"); }
    }, [router]);

    useEffect(() => { if (user) loadData(); }, [user, id]);

    useEffect(() => {
        if (!user?.token || !id) return;
        if (tab === 'documenti' && documents.length === 0) {
            fetch(`/api/admin/partner-projects/${id}/documents`, {
                headers: { Authorization: `JWT ${user.token}` },
            }).then((r) => r.json()).then((d) => setDocuments(d.documents || [])).catch(() => {});
        }
        if (tab === 'kpi' && !kpiData) {
            fetch(`/api/admin/partner-projects/${id}/kpi`, {
                headers: { Authorization: `JWT ${user.token}` },
            }).then((r) => r.json()).then((d) => setKpiData(d)).catch(() => {});
        }
    }, [tab, user, id, documents.length, kpiData]);

    const openTargetDetail = async (targetId: number) => {
        if (!user?.token) return;
        setTargetDetailLoading(true);
        setTargetDetail({ id: targetId });
        try {
            const res = await fetch(`/api/consultant/targets/${targetId}`, {
                headers: { Authorization: `JWT ${user.token}` },
            });
            const d = await res.json();
            if (!res.ok || d.error) throw new Error(d.error || 'Errore');
            setTargetDetail(d);
        } catch (e: any) { setTargetDetail({ id: targetId, error: e.message }); }
        finally { setTargetDetailLoading(false); }
    };

    if (loading || !user) {
        return <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]"><Loader2 size={32} className="animate-spin text-blue-500" /></div>;
    }

    const tabList: { id: Tab; label: string; count?: number }[] = [
        { id: 'copertina', label: 'Copertina' },
        { id: 'parti', label: 'Persone/Parti', count: data?.partners?.length },
        { id: 'documenti', label: 'Documenti', count: documents.length || undefined },
        { id: 'email', label: 'Email', count: data?.emails?.length },
        { id: 'target', label: 'Target', count: data?.targets?.length },
        { id: 'kpi', label: 'KPI' },
        { id: 'compenso', label: 'Mio compenso' },
    ];

    return (
        <div className="min-h-screen bg-[#f8fafc]">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
                {/* HEADER */}
                <div className="flex items-center gap-3 mb-6">
                    <Link href="/consultant/dashboard" className="p-2 rounded-lg hover:bg-gray-200 transition-colors">
                        <ArrowLeft size={18} className="text-gray-600" />
                    </Link>
                    <div className="flex-1 min-w-0">
                        <h1 className="text-2xl font-bold text-[#1a2744] flex items-center gap-2 truncate">
                            <Building2 size={22} className="text-blue-600 shrink-0" />
                            {data?.name || 'Progetto'}
                        </h1>
                        <p className="text-sm text-gray-500">
                            Fase: <span className="font-medium">{data?.state || '—'}</span>
                            {data?.emailAlias && <span className="ml-3 font-mono text-xs">{data.emailAlias}</span>}
                        </p>
                    </div>
                    <button onClick={loadData} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">
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
                        <div className="flex gap-1 mb-6 bg-white rounded-xl border border-gray-100 p-1 overflow-x-auto">
                            {tabList.map((t) => (
                                <button key={t.id} onClick={() => setTab(t.id)}
                                    className={`flex-1 min-w-[120px] flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                                        tab === t.id ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'
                                    }`}>
                                    {t.label}{t.count != null ? ` (${t.count})` : ''}
                                </button>
                            ))}
                        </div>

                        {/* COPERTINA */}
                        {tab === 'copertina' && (
                            <div className="space-y-4">
                                {data.charter ? (
                                    <div className="bg-white rounded-2xl border border-gray-100 p-6">
                                        <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">Charter</h2>
                                        {data.charter.settore && <p className="text-sm mb-2"><b>Settore:</b> {data.charter.settore}</p>}
                                        {data.charter.descrizione && <p className="text-sm mb-2"><b>Descrizione:</b> {data.charter.descrizione}</p>}
                                        {data.charter.obiettivo && <p className="text-sm mb-2"><b>Obiettivo:</b> {data.charter.obiettivo}</p>}
                                        {data.charter.baseCompenso && (
                                            <p className="text-sm"><b>Base compenso:</b> {data.charter.baseCompenso.valore} {data.charter.baseCompenso.unita || ''}</p>
                                        )}
                                    </div>
                                ) : (
                                    <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-500">
                                        Charter non ancora compilato.
                                    </div>
                                )}
                                {data.relationScouting && Object.keys(data.relationScouting).length > 0 && (
                                    <div className="bg-white rounded-2xl border border-gray-100 p-6">
                                        <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">Scouting</h2>
                                        <pre className="text-xs text-gray-700 whitespace-pre-wrap">{JSON.stringify(data.relationScouting, null, 2)}</pre>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* PARTI */}
                        {tab === 'parti' && (
                            <div className="space-y-3">
                                {(!data.partners || data.partners.length === 0) ? (
                                    <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-500">Nessuna parte collegata.</div>
                                ) : data.partners.map((p: any) => (
                                    <div key={p.id} className="bg-white rounded-2xl border border-gray-100 p-5">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-bold text-[#1a2744] flex items-center gap-2">
                                                    <User size={16} className="text-gray-400" /> {p.name}
                                                </h3>
                                                {p.ruolo && <p className="text-sm text-gray-500 mt-1">{p.ruolo}</p>}
                                                {p.partnerName && p.partnerName !== p.name && (
                                                    <p className="text-xs text-gray-500 mt-1">Azienda: <b>{p.partnerName}</b></p>
                                                )}
                                                {p.partnerEmail && (
                                                    <a href={`mailto:${p.partnerEmail}`} className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-1">
                                                        <Mail size={11} /> {p.partnerEmail}
                                                    </a>
                                                )}
                                                {p.partnerPhone && <div className="text-xs text-gray-600 flex items-center gap-1 mt-1"><Phone size={11} /> {p.partnerPhone}</div>}
                                            </div>
                                            {p.fromTargetName && (
                                                <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full whitespace-nowrap">
                                                    {p.fromTargetName}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* DOCUMENTI */}
                        {tab === 'documenti' && (
                            <div className="space-y-2">
                                {documents.length === 0 ? (
                                    <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-500">Nessun documento.</div>
                                ) : documents.map((d: any) => (
                                    <div key={d.id} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center justify-between">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <FileText size={16} className="text-gray-400 shrink-0" />
                                            <span className="text-sm truncate">{d.name}</span>
                                        </div>
                                        <a href={`/api/admin/attachments/${d.id}/download`} target="_blank" rel="noopener noreferrer"
                                           className="text-xs text-blue-600 hover:underline shrink-0">Scarica</a>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* EMAIL */}
                        {tab === 'email' && (
                            <div className="space-y-2">
                                {(!data.emails || data.emails.length === 0) ? (
                                    <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-500">Nessuna email.</div>
                                ) : data.emails.map((e: any) => (
                                    <div key={`${e.source}-${e.id}`} className="bg-white rounded-2xl border border-gray-100 p-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex-1 min-w-0">
                                                <h4 className="font-medium text-[#1a2744] truncate">{e.subject}</h4>
                                                <p className="text-xs text-gray-500 mt-0.5 truncate">Da: {e.senderEmail}</p>
                                                <span className={`inline-block text-[10px] mt-1 px-1.5 py-0.5 rounded ${
                                                    e.direction === 'inviata' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                                                }`}>{e.direction}</span>
                                            </div>
                                            <span className="text-xs text-gray-400 whitespace-nowrap">
                                                {e.date ? new Date(e.date + (e.date.endsWith('Z') ? '' : 'Z')).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* TARGET */}
                        {tab === 'target' && (
                            <div className="space-y-3">
                                {(!data.targets || data.targets.length === 0) ? (
                                    <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-500">Nessun target.</div>
                                ) : data.targets.map((t: any) => (
                                    <button key={t.id} onClick={() => openTargetDetail(t.id)}
                                        className="w-full text-left bg-white rounded-2xl border border-gray-100 p-5 hover:border-blue-300 hover:shadow-md transition-all">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-bold text-[#1a2744] flex items-center gap-2">
                                                    <Building2 size={16} className="text-gray-400" /> {t.partnerName || t.name}
                                                </h3>
                                                {t.contattoName && <p className="text-sm text-gray-500 mt-1 flex items-center gap-1.5"><User size={13} /> {t.contattoName}</p>}
                                                {t.partnerEmail && <p className="text-xs text-gray-500 mt-1">{t.partnerEmail}</p>}
                                            </div>
                                            <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${
                                                t.state === 'attivo' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                                            }`}>{t.state}</span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* KPI */}
                        {tab === 'kpi' && (
                            <div className="bg-white rounded-2xl border border-gray-100 p-6">
                                {!kpiData ? <div className="text-center text-gray-500 py-8"><Loader2 size={20} className="animate-spin mx-auto" /></div>
                                 : (
                                    <div className="grid grid-cols-2 gap-4">
                                        {Object.entries(kpiData.kpi || kpiData || {}).slice(0, 8).map(([k, v]: any) => (
                                            <div key={k}>
                                                <div className="text-xs text-gray-500 uppercase">{k}</div>
                                                <div className="text-2xl font-bold text-[#1a2744]">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* COMPENSO */}
                        {tab === 'compenso' && (
                            <div className="bg-white rounded-2xl border border-gray-100 p-6">
                                {data.mio_compenso ? (
                                    <>
                                        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">Il mio compenso</h3>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div><div className="text-xs text-gray-500">Mia quota</div>
                                                <div className="text-3xl font-bold text-blue-600">{data.mio_compenso.pct}%</div></div>
                                            <div><div className="text-xs text-gray-500">Base</div>
                                                <div className="text-xl font-bold text-gray-800">{data.mio_compenso.base_valore}
                                                    {data.mio_compenso.base_tipo === 'fisso_unita' ? ` EUR/${data.mio_compenso.base_unita || 'u'}` : '%'}</div></div>
                                        </div>
                                        <div className="mt-4 pt-4 border-t border-gray-100">
                                            <div className="text-xs text-gray-500">Quota teorica per unità</div>
                                            <div className="text-2xl font-bold text-emerald-600">
                                                {(data.mio_compenso.base_valore * data.mio_compenso.pct / 100).toFixed(4)}
                                                {data.mio_compenso.base_tipo === 'fisso_unita' ? ` EUR/${data.mio_compenso.base_unita || 'u'}` : ' %'}
                                            </div>
                                        </div>
                                        <div className="mt-4">
                                            <span className={`inline-block text-xs px-2 py-1 rounded-full ${
                                                data.mio_compenso.approvato ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'
                                            }`}>{data.mio_compenso.approvato ? 'Split approvato' : 'Split in bozza'}</span>
                                        </div>
                                    </>
                                ) : (
                                    <div className="text-center text-gray-500 py-6">Non sei configurato nello Split V6 di questo progetto.</div>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* MODAL TARGET */}
            {targetDetail && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setTargetDetail(null)}>
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                        <div className="border-b border-gray-100 px-5 py-3 flex items-start justify-between">
                            <h3 className="text-base font-bold text-[#1a2744]">
                                {targetDetailLoading ? 'Caricamento...' : (targetDetail.partner?.name || targetDetail.name || 'Target')}
                            </h3>
                            <button onClick={() => setTargetDetail(null)} className="text-gray-400 hover:text-gray-700"><X size={18} /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                            {targetDetailLoading ? <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-blue-500" /></div>
                             : targetDetail.error ? <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">{targetDetail.error}</div>
                             : (
                                <>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {targetDetail.partner && (
                                            <div className="bg-gray-50 rounded-lg p-3">
                                                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-2">Azienda</div>
                                                <div className="font-semibold text-[#1a2744]">{targetDetail.partner.name}</div>
                                                {targetDetail.partner.email && <a href={`mailto:${targetDetail.partner.email}`} className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-1"><Mail size={11} /> {targetDetail.partner.email}</a>}
                                                {targetDetail.partner.phone && <div className="text-xs text-gray-600 flex items-center gap-1 mt-1"><Phone size={11} /> {targetDetail.partner.phone}</div>}
                                            </div>
                                        )}
                                        {targetDetail.contatto && (
                                            <div className="bg-gray-50 rounded-lg p-3">
                                                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-2">Contatto</div>
                                                <div className="font-semibold text-[#1a2744]">{targetDetail.contatto.name}</div>
                                                {targetDetail.contatto.email && <a href={`mailto:${targetDetail.contatto.email}`} className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-1"><Mail size={11} /> {targetDetail.contatto.email}</a>}
                                            </div>
                                        )}
                                    </div>
                                    {targetDetail.dossier && (
                                        <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
                                            <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700 mb-2">Dossier</div>
                                            <pre className="text-xs text-gray-700 whitespace-pre-wrap">{JSON.stringify(targetDetail.dossier, null, 2)}</pre>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
