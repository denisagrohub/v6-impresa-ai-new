"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Printer, Building2, Target, BookOpen, Mail } from "lucide-react";

export default function PlaybookPage() {
    const router = useRouter();
    const params = useParams();
    const id = params?.id as string;
    const [user, setUser] = useState<any>(null);
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const s = localStorage.getItem("pi_session");
        if (!s) { router.push("/login"); return; }
        setUser(JSON.parse(s));
    }, [router]);

    useEffect(() => {
        if (!user?.token || !id) return;
        fetch(`/api/consultant/partner-projects/${id}/playbook`, {
            headers: { Authorization: `JWT ${user.token}` },
        })
            .then((r) => r.json())
            .then((d) => { if (d.error) setError(d.error); else setData(d); })
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }, [user, id]);

    if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 size={32} className="animate-spin text-blue-600" /></div>;

    const copyLink = () => {
        if (data?.email_alias) {
            navigator.clipboard.writeText(`${window.location.origin}/p/${data.email_alias}`);
            alert('Link pitch copiato');
        }
    };

    return (
        <div className="min-h-screen bg-white">
            <div className="max-w-4xl mx-auto px-6 py-10 print:py-4">
                <div className="flex items-center justify-between mb-6 print:hidden">
                    <Link href={`/consultant/partner-projects/${id}`} className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900">
                        <ArrowLeft size={16} /> Torna al progetto
                    </Link>
                    <div className="flex items-center gap-2">
                        {data?.email_alias && (
                            <button onClick={copyLink} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-sm hover:bg-gray-50">
                                <Mail size={14} /> Copia link pitch
                            </button>
                        )}
                        <button onClick={() => window.print()} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[#1a2744] text-white text-sm hover:bg-[#0f3460]">
                            <Printer size={14} /> Stampa / PDF
                        </button>
                    </div>
                </div>

                {error && <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{error}</div>}

                {data && (
                    <article className="prose max-w-none">
                        <header className="mb-8 pb-6 border-b border-gray-200">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold mb-3">
                                <BookOpen size={12} /> Playbook Consulente
                            </div>
                            <h1 className="text-3xl font-bold text-[#1a2744] mb-2">{data.name}</h1>
                            <div className="flex flex-wrap gap-3 text-sm text-gray-500">
                                <span>Fase: <b>{data.phase}</b></span>
                                {data.email_alias && <span className="font-mono">{data.email_alias}@v6impresa.it</span>}
                                <span>Target: <b>{data.target_count}</b></span>
                            </div>
                        </header>

                        {data.charter && data.charter.data && (
                            <section className="mb-8">
                                <h2 className="text-lg font-bold text-[#1a2744] mb-3 flex items-center gap-2"><Building2 size={18} /> Il progetto</h2>
                                <div className="space-y-2">
                                    {data.charter.data.origin && <p><b>Origine:</b> {data.charter.data.origin}</p>}
                                    {data.charter.data.regulatoryContext && <p><b>Contesto normativo:</b> {data.charter.data.regulatoryContext}</p>}
                                    {data.charter.data.requirements && <p><b>Requisiti:</b> {data.charter.data.requirements}</p>}
                                    {data.charter.data.commercialTerms && <p><b>Termini commerciali:</b> {data.charter.data.commercialTerms}</p>}
                                    {data.charter.data.currentPhase && <p><b>Fase attuale:</b> {data.charter.data.currentPhase}</p>}
                                    {data.charter.data.pitchSettore && <p><b>Settore:</b> {data.charter.data.pitchSettore}</p>}
                                    {data.charter.data.pitchCosaCerchiamo && (
                                        <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                                            <div className="text-xs font-bold uppercase text-blue-700 mb-1">Cosa cerchiamo</div>
                                            <p className="text-sm whitespace-pre-wrap">{data.charter.data.pitchCosaCerchiamo}</p>
                                        </div>
                                    )}
                                    {data.charter.data.pitchTipologieTarget && (
                                        <div className="bg-violet-50 border border-violet-100 rounded-lg p-3">
                                            <div className="text-xs font-bold uppercase text-violet-700 mb-1">Tipologie target</div>
                                            <p className="text-sm whitespace-pre-wrap">{data.charter.data.pitchTipologieTarget}</p>
                                        </div>
                                    )}
                                    {data.charter.data.pitchCosaOffriamo && (
                                        <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3">
                                            <div className="text-xs font-bold uppercase text-emerald-700 mb-1">Cosa offriamo</div>
                                            <p className="text-sm whitespace-pre-wrap">{data.charter.data.pitchCosaOffriamo}</p>
                                        </div>
                                    )}
                                    {data.charter.data.confidentiality && (
                                        <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
                                            <div className="text-xs font-bold uppercase text-amber-700 mb-1">🔒 Riservatezza</div>
                                            <p className="text-sm whitespace-pre-wrap">{data.charter.data.confidentiality}</p>
                                        </div>
                                    )}
                                </div>
                            </section>
                        )}

                        {data.scouting && data.scouting.data && (
                            <section className="mb-8">
                                <h2 className="text-lg font-bold text-[#1a2744] mb-3">Scouting già fatto</h2>
                                <div className="space-y-4 not-prose">
                                    {data.scouting.data.target && (
                                        <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                                            <div className="text-xs font-bold uppercase tracking-wider text-blue-700 mb-2">Target ideale</div>
                                            {data.scouting.data.target.tipoCliente && (
                                                <p className="text-sm"><b>Tipo cliente:</b> {data.scouting.data.target.tipoCliente}</p>
                                            )}
                                            {Object.entries(data.scouting.data.target).filter(([k]) => k !== 'tipoCliente').map(([k, v]: any) => (
                                                <p key={k} className="text-sm"><b>{k}:</b> {String(v)}</p>
                                            ))}
                                        </div>
                                    )}
                                    {data.scouting.data.eleggibilita && (
                                        <div className="bg-amber-50 border border-amber-100 rounded-lg p-4">
                                            <div className="text-xs font-bold uppercase tracking-wider text-amber-700 mb-2">Criteri di eleggibilità</div>
                                            {Object.entries(data.scouting.data.eleggibilita).map(([k, v]: any) => (
                                                <p key={k} className="text-sm"><b>{k}:</b> {String(v)}</p>
                                            ))}
                                        </div>
                                    )}
                                    {Object.entries(data.scouting.data).filter(([k]) => !['target', 'eleggibilita'].includes(k)).map(([k, v]: any) => (
                                        <div key={k} className="bg-gray-50 border border-gray-100 rounded-lg p-4">
                                            <div className="text-xs font-bold uppercase tracking-wider text-gray-600 mb-2">{k}</div>
                                            {typeof v === 'object' && v !== null ? (
                                                Object.entries(v).map(([k2, v2]: any) => (
                                                    <p key={k2} className="text-sm"><b>{k2}:</b> {String(v2)}</p>
                                                ))
                                            ) : (
                                                <p className="text-sm">{String(v)}</p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}

                        <section className="mb-8">
                            <h2 className="text-lg font-bold text-[#1a2744] mb-3 flex items-center gap-2"><Target size={18} /> Target in lavorazione ({data.targets.length})</h2>
                            {data.targets.length === 0 ? (
                                <p className="text-gray-500 italic">Nessun target ancora aggiunto. Inizia dallo scouting.</p>
                            ) : (
                                <div className="space-y-2 not-prose">
                                    {data.targets.map((t: any) => (
                                        <div key={t.id} className="border border-gray-100 rounded-lg p-4 bg-white">
                                            <div className="font-semibold text-[#1a2744]">{t.partner_name || t.name}</div>
                                            {t.contatto_name && <div className="text-sm text-gray-600 mt-1">Contatto: {t.contatto_name}</div>}
                                            <div className="flex flex-wrap gap-3 text-xs text-gray-500 mt-2">
                                                {t.partner_email && <a href={`mailto:${t.partner_email}`} className="text-blue-600 hover:underline">{t.partner_email}</a>}
                                                {t.partner_phone && <span>{t.partner_phone}</span>}
                                                {t.stage_name && <span className="px-2 py-0.5 bg-gray-100 rounded">{t.stage_name}</span>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </section>

                        <footer className="mt-12 pt-6 border-t border-gray-200 text-xs text-gray-400 print:mt-4">
                            V6 Impresa AI · Playbook riservato ai consulenti · Non condividere all'esterno
                        </footer>
                    </article>
                )}
            </div>
        </div>
    );
}
