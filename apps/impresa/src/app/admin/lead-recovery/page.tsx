"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, ArrowLeft, Send, Mail, Clock, Archive, AlertCircle } from "lucide-react";

export default function LeadRecoveryPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [drafts, setDrafts] = useState<any[]>([]);

    useEffect(() => {
        const session = localStorage.getItem("odoo_session");
        if (!session) router.push("/admin/login");
        else loadDrafts();
    }, [router]);

    const loadDrafts = async () => {
        try {
            const res = await fetch('/api/lead-recovery');
            const data = await res.json();
            setDrafts(data.drafts || []);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const sendEmail = async (draftId: string, emailNumber: number) => {
        try {
            await fetch('/api/lead-recovery', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ draftId, emailNumber }),
            });
            alert(`✅ Email ${emailNumber} inviata (simulata - controlla console)`);
            loadDrafts();
        } catch (e) { alert('Errore'); }
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 size={40} className="animate-spin text-orange-500" /></div>;

    return (
        <div className="min-h-screen bg-[#f8fafc]">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="mb-8">
                    <Link href="/admin/dashboard" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 mb-2">
                        <ArrowLeft size={16} /> Torna alla dashboard
                    </Link>
                    <h1 className="text-3xl font-bold text-[#1a2744]">Recupero Lead Abbandonati</h1>
                    <p className="text-gray-500">Gestisci le email di follow-up per i lead che non hanno completato il percorso</p>
                </div>

                {drafts.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
                        <Mail size={48} className="mx-auto mb-4 text-green-500" />
                        <h3 className="text-xl font-bold text-[#1a2744] mb-2">Nessun lead da recuperare</h3>
                        <p className="text-gray-500">Tutti i lead sono stati gestiti o sono ancora in fase attiva</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {drafts.map((draft) => (
                            <div key={draft.id} className="bg-white rounded-2xl border border-gray-100 p-6">
                                <div className="flex items-start justify-between flex-wrap gap-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className="font-mono text-sm text-gray-500">{draft.id}</span>
                                            <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${draft.leadScore?.tier === 'Whale' ? 'bg-red-100 text-red-700' :
                                                    draft.leadScore?.tier === 'Hot' ? 'bg-orange-100 text-orange-700' :
                                                        'bg-gray-100 text-gray-700'
                                                }`}>
                                                {draft.leadScore?.tier || 'N/A'} ({draft.leadScore?.totale || 0})
                                            </span>
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
                                                {draft.level}
                                            </span>
                                        </div>
                                        <div className="font-bold text-[#1a2744] text-lg">{draft.formData?.azienda || 'Azienda non specificata'}</div>
                                        <div className="text-sm text-gray-500">
                                            {draft.formData?.nomeContatto} • {draft.formData?.email} • {draft.formData?.telefono}
                                        </div>
                                        <div className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                                            <Clock size={12} />
                                            Ultimo accesso: {new Date(draft.lastModified).toLocaleString('it-IT')}
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        {!draft.email1Sent && (
                                            <button onClick={() => sendEmail(draft.id, 1)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600 text-sm font-medium">
                                                <Send size={14} /> Email 1 (2h)
                                            </button>
                                        )}
                                        {!draft.email2Sent && draft.email1Sent && (
                                            <button onClick={() => sendEmail(draft.id, 2)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500 text-white hover:bg-orange-600 text-sm font-medium">
                                                <Send size={14} /> Email 2 (24h)
                                            </button>
                                        )}
                                        {!draft.email3Sent && draft.email2Sent && (
                                            <button onClick={() => sendEmail(draft.id, 3)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 text-sm font-medium">
                                                <Archive size={14} /> Email 3 (3gg) + Archivia
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
