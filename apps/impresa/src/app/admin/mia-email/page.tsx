"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    ArrowLeft, Loader2, RefreshCw, Plus, Trash2, X, Send,
    CornerUpLeft, CornerUpRight, ReplyAll,
} from "lucide-react";

export default function AdminMiaEmailPage() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const [emailsData, setEmailsData] = useState<any>(null);
    const [emailsLoading, setEmailsLoading] = useState(false);
    const [emailDetail, setEmailDetail] = useState<any>(null);
    const [emailDetailLoading, setEmailDetailLoading] = useState(false);
    const [composer, setComposer] = useState<any>(null);
    const [composerSending, setComposerSending] = useState(false);

    useEffect(() => {
        const session = localStorage.getItem("pi_session");
        if (!session) { router.push("/login"); return; }
        const u = JSON.parse(session);
        setUser(u);
        setLoading(false);
    }, [router]);

    useEffect(() => { if (user?.token) loadEmails(); }, [user]);

    const loadEmails = async () => {
        if (!user?.token) return;
        setEmailsLoading(true);
        try {
            const res = await fetch('/api/consultant/emails', {
                headers: { Authorization: `JWT ${user.token}` },
            });
            const data = await res.json();
            setEmailsData(data);
        } catch {
            setEmailsData({ emails: [], error: 'Errore di rete' });
        } finally { setEmailsLoading(false); }
    };

    const openEmailDetail = async (id: number) => {
        if (!user?.token) return;
        setEmailDetailLoading(true);
        setEmailDetail({ id });
        try {
            const res = await fetch(`/api/consultant/emails/${id}`, {
                headers: { Authorization: `JWT ${user.token}` },
            });
            const data = await res.json();
            setEmailDetail({ id, ...data });
        } catch {
            setEmailDetail({ id, error: 'Errore caricamento' });
        } finally { setEmailDetailLoading(false); }
    };

    const openComposer = async (emailId: number, mode: 'reply' | 'replyAll' | 'forward') => {
        if (!user?.token) return;
        try {
            const res = await fetch(`/api/consultant/emails/${emailId}/reply-data`, {
                headers: { Authorization: `JWT ${user.token}` },
            });
            const d = await res.json();
            const orig = (d.original_body || '').trim();
            const body = mode === 'forward'
                ? (orig ? '<br><br><hr><p><b>----- Messaggio inoltrato -----</b></p>' + orig : '')
                : (orig ? '<br><br><hr><p>' + orig + '</p>' : '');
            setComposer({
                mode,
                in_reply_to_id: emailId,
                from_email: d.from_email || '',
                to: d.to || '',
                cc: mode === 'replyAll' ? (d.cc || '') : '',
                subject: d.subject || '',
                body,
            });
        } catch {
            alert('Impossibile aprire il composer');
        }
    };

    const openNewComposer = () => {
        const fromEmail = user?.emailSlug ? `${user.emailSlug}@v6impresa.it` : (user?.email || '');
        setComposer({ mode: 'new', from_email: fromEmail, to: '', cc: '', subject: '', body: '' });
    };

    const deleteEmail = async (id: number, subject: string) => {
        if (!user?.token) return;
        if (!confirm(`Eliminare definitivamente "${subject}"?`)) return;
        try {
            const res = await fetch(`/api/consultant/emails/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `JWT ${user.token}` },
            });
            if (!res.ok) {
                const d = await res.json().catch(() => ({}));
                alert(d.error || 'Eliminazione fallita');
                return;
            }
            if (emailDetail?.id === id) setEmailDetail(null);
            loadEmails();
        } catch { alert('Errore di rete'); }
    };

    const handleComposerSend = async () => {
        if (!user?.token || !composer) return;
        const bodyText = (composer.body || '').replace(/<[^>]*>/g, '').trim();
        if (!composer.to?.trim() || !composer.subject?.trim() || !bodyText) {
            alert('Compila destinatario, oggetto e corpo.');
            return;
        }
        setComposerSending(true);
        try {
            const res = await fetch('/api/consultant/emails/send', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `JWT ${user.token}`,
                },
                body: JSON.stringify(composer),
            });
            const data = await res.json();
            if (!res.ok || data?.error) {
                alert(data?.error || 'Invio fallito');
                return;
            }
            setComposer(null);
            loadEmails();
        } catch { alert('Errore di rete'); }
        finally { setComposerSending(false); }
    };

    const fmt = (d: string) => {
        if (!d) return '—';
        const iso = d.endsWith('Z') || d.includes('+') ? d : d + 'Z';
        return new Date(iso).toLocaleString('it-IT', {
            day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
        });
    };

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center"><Loader2 size={40} className="animate-spin text-orange-500" /></div>;
    }

    return (
        <div className="min-h-screen bg-[#f8fafc]">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <Link href="/admin/dashboard" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 mb-2">
                            <ArrowLeft size={16} /> Torna alla dashboard
                        </Link>
                        <h1 className="text-3xl font-bold text-[#1a2744]">La mia email</h1>
                        <p className="text-sm text-gray-500">
                            Posta personale su <span className="font-mono">{user?.emailSlug || user?.email}@v6impresa.it</span>
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={openNewComposer}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700"
                        >
                            <Plus size={14} /> Nuova email
                        </button>
                        <button
                            onClick={loadEmails}
                            disabled={emailsLoading}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                        >
                            {emailsLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                            Aggiorna
                        </button>
                    </div>
                </div>

                {emailsLoading && !emailsData && (
                    <div className="flex items-center gap-2 text-gray-500 text-sm">
                        <Loader2 size={16} className="animate-spin" /> Carico le email...
                    </div>
                )}

                {emailsData && emailsData.emails?.length === 0 && (
                    <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-500">
                        Nessuna email.
                    </div>
                )}

                <div className="space-y-3">
                    {emailsData && emailsData.emails?.map((e: any) => (
                        <div
                            key={e.id}
                            className="w-full bg-white rounded-2xl border border-gray-100 hover:border-blue-300 hover:shadow-md transition-all flex items-stretch"
                        >
                            <button
                                onClick={() => openEmailDetail(e.id)}
                                className="flex-1 text-left p-5 cursor-pointer"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-bold text-[#1a2744] truncate">{e.subject}</h3>
                                        <p className="text-sm text-gray-600 mt-1 truncate">
                                            Da: <span className="font-medium">{e.sender_email}</span>
                                        </p>
                                        {e.relation_name && (
                                            <span className="inline-flex items-center gap-1 mt-2 text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                                                {e.relation_name}
                                            </span>
                                        )}
                                    </div>
                                    <span className="text-xs text-gray-400 whitespace-nowrap">{fmt(e.create_date)}</span>
                                </div>
                            </button>
                            <button
                                onClick={(ev) => { ev.stopPropagation(); deleteEmail(e.id, e.subject); }}
                                title="Elimina email"
                                className="px-4 flex items-center text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-r-2xl"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* DETAIL MODAL */}
            {emailDetail && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setEmailDetail(null)}>
                    <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={(ev) => ev.stopPropagation()}>
                        <div className="p-5 border-b border-gray-100 flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                                <h2 className="text-lg font-bold text-[#1a2744] truncate">{emailDetail.subject || '(nessun oggetto)'}</h2>
                                <p className="text-sm text-gray-500 mt-1">
                                    Da: <span className="font-medium">{emailDetail.sender_email || '—'}</span> · {fmt(emailDetail.create_date)}
                                </p>
                            </div>
                            <button onClick={() => setEmailDetail(null)} className="text-gray-400 hover:text-gray-700"><X size={20} /></button>
                        </div>

                        {emailDetailLoading && (
                            <div className="p-8 text-center"><Loader2 size={24} className="animate-spin text-blue-500 mx-auto" /></div>
                        )}

                        {!emailDetailLoading && (
                            <div className="p-5 overflow-y-auto flex-1">
                                <div
                                    className="prose max-w-none text-sm"
                                    dangerouslySetInnerHTML={{ __html: emailDetail.body || '<p class="text-gray-400 italic">(nessun corpo)</p>' }}
                                />
                            </div>
                        )}

                        <div className="p-4 border-t border-gray-100 flex items-center gap-2">
                            <button
                                onClick={() => { openComposer(emailDetail.id, 'reply'); }}
                                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
                            >
                                <CornerUpLeft size={14} /> Rispondi
                            </button>
                            <button
                                onClick={() => { openComposer(emailDetail.id, 'replyAll'); }}
                                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium hover:bg-gray-50"
                            >
                                <ReplyAll size={14} /> Rispondi a tutti
                            </button>
                            <button
                                onClick={() => { openComposer(emailDetail.id, 'forward'); }}
                                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium hover:bg-gray-50"
                            >
                                <CornerUpRight size={14} /> Inoltra
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* COMPOSER MODAL */}
            {composer && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => !composerSending && setComposer(null)}>
                    <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={(ev) => ev.stopPropagation()}>
                        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
                            <h2 className="text-lg font-bold text-[#1a2744]">
                                {composer.mode === 'new' ? 'Nuova email'
                                    : composer.mode === 'forward' ? 'Inoltra email'
                                    : composer.mode === 'replyAll' ? 'Rispondi a tutti'
                                    : 'Rispondi'}
                            </h2>
                            <button onClick={() => !composerSending && setComposer(null)} className="text-gray-400 hover:text-gray-700"><X size={20} /></button>
                        </div>
                        <div className="p-5 overflow-y-auto flex-1 space-y-3">
                            <div>
                                <label className="text-xs font-semibold text-gray-500 uppercase">Da</label>
                                <input
                                    type="text"
                                    value={composer.from_email || ''}
                                    readOnly
                                    className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-gray-500 uppercase">A</label>
                                <input
                                    type="text"
                                    value={composer.to || ''}
                                    onChange={(e) => setComposer({ ...composer, to: e.target.value })}
                                    className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 text-sm"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-gray-500 uppercase">Cc</label>
                                <input
                                    type="text"
                                    value={composer.cc || ''}
                                    onChange={(e) => setComposer({ ...composer, cc: e.target.value })}
                                    className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 text-sm"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-gray-500 uppercase">Oggetto</label>
                                <input
                                    type="text"
                                    value={composer.subject || ''}
                                    onChange={(e) => setComposer({ ...composer, subject: e.target.value })}
                                    className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 text-sm"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-gray-500 uppercase">Corpo (HTML)</label>
                                <textarea
                                    rows={12}
                                    value={composer.body || ''}
                                    onChange={(e) => setComposer({ ...composer, body: e.target.value })}
                                    className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 text-sm font-mono"
                                />
                            </div>
                        </div>
                        <div className="p-4 border-t border-gray-100 flex items-center justify-end gap-2">
                            <button
                                onClick={() => !composerSending && setComposer(null)}
                                className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium hover:bg-gray-50"
                            >
                                Annulla
                            </button>
                            <button
                                onClick={handleComposerSend}
                                disabled={composerSending}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                            >
                                {composerSending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                                Invia
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
