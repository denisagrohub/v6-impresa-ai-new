"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { Loader2, ArrowLeft, Mail, Send, ChevronDown, ChevronUp, UserPlus, Sparkles } from "lucide-react";
import HeinrichPanel from "@/components/admin/HeinrichPanel";
import NotesBoard from "@/components/admin/NotesBoard";
import AssistantChat from "@/components/admin/AssistantChat";

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
    direction: 'ricevuta' | 'inviata';
    date: string;
}

// 10/09/2026 (Denis: "fai una analisi della pagina dei dettagli di
// tutti i progetti per renderla una suite di lavoro, non un elenco di
// caselle") - layout a due colonne: principale = lavoro attivo (lavagna
// + email ricevute), laterale = contesto/azioni (parti collegate con
// affidabilità, invio email). NotesBoard.onSendEmail spedisce a TUTTE
// le parti collegate con un partner reale (stesso wizard gia' costruito
// oggi, nessuna nuova logica di invio).
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
    const [suggestingId, setSuggestingId] = useState<number | null>(null);
    const [suggestError, setSuggestError] = useState<string | null>(null);

    const [selectedPartnerIds, setSelectedPartnerIds] = useState<number[]>([]);
    const [extraEmails, setExtraEmails] = useState("");
    const [subject, setSubject] = useState("");
    const [message, setMessage] = useState("");
    const [sending, setSending] = useState(false);
    const [sendResult, setSendResult] = useState<{ ok: boolean; text: string } | null>(null);

    const [showAddPart, setShowAddPart] = useState(false);
    const [partName, setPartName] = useState("");
    const [partEmail, setPartEmail] = useState("");
    const [partPhone, setPartPhone] = useState("");
    const [partRuolo, setPartRuolo] = useState("");
    const [partMandato, setPartMandato] = useState("");
    const [savingPart, setSavingPart] = useState(false);
    const [addPartError, setAddPartError] = useState<string | null>(null);

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
            router.push("/login");
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

    // 10/09/2026 (Denis: "manca la parte di susanna nell'analisi delle
    // email di ogni progetto partner... susanna che consiglia le
    // risposte", già discusso in precedenza) - propone un testo pronto
    // da rivedere, mai inviato in automatico: precompila il form di
    // invio già esistente sotto, l'admin lo rivede/modifica e invia lui.
    const handleSuggestReply = async (e: EmailLog) => {
        setSuggestingId(e.id);
        setSuggestError(null);
        try {
            const res = await fetch('/api/admin/assistant/suggest-reply', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ resModel: 'erpv6.tracking.relation', resId: Number(id), emailLogId: e.id }),
            });
            const data = await res.json();
            if (data.success) {
                setSubject(e.subject?.toLowerCase().startsWith('re:') ? e.subject : `Re: ${e.subject || ''}`);
                setMessage(data.draft);
            } else {
                setSuggestError(data.error || 'Suggerimento fallito');
            }
        } catch (err: any) {
            setSuggestError(err.message || 'Errore di rete');
        } finally {
            setSuggestingId(null);
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

    const handleAddPart = async (e: React.FormEvent) => {
        e.preventDefault();
        setSavingPart(true);
        setAddPartError(null);
        try {
            const res = await fetch(`/api/admin/partner-projects/${id}/parts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: partName, email: partEmail, phone: partPhone, ruolo: partRuolo || undefined, mandato: partMandato || undefined }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                setAddPartError(data.error || 'Creazione fallita');
                return;
            }
            setPartName(""); setPartEmail(""); setPartPhone(""); setPartRuolo(""); setPartMandato("");
            setShowAddPart(false);
            load();
        } catch (err: any) {
            setAddPartError(err.message || 'Errore di rete');
        } finally {
            setSavingPart(false);
        }
    };

    const handleNoteSendEmail = async (note: { title: string; body: string; note_type: string }) => {
        const recipientIds = partners.map((p) => p.partnerId).filter((x): x is number => x != null);
        if (!recipientIds.length) {
            return { ok: false, text: 'Nessuna parte collegata con un contatto valido.' };
        }
        const res = await fetch(`/api/admin/partner-projects/${id}/send-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                partnerIds: recipientIds,
                subject: note.title || (note.note_type === 'brief' ? 'Brief progetto' : note.note_type === 'debrief' ? 'Debrief progetto' : 'Aggiornamento progetto'),
                message: `<p>${note.body.replace(/\n/g, '<br/>')}</p>`,
            }),
        });
        const data = await res.json();
        return data.success ? { ok: true, text: `Inviata a ${recipientIds.length} parti.` } : { ok: false, text: data.error || 'Invio fallito' };
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
            <div className="w-full px-4 sm:px-6 lg:px-8 py-8">
                <Link href="/admin/partner-projects" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 mb-4">
                    <ArrowLeft size={16} /> Torna ai progetti
                </Link>

                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-[#1a2744]">{project?.name}</h1>
                    {project?.emailAlias && (
                        <p className="text-gray-500 flex items-center gap-1 mt-1 text-sm"><Mail size={14} /> {project.emailAlias}</p>
                    )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px_380px] gap-6 items-start">
                    {/* Colonna 1: lavoro attivo */}
                    <div className="space-y-6 min-w-0">
                        <div className="bg-white rounded-2xl border border-gray-100 p-6">
                            <h2 className="text-sm font-bold text-[#1a2744] mb-4">Cronologia Email</h2>
                            {suggestError && <p className="text-xs text-red-600 mb-3">{suggestError}</p>}
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
                                                    <div className="flex items-center gap-2">
                                                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${e.direction === 'inviata' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                                                            {e.direction === 'inviata' ? '📤 Inviata' : '📥 Ricevuta'}
                                                        </span>
                                                        <div className="text-sm font-semibold text-[#1a2744]">{e.subject}</div>
                                                    </div>
                                                    <div className="text-xs text-gray-500 mt-0.5">
                                                        {e.direction === 'inviata' ? `a: ${e.recipientEmails}` : `da: ${e.senderEmail}`} · {e.date ? new Date(e.date).toLocaleString('it-IT') : ''}
                                                    </div>
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
                                                    {e.direction === 'ricevuta' && (
                                                        <button
                                                            onClick={() => handleSuggestReply(e)}
                                                            disabled={suggestingId === e.id}
                                                            className="mt-2 flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-purple-600 text-white font-medium hover:bg-purple-700 disabled:opacity-40"
                                                        >
                                                            <Sparkles size={12} /> {suggestingId === e.id ? 'Preparo la bozza...' : 'Suggerisci risposta (Susanna)'}
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Colonna 2: parti collegate + invio */}
                    <div className="space-y-6 min-w-0">
                        {project && <AssistantChat resModel="erpv6.tracking.relation" resId={project.id} />}

                        <div className="bg-white rounded-2xl border border-gray-100 p-5">
                            <div className="flex items-center justify-between mb-3">
                                <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wide">Parti Collegate</h2>
                                <button onClick={() => setShowAddPart(!showAddPart)} className="text-[#1a2744]" title="Aggiungi Parte Collegata">
                                    <UserPlus size={16} />
                                </button>
                            </div>

                            {showAddPart && (
                                <form onSubmit={handleAddPart} className="bg-gray-50 rounded-xl p-3 mb-4 space-y-2">
                                    <input required placeholder="Nome *" value={partName} onChange={(e) => setPartName(e.target.value)}
                                        className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-xs" />
                                    <input type="email" placeholder="Email" value={partEmail} onChange={(e) => setPartEmail(e.target.value)}
                                        className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-xs" />
                                    <input placeholder="Telefono" value={partPhone} onChange={(e) => setPartPhone(e.target.value)}
                                        className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-xs" />
                                    <select value={partRuolo} onChange={(e) => setPartRuolo(e.target.value)}
                                        className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-xs bg-white">
                                        <option value="">Ruolo —</option>
                                        <option value="gestore">Gestore</option>
                                        <option value="parte_attiva">Parte Attiva</option>
                                        <option value="osservatore">Osservatore</option>
                                    </select>
                                    <select value={partMandato} onChange={(e) => setPartMandato(e.target.value)}
                                        className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-xs bg-white">
                                        <option value="">Mandato —</option>
                                        <option value="pieno">Pieno</option>
                                        <option value="parziale">Parziale</option>
                                        <option value="nessuno">Nessuno</option>
                                        <option value="non_applicabile">Non Applicabile</option>
                                    </select>
                                    {addPartError && <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2">{addPartError}</div>}
                                    <button type="submit" disabled={savingPart}
                                        className="w-full px-3 py-1.5 rounded-lg bg-[#1a2744] text-white text-xs font-medium disabled:opacity-50">
                                        {savingPart ? 'Salvo...' : 'Aggiungi'}
                                    </button>
                                </form>
                            )}

                            {partners.length === 0 ? (
                                <p className="text-sm text-gray-400">Nessuna parte collegata ancora.</p>
                            ) : (
                                <div className="space-y-3">
                                    {partners.map((p) => (
                                        <div key={p.id} className="border border-gray-100 rounded-lg p-3">
                                            <div className="text-sm font-semibold text-[#1a2744] mb-1">
                                                {p.partnerName || p.name}
                                                {p.ruolo && <span className="ml-2 text-xs text-gray-400 font-normal">({p.ruolo.replace('_', ' ')})</span>}
                                            </div>
                                            <HeinrichPanel resModel="erpv6.tracking.relation" resId={p.id} compact />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="bg-white rounded-2xl border border-gray-100 p-5">
                            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Invia Email dal Progetto</h2>
                            <form onSubmit={handleSend} className="space-y-3">
                                {partners.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5">
                                        {partners.map((p) => (
                                            <label
                                                key={p.id}
                                                className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-xs cursor-pointer ${selectedPartnerIds.includes(p.partnerId || -1) ? 'border-[#1a2744] bg-blue-50' : 'border-gray-200'}`}
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
                                )}
                                <input
                                    type="text"
                                    value={extraEmails}
                                    onChange={(e) => setExtraEmails(e.target.value)}
                                    className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-xs"
                                    placeholder="Altri destinatari (email, virgola)"
                                />
                                <input
                                    type="text"
                                    required
                                    value={subject}
                                    onChange={(e) => setSubject(e.target.value)}
                                    className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-xs"
                                    placeholder="Oggetto"
                                />
                                <textarea
                                    required
                                    rows={4}
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-xs"
                                    placeholder="Messaggio"
                                />
                                {sendResult && (
                                    <div className={`rounded-lg p-2 text-xs ${sendResult.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                                        {sendResult.text}
                                    </div>
                                )}
                                <button
                                    type="submit"
                                    disabled={sending}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[#1a2744] text-white text-sm font-medium hover:bg-[#0f3460] disabled:opacity-50"
                                >
                                    {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                                    Invia
                                </button>
                            </form>
                        </div>
                    </div>

                    {/* Colonna 3: lavagna di lavoro */}
                    <div className="lg:sticky lg:top-8 lg:h-[calc(100vh-4rem)] min-w-0">
                        {project && (
                            <NotesBoard resModel="erpv6.tracking.relation" resId={project.id} onSendEmail={handleNoteSendEmail} />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
