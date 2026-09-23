"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2, CheckCircle2, XCircle, ShieldCheck } from "lucide-react";

export default function VerifyPage() {
    const params = useParams();
    const token = params?.token as string;
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!token) return;
        fetch(`/api/public/verify/${token}`, { cache: 'no-store' })
            .then((r) => r.json())
            .then((d) => { if (d.error) setError(d.error); else setData(d); })
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }, [token]);

    if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 size={32} className="animate-spin text-blue-600" /></div>;

    return (
        <div className="min-h-screen bg-gradient-to-b from-[#f8fafc] to-white">
            <div className="max-w-2xl mx-auto px-6 py-12">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold mb-3">
                        <ShieldCheck size={14} /> V6 Impresa · Verifica firma digitale
                    </div>
                    <h1 className="text-3xl font-bold text-[#1a2744] mb-2">Verifica documento firmato</h1>
                    <p className="text-sm text-gray-500">Ogni firma V6 è tracciata e verificabile pubblicamente</p>
                </div>

                {error ? (
                    <div className="bg-white rounded-2xl border border-red-100 p-8 text-center">
                        <XCircle size={48} className="text-red-500 mx-auto mb-4" />
                        <h2 className="text-xl font-bold text-red-700 mb-2">Documento non trovato</h2>
                        <p className="text-gray-600 text-sm">{error}</p>
                    </div>
                ) : data ? (
                    <>
                        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center mb-6">
                            <CheckCircle2 size={48} className="text-emerald-600 mx-auto mb-3" />
                            <h2 className="text-xl font-bold text-emerald-900">Firma valida</h2>
                            <p className="text-sm text-emerald-700 mt-1">Il documento è stato firmato digitalmente</p>
                        </div>
                        <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
                            <div>
                                <div className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">Documento</div>
                                <div className="text-sm font-medium text-[#1a2744]">{data.document_name}</div>
                            </div>
                            <div>
                                <div className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">Tipo</div>
                                <div className="text-sm text-gray-700">{data.document_kind}</div>
                            </div>
                            <div>
                                <div className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">Firmatario</div>
                                <div className="text-sm text-gray-700">{data.signer_name}</div>
                            </div>
                            <div>
                                <div className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">Data firma</div>
                                <div className="text-sm text-gray-700">
                                    {data.signed_at ? new Date(data.signed_at + 'Z').toLocaleString('it-IT') : '—'}
                                </div>
                            </div>
                            {data.hash && (
                                <div>
                                    <div className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">Hash documento (SHA-256)</div>
                                    <div className="text-sm font-mono text-gray-700 break-all">{data.hash}…</div>
                                </div>
                            )}
                            <div>
                                <div className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">Emittente</div>
                                <div className="text-sm text-gray-700">{data.issuer}</div>
                            </div>
                            <div>
                                <div className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">Provider firma</div>
                                <div className="text-sm text-gray-700">{data.provider}</div>
                            </div>
                        </div>
                        <p className="text-xs text-center text-gray-400 mt-6">
                            Documento protetto dalla firma elettronica avanzata V6 Impresa.
                        </p>
                    </>
                ) : null}
            </div>
        </div>
    );
}
