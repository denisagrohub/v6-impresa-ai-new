"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    ArrowLeft, Loader2, RefreshCw, Plus, Trash2, X, Send,
    CornerUpLeft, CornerUpRight, ReplyAll,
, Archive, ArchiveRestore } from "lucide-react";
import EmailAttachmentsInput, { AttachedFile } from "@/components/EmailAttachmentsInput";
import EmailRecipientInput from "@/components/EmailRecipientInput";

export default function AdminMiaEmailPage() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const [emailsData, setEmailsData] = useState<any>(null);
    const [emailFolder, setEmailFolder] = useState<"all" | "ricevute" | "inviate">("all");
    const [unreadCount, setUnreadCount] = useState(0);
    const [emailSearch, setEmailSearch] = useState('');
    const [emailArchivedView, setEmailArchivedView] = useState(false);
    const [emailProjectFilter, setEmailProjectFilter] = useState<string>('');
    const [emailsLoading, setEmailsLoading] = useState(false);
    const [emailDetail, setEmailDetail] = useState<any>(null);
    const [emailDetailLoading, setEmailDetailLoading] = useState(false);
    const [emailAttachments, setEmailAttachments] = useState<{id:number;name:string;mimetype?:string;size?:number}[]>([]);
    const [composer, setComposer] = useState<any>(null);
    const [composerSending, setComposerSending] = useState(false);
    const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);

    useEffect(() => {
        const session = localStorage.getItem("pi_session");
        if (!session) { router.push("/login"); return; }
        const u = JSON.parse(session);
        setUser(u);
        setLoading(false);
    }, [router]);

    useEffect(() => { if (user?.token) { loadEmails(); loadUnread(); } }, [user, emailArchivedView]);

    useEffect(() => {
        if (!user?.token) return;
        const t = setInterval(() => { loadEmails(); loadUnread(); }, 60000);
        return () => clearInterval(t);
    }, [user, emailArchivedView]);

    const loadEmails = async () => {
        if (!user?.token) return;
        setEmailsLoading(true);
        try {
            const res = await fetch('/api/consultant/emails?' + (emailArchivedView ? 'archived=1&' : '') + 'all=1', {
                headers: { Authorization: `JWT ${user.token}` },
            });
            const data = await res.json();
            setEmailsData(data);
        } catch {
            setEmailsData({ emails: [], error: 'Errore di rete' });
        } finally { setEmailsLoading(false); }
    };

    // 22/09/2026: lista progetti unici (relation_id) dalle email caricate
    const projectOptions = (() => {
        const map = new Map<number, string>();
        (emailsData?.emails || []).forEach((e: any) => {
            if (e.relation_id && e.relation_name) map.set(e.relation_id, e.relation_name);
        });
        return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
    })();

    const loadUnread = async () => {
        if (!user?.token) return;
        try {
            const res = await fetch('/api/consultant/emails/unread-count', {
                headers: { Authorization: `JWT ${user.token}` },
            });
            const d = await res.json();
            setUnreadCount(d.unread || 0);
        } catch { /* best effort */ }
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
            fetch(`/api/consultant/emails/${id}/mark-read`, {
                method: 'POST',
                headers: { Authorization: `JWT ${user.token}` },
            }).then(() => { loadEmails(); loadUnread(); }).catch(() => {});
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
        const sigKey = `email_signature_${user?.emailSlug || user?.email || 'default'}`;
        const savedSig = typeof window !== 'undefined' ? localStorage.getItem(sigKey) : null;
        setComposer({ mode: 'new', from_email: fromEmail, to: '', cc: '', bcc: '', subject: '', body: savedSig || '' });
    };

    const archiveEmail = async (id: number) => {
        if (!user?.token) return;
        try {
            const res = await fetch(`/api/consultant/emails/${id}/archive`, {
                method: 'POST', headers: { Authorization: `JWT ${user.token}` },
            });
            if (!res.ok) { const d = await res.json().catch(() => ({})); alert(d.error || 'Archiviazione fallita'); return; }
            if (emailDetail?.id === id) setEmailDetail(null);
            loadEmails();
        } catch { alert('Errore di rete'); }
    };

    const unarchiveEmail = async (id: number) => {
        if (!user?.token) return;
        try {
            const res = await fetch(`/api/consultant/emails/${id}/unarchive`, {
                method: 'POST', headers: { Authorization: `JWT ${user.token}` },
            });
            if (!res.ok) { const d = await res.json().catch(() => ({})); alert(d.error || 'Operazione fallita'); return; }
            loadEmails();
        } catch { alert('Errore di rete'); }
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

    const suggestAIReply = async () => {
        if (!composer?.in_reply_to_id || !emailDetail) { alert('Funziona solo su una risposta.'); return; }
        try {
            const res = await fetch('/api/admin/assistant/suggest-reply', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    resModel: 'erpv6.winwin.email.log',
                    resId: composer.in_reply_to_id,
                    emailLogId: composer.in_reply_to_id,
                    agentCode: 'susanna',
                }),
            });
            const d = await res.json();
            if (!res.ok || !d.success) { alert(d.error || 'Suggerimento fallito'); return; }
            const draft = typeof d.draft === 'string' ? d.draft : (d.draft?.text || JSON.stringify(d.draft));
            setComposer({ ...composer, body: (composer.body || '') + '<br/><br/>' + draft });
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
            const localFiles = await Promise.all(
                attachedFiles.filter((f) => f.source === 'local' && f.fileRaw).map(async (f) => ({
                    fileName: f.name,
                    mimetype: f.fileRaw!.type,
                    fileBase64: await new Promise<string>((resolve, reject) => {
                        const r = new FileReader();
                        r.onload = () => resolve((r.result as string).split(',')[1] || '');
                        r.onerror = reject;
                        r.readAsDataURL(f.fileRaw!);
                    }),
                }))
            );
            const attachments = [
                ...localFiles,
                ...attachedFiles.filter((f) => f.source === 'library' && f.id).map((f) => ({ attachmentId: f.id })),
            ];
            const res = await fetch('/api/consultant/emails/send', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `JWT ${user.token}`,
                },
                body: JSON.stringify({ ...composer, attachments }),
            });
            });
            const data = await res.json();
            if (!res.ok || data?.error) {
                alert(data?.error || 'Invio fallito');
                return;
            }
            setComposer(null);
            setAttachedFiles([]);
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

                <div className="flex items-center gap-3 flex-wrap mt-4">
                    <div className="flex items-center gap-1 border-b border-gray-200 flex-1 min-w-[300px]">
                        {(["all", "ricevute", "inviate"] as const).map((f) => (
                            <button
                                key={f}
                                onClick={() => { setEmailFolder(f); setEmailArchivedView(false); }}
                                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                                    !emailArchivedView && emailFolder === f
                                        ? "border-blue-600 text-blue-700"
                                        : "border-transparent text-gray-500 hover:text-gray-800"
                                }`}
                            >
                                {f === "all" ? "Tutte" : f === "ricevute" ? "Ricevute" : "Inviate"}
                            </button>
                        ))}
                        <button
                            onClick={() => setEmailArchivedView(true)}
                            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                                emailArchivedView
                                    ? "border-blue-600 text-blue-700"
                                    : "border-transparent text-gray-500 hover:text-gray-800"
                            }`}
                        >
                            Archiviate
                        </button>
                    </div>
                    <input
                        type="text"
                        placeholder="Cerca oggetto o mittente…"
                        value={emailSearch}
                        onChange={(ev) => setEmailSearch(ev.target.value)}
                        className="px-3 py-2 rounded-lg border border-gray-200 text-sm w-56"
                    />
                    {projectOptions.length > 0 && (
                        <select
                            value={emailProjectFilter}
                            onChange={(ev) => setEmailProjectFilter(ev.target.value)}
                            className="px-3 py-2 rounded-lg border border-gray-200 text-sm max-w-[220px]"
                        >
                            <option value="">Tutti i progetti</option>
                            {projectOptions.map((p) => (
                                <option key={p.id} value={String(p.id)}>{p.name}</option>
                            ))}
                        </select>
                    )}
                </div>

                {emailsLoading && !emailsData && (
                    <div className="flex items-center gap-2 text-gray-500 text-sm mt-4">
                        <Loader2 size={16} className="animate-spin" /> Carico le email...
                    </div>
                )}

                {emailsData && emailsData.emails?.length === 0 && (
                    <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-500">
                        Nessuna email.
                    </div>
                )}

                <div className="space-y-3">
                    {emailsData && emailsData.emails?.filter((e: any) => {
                            const q = emailSearch.trim().toLowerCase();
                            const matchesSearch = !q || (e.subject || '').toLowerCase().includes(q) || (e.sender_email || '').toLowerCase().includes(q);
                            const matchesProject = !emailProjectFilter || String(e.relation_id || '') === emailProjectFilter;
                            if (emailArchivedView) return matchesSearch && matchesProject;
                            const matchesFolder = emailFolder === "all" || e.direction === emailFolder;
                            return matchesSearch && matchesFolder && matchesProject;
                        }).map((e: any) => (
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
                                        <h3 className="font-bold text-[#1a2744] truncate flex items-center gap-2">
                                            {!e.is_read && e.direction === 'ricevuta' && (
                                                <span className="inline-block w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                                            )}
                                            <span className="truncate">{e.subject}</span>
                                            {e.has_attachments && <span title="Contiene allegati">📎</span>}
                                        </h3>
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
                            {!emailArchivedView ? (
                                <button
                                    onClick={(ev) => { ev.stopPropagation(); archiveEmail(e.id); }}
                                    title="Archivia"
                                    className="px-3 flex items-center text-gray-400 hover:text-amber-600 hover:bg-amber-50"
                                >
                                    <Archive size={16} />
                                </button>
                            ) : (
                                <button
                                    onClick={(ev) => { ev.stopPropagation(); unarchiveEmail(e.id); }}
                                    title="Ripristina"
                                    className="px-3 flex items-center text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                                >
                                    <ArchiveRestore size={16} />
                                </button>
                            )}
                            <button
                                onClick={(ev) => { ev.stopPropagation(); deleteEmail(e.id, e.subject); }}
                                title="Elimina definitivamente"
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
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => { setEmailDetail(null); setEmailAttachments([]); }}>
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

                        {emailAttachments.length > 0 && (
                            <div className="px-5 pb-3 border-t border-gray-100">
                                <p className="text-xs font-semibold text-gray-500 uppercase mt-3 mb-2">Allegati ({emailAttachments.length})</p>
                                <div className="space-y-1">
                                    {emailAttachments.map((a) => (
                                        <a key={a.id}
                                            href={`/api/admin/attachments/${a.id}/download`}
                                            target="_blank" rel="noopener noreferrer"
                                            className="flex items-center justify-between text-sm bg-gray-50 hover:bg-gray-100 border border-gray-100 rounded px-3 py-2">
                                            <span className="truncate">📎 {a.name}</span>
                                            <span className="text-xs text-gray-400 ml-2">{a.size ? Math.round(a.size / 1024) + ' KB' : ''}</span>
                                        </a>
                                    ))}
                                </div>
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
                                <div className="mt-1">
                                    <EmailRecipientInput
                                        value={composer.to || ''}
                                        onChange={(v) => setComposer({ ...composer, to: v })}
                                        placeholder="Cerca nome o email…"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-gray-500 uppercase">Cc</label>
                                <div className="mt-1">
                                    <EmailRecipientInput
                                        value={composer.cc || ''}
                                        onChange={(v) => setComposer({ ...composer, cc: v })}
                                        placeholder="Cerca nome o email…"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-gray-500 uppercase">Bcc</label>
                                <div className="mt-1">
                                    <EmailRecipientInput
                                        value={composer.bcc || ''}
                                        onChange={(v) => setComposer({ ...composer, bcc: v })}
                                        placeholder="Cerca nome o email…"
                                    />
                                </div>
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
                                <EmailAttachmentsInput
                                    value={attachedFiles}
                                    onChange={setAttachedFiles}
                                    relationId={undefined}
                                    userToken={user?.token}
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
                            {composer.mode !== 'new' && composer.in_reply_to_id && (
                                <button
                                    type="button"
                                    onClick={suggestAIReply}
                                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-purple-200 text-purple-700 text-sm font-medium hover:bg-purple-50"
                                    title="Suggerisci risposta con AI (Susanna)"
                                >
                                    ✨ Suggerisci
                                </button>
                            )}
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
