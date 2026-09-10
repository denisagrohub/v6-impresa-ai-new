"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { Loader2, ArrowLeft, Mail, Send, ChevronDown, ChevronUp } from "lucide-react";
import HeinrichPanel from "@/components/admin/HeinrichPanel";
import NotesBoard from "@/components/admin/NotesBoard";

interface Partner {
    id: number;
    name: string;
    ruolo: string | null;
    partnerId: number | null;
    partnerName: string | null;
}

interface EmailLog {
    id: number;
    subject: string;
    senderEmail: string;
    recipientEmails: string;
    ccEmails: string;
    matchStatus: string;
    date: string;
}

export default function PartnerProjectDetailPage() {
    const router = useRouter();
    const params = useParams();
    const id = params?.id as string;

    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [project, setProject] = useState<{ id: number; name: string; emailAlias: string | null } | null>(null);
    const [partners, setPartners] = useState<Partner[]>([]);
    const [emails, setEmails] = useState<EmailLog[]>([]);

    const [openEmailId, setOpenEmailId] = useState<number | null>(null);
    const [emailBodies, setEmailBodies] = useState<Record<number, string | null>>({});
    const [loadingBodyId, setLoadingBodyId] = useState<number | null>(null);

    const [selectedPartnerIds, setSelectedPartnerIds] = useState<number[]>([]);
    const [extraEmails, setExtraEmails] = useState("");
    const [subject, setSubject] = useState("");
    const [message, setMessage] = useState("");
    const [sending, setSending] = useState(false);
    const [sendResult, setSendResult] = useState<{ ok: boolean; text: string } | null>(null);

    const load = async () => {
        try {
            const res = await fetch(`/api/admin/partner-projects/${id}`);
            const data = await res.json();
            if (!res.ok || !data.success) {
                setLoadError(data.error || 'Odoo non raggiungibile');
                return;
            }
            setProject(data.project);
            setPartners(data.partners || []);
            setEmails(data.emails || []);
        } catch (error: any) {
            setLoadError(error.message || 'Errore di rete');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const session = localStorage.getItem("pi_session");
        if (!session) {
            router.push("/admin/login");
            return;
        }
        if (id) load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id, router]);

    const toggleEmail = async (emailId: number) => {
        if (openEmailId === emailId) {
            setOpenEmailId(null);
            return;
        }
        setOpenEmailId(emailId);
        if (emailBodies[emailId] === undefined) {
            setLoadingBodyId(emailId);
            try {
                const res = await fetch(`/api/admin/partner-projects/${id}/emails/${emailId}`);
                const data = await res.json();
                setEmailBodies((prev) => ({ ...prev, [emailId]: data.success ? data.body : null }));
            } catch {
                setEmailBodies((prev) => ({ ...prev, [emailId]: null }));
            } finally {
                setLoadingBodyId(null);
            }
        }
    };

    const togglePartner = (partnerId: number) => {
        setSelectedPartnerIds((prev) =>
            prev.includes(partnerId) ? prev.filter((p) => p !== partnerId) : [...prev, partnerId]
        );
    };

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        setSending(true);
        setSendResult(null);
        try {
            const res = await fetch(`/api/admin/partner-projects/${id}/send-email`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    partnerIds: selectedPartnerIds,
                    extraEmails,
                    subject,
                    message: `<p>${message.replace(/\n/g, '<br/>')}</p>`,
                }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                setSendResult({ ok: false, text: data.error || 'Invio fallito' });
                return;
            }
            setSendResult({ ok: true, text: 'Email inviata.' });
            setSubject("");
            setMessage("");
            setExtraEmails("");
            setSelectedPartnerIds([]);
            load(); // ricarica per mostrare l'eventuale nuovo log (se rientra dal catch-all)
        } catch (error: any) {
            setSendResult({ ok: false, text: error.message || 'Errore di rete' });
        } finally {
            setSending(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
                <Loader2 size={40} className="animate-spin text-orange-500" />
            </div>
        );
    }

    if (loadError && !project) {
        return (
            <div className="min-h-screen bg-[#f8fafc]">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <Link href="/admin/partner-projects" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 mb-6">
                        <ArrowLeft size={16} /> Torna ai progetti
                    </Link>
                    <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">{loadError}</div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f8fafc]">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <Link href="/admin/partner-projects" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 mb-6">
                    <ArrowLeft size={16} /> Torna ai progetti
                </Link>

                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-[#1a2744]">{project?.name}</h1>
                    {project?.emailAlias && (
                        <p className="text-gray-500 flex items-center gap-1 mt-1"><Mail size={14} /> {project.emailAlias}</p>
                    )}
                </div>

                {project && (
                    <div className="mb-8">
                        <NotesBoard resModel="erpv6.tracking.relation" resId={project.id} />
                    </div>
                )}

                {/* Parti collegate + affidabilità (Heinrich) */}
                {partners.length > 0 && (
                    <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-8">
                        <h2 className="text-lg font-bold text-[#1a2744] mb-4">Parti Collegate</h2>
                        <div className="space-y-4">
                            {partners.map((p) => (
                                <div key={p.id} className="border border-gray-100 rounded-xl p-4">
                                    <div className="text-sm font-semibold text-[#1a2744] mb-2">
                                        {p.partnerName || p.name}
                                        {p.ruolo && <span className="ml-2 text-xs text-gray-400 font-normal">({p.ruolo.replace('_', ' ')})</span>}
                                    </div>
                                    <HeinrichPanel resModel="erpv6.tracking.relation" resId={p.id} compact />
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Compose */}
                <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-8">
                    <h2 className="text-lg font-bold text-[#1a2744] mb-4">Invia Email dal Progetto</h2>
                    <form onSubmit={handleSend} className="space-y-4">
                        {partners.length > 0 && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Parti collegate</label>
                                <div className="flex flex-wrap gap-2">
                                    {partners.map((p) => (
                                        <label
                                            key={p.id}
                                            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm cursor-pointer ${selectedPartnerIds.includes(p.partnerId || -1) ? 'border-[#1a2744] bg-blue-50' : 'border-gray-200'}`}
                                        >
                                            <input
                                                type="checkbox"
                                                disabled={!p.partnerId}
                                                checked={!!p.partnerId && selectedPartnerIds.includes(p.partnerId)}
                                                onChange={() => p.partnerId && togglePartner(p.partnerId)}
                                            />
                                            {p.partnerName || p.name}
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Altri destinatari (email separate da virgola)</label>
                            <input
                                type="text"
                                value={extraEmails}
                                onChange={(e) => setExtraEmails(e.target.value)}
                                className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                                placeholder="es. mario.rossi@esempio.it"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Oggetto</label>
                            <input
                                type="text"
                                required
                                value={subject}
                                onChange={(e) => setSubject(e.target.value)}
                                className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Messaggio</label>
                            <textarea
                                required
                                rows={5}
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                            />
                        </div>
                        {sendResult && (
                            <div className={`rounded-lg p-3 text-sm ${sendResult.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                                {sendResult.text}
                            </div>
                        )}
                        <button
                            type="submit"
                            disabled={sending}
                            className="flex items-center gap-2 px-6 py-3 rounded-lg bg-[#1a2744] text-white font-medium hover:bg-[#0f3460] disabled:opacity-50"
                        >
                            {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                            Invia
                        </button>
                    </form>
                </div>

                {/* Email log */}
                <div className="bg-white rounded-2xl border border-gray-100 p-6">
                    <h2 className="text-lg font-bold text-[#1a2744] mb-4">Email ricevute</h2>
                    {emails.length === 0 ? (
                        <p className="text-sm text-gray-400">Nessuna email registrata per questo progetto.</p>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {emails.map((e) => (
                                <div key={e.id}>
                                    <button
                                        onClick={() => toggleEmail(e.id)}
                                        className="w-full flex items-center justify-between py-3 text-left hover:bg-gray-50 px-2 rounded-lg"
                                    >
                                        <div>
                                            <div className="text-sm font-semibold text-[#1a2744]">{e.subject}</div>
                                            <div className="text-xs text-gray-500">{e.senderEmail} · {e.date ? new Date(e.date).toLocaleString('it-IT') : ''}</div>
                                        </div>
                                        {openEmailId === e.id ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
                                    </button>
                                    {openEmailId === e.id && (
                                        <div className="px-2 pb-4">
                                            {loadingBodyId === e.id ? (
                                                <Loader2 size={18} className="animate-spin text-gray-400" />
                                            ) : emailBodies[e.id] ? (
                                                <div
                                                    className="prose prose-sm max-w-none bg-gray-50 rounded-lg p-4"
                                                    dangerouslySetInnerHTML={{ __html: emailBodies[e.id] as string }}
                                                />
                                            ) : (
                                                <p className="text-sm text-gray-400">Corpo non disponibile.</p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
