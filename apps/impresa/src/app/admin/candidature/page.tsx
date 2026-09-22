"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Mail, Phone, Trash2, Building2, Filter } from "lucide-react";

export default function AdminCandidaturePage() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any[]>([]);
    const [stateFilter, setStateFilter] = useState<string>('');
    const [projectFilter, setProjectFilter] = useState<string>('');

    const load = async () => {
        setLoading(true);
        try {
            const qs = new URLSearchParams();
            if (stateFilter) qs.set('state', stateFilter);
            if (projectFilter) qs.set('project', projectFilter);
            const res = await fetch(`/api/admin/candidacies?${qs.toString()}`);
            const d = await res.json();
            setData(d.candidacies || []);
        } catch { setData([]); }
        finally { setLoading(false); }
    };

    useEffect(() => {
        const s = localStorage.getItem("pi_session");
        if (!s) { router.push("/login"); return; }
        const u = JSON.parse(s);
        if (u.role !== 'admin') { router.push("/login"); return; }
        setUser(u);
    }, [router]);

    useEffect(() => { if (user) load(); }, [user, stateFilter, projectFilter]);

    const setState = async (id: number, st: string) => {
        try {
            const res = await fetch(`/api/admin/candidacies/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ state: st }),
            });
            if (res.ok) load();
        } catch { alert('Errore di rete'); }
    };

    const remove = async (id: number, name: string) => {
        if (!confirm(`Eliminare candidatura di "${name}"?`)) return;
        try {
            const res = await fetch(`/api/admin/candidacies/${id}`, { method: 'DELETE' });
            if (res.ok) load();
        } catch { alert('Errore di rete'); }
    };

    const badgeClass = (s: string) =>
        s === 'nuova' ? 'bg-blue-100 text-blue-700' :
        s === 'in_valutazione' ? 'bg-amber-100 text-amber-700' :
        'bg-gray-100 text-gray-600';

    if (loading && !data.length) return <div className="min-h-screen flex items-center justify-center"><Loader2 size={32} className="animate-spin text-blue-600" /></div>;

    return (
        <div className="min-h-screen bg-[#f8fafc]">
            <div className="max-w-6xl mx-auto px-6 py-8">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <Link href="/admin/dashboard" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 mb-2">
                            <ArrowLeft size={14} /> Dashboard
                        </Link>
                        <h1 className="text-3xl font-bold text-[#1a2744]">Candidature</h1>
                        <p className="text-sm text-gray-500">Pitch pubblico progetti + pagina partnership</p>
                    </div>
                    <div className="text-right text-sm text-gray-500">Totale: <b className="text-[#1a2744]">{data.length}</b></div>
                </div>

                <div className="bg-white rounded-xl border border-gray-100 p-4 mb-6 flex flex-wrap gap-3 items-center">
                    <Filter size={16} className="text-gray-400" />
                    <select value={stateFilter} onChange={(e) => setStateFilter(e.target.value)}
                        className="px-3 py-2 rounded-lg border border-gray-200 text-sm">
                        <option value="">Tutti gli stati</option>
                        <option value="nuova">Nuove</option>
                        <option value="in_valutazione">In valutazione</option>
                        <option value="archiviata">Archiviate</option>
                    </select>
                    <input type="text" value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}
                        placeholder="Filtra per alias progetto (es. progetto-tee)"
                        className="px-3 py-2 rounded-lg border border-gray-200 text-sm flex-1 min-w-[240px]" />
                </div>

                {data.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-gray-500">Nessuna candidatura trovata.</div>
                ) : (
                    <div className="space-y-3">
                        {data.map((c) => (
                            <div key={c.id} className="bg-white rounded-2xl border border-gray-100 p-5">
                                <div className="flex items-start justify-between gap-3 mb-3">
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-bold text-[#1a2744] flex items-center gap-2 flex-wrap">
                                            <Building2 size={16} className="text-gray-400" />
                                            {c.name}
                                            {c.companyName && <span className="text-sm text-gray-500">· {c.companyName}</span>}
                                            <span className={`text-xs px-2 py-0.5 rounded-full ${badgeClass(c.state)}`}>{c.state}</span>
                                            {c.sourceProjectAlias && (
                                                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">da /p/{c.sourceProjectAlias}</span>
                                            )}
                                        </h3>
                                        <div className="flex flex-wrap gap-3 text-xs text-gray-600 mt-2">
                                            {c.email && <a href={`mailto:${c.email}`} className="flex items-center gap-1 text-blue-600 hover:underline"><Mail size={11} /> {c.email}</a>}
                                            {c.phone && <a href={`tel:${c.phone}`} className="flex items-center gap-1 text-gray-600"><Phone size={11} /> {c.phone}</a>}
                                            <span className="text-gray-400">{c.createDate ? new Date(c.createDate + 'Z').toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        {c.state === 'nuova' && (
                                            <button onClick={() => setState(c.id, 'in_valutazione')}
                                                className="px-3 py-1.5 rounded-lg bg-amber-100 text-amber-800 text-xs font-medium hover:bg-amber-200">
                                                In valutazione
                                            </button>
                                        )}
                                        {c.state !== 'archiviata' && (
                                            <button onClick={() => setState(c.id, 'archiviata')}
                                                className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 text-xs font-medium hover:bg-gray-200">
                                                Archivia
                                            </button>
                                        )}
                                        <button onClick={() => remove(c.id, c.name)}
                                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50">
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                                {c.proposal && <p className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 rounded-lg p-3 mt-2">{c.proposal}</p>}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
