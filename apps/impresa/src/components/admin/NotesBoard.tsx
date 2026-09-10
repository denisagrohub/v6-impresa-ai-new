"use client";
import { useEffect, useState } from "react";
import { ClipboardList, Loader2, Send } from "lucide-react";

interface Note {
    id: number;
    note_type: 'brief' | 'debrief' | 'nota';
    title: string;
    body: string;
    author: string;
    create_date: string;
}

const TYPE_LABEL: Record<string, string> = { brief: '📋 Brief', debrief: '📝 Debrief', nota: '🗒️ Nota' };

// 10/09/2026 (Denis: "la lavagna deve essere più una lavagna di lavoro
// immediata e funzionale") - niente più bottone "+Aggiungi" che nasconde
// il form: la barra di scrittura è sempre visibile in cima, come una
// vera lavagna. onSendEmail (opzionale, fornito dalla pagina che sa come
// spedire per QUEL tipo di progetto - i meccanismi di invio sono diversi
// tra Progetti Partner e Progetti) aggiunge un bottone "Invia ai
// partecipanti" su ogni nota (Denis: "dopo un brief/debrief... la
// possibilità di inviare la email ai partecipanti").
export default function NotesBoard({
    resModel,
    resId,
    onSendEmail,
}: {
    resModel: string;
    resId: number;
    onSendEmail?: (note: Note) => Promise<{ ok: boolean; text: string }>;
}) {
    const [notes, setNotes] = useState<Note[]>([]);
    const [loading, setLoading] = useState(true);
    const [noteType, setNoteType] = useState<'brief' | 'debrief' | 'nota'>('nota');
    const [title, setTitle] = useState("");
    const [body, setBody] = useState("");
    const [saving, setSaving] = useState(false);
    const [sendingId, setSendingId] = useState<number | null>(null);
    const [sendResult, setSendResult] = useState<Record<number, string>>({});

    const load = async () => {
        try {
            const res = await fetch(`/api/admin/notes?resModel=${encodeURIComponent(resModel)}&resId=${resId}`);
            const data = await res.json();
            if (data.success) setNotes(data.notes || []);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, [resModel, resId]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!body.trim()) return;
        setSaving(true);
        try {
            const res = await fetch('/api/admin/notes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ resModel, resId, noteType, title, body }),
            });
            const data = await res.json();
            if (data.success) setNotes(data.notes || []);
            setTitle(""); setBody("");
        } finally {
            setSaving(false);
        }
    };

    const handleSend = async (note: Note) => {
        if (!onSendEmail) return;
        setSendingId(note.id);
        try {
            const result = await onSendEmail(note);
            setSendResult((prev) => ({ ...prev, [note.id]: result.text }));
        } finally {
            setSendingId(null);
        }
    };

    return (
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <h3 className="text-sm font-bold text-[#1a2744] mb-3 flex items-center gap-2">
                <ClipboardList size={16} className="text-blue-500" /> Lavagna di Lavoro
            </h3>

            <form onSubmit={handleSubmit} className="mb-5 border border-gray-200 rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 border-b border-gray-200">
                    <select value={noteType} onChange={(e) => setNoteType(e.target.value as any)}
                        className="px-2 py-1 rounded border border-gray-200 text-xs bg-white">
                        <option value="nota">🗒️ Nota</option>
                        <option value="brief">📋 Brief</option>
                        <option value="debrief">📝 Debrief</option>
                    </select>
                    <input
                        placeholder="Titolo (opzionale)"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="flex-1 px-2 py-1 rounded border border-gray-200 text-xs"
                    />
                </div>
                <textarea
                    rows={3}
                    placeholder="Scrivi qui: appunti della call, punti emersi, informazioni utili..."
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    className="w-full px-3 py-2 text-sm focus:outline-none resize-y"
                />
                <div className="flex justify-end px-3 py-2 bg-gray-50 border-t border-gray-200">
                    <button type="submit" disabled={saving || !body.trim()} className="px-4 py-1.5 rounded bg-[#1a2744] text-white text-xs font-medium disabled:opacity-40">
                        {saving ? 'Salvo...' : 'Aggiungi alla lavagna'}
                    </button>
                </div>
            </form>

            {loading ? (
                <Loader2 size={18} className="animate-spin text-gray-400" />
            ) : notes.length === 0 ? (
                <p className="text-sm text-gray-400">Ancora nulla in lavagna.</p>
            ) : (
                <div className="space-y-3 max-h-[28rem] overflow-y-auto">
                    {notes.map((n) => (
                        <div key={n.id} className="border border-gray-100 rounded-lg p-3">
                            <div className="flex items-start justify-between gap-2 mb-1">
                                <span className="text-xs font-semibold text-[#1a2744]">{TYPE_LABEL[n.note_type]}{n.title ? ` — ${n.title}` : ''}</span>
                                <span className="text-xs text-gray-400 whitespace-nowrap">{n.author} · {n.create_date ? new Date(n.create_date).toLocaleString('it-IT') : ''}</span>
                            </div>
                            <p className="text-sm text-gray-600 whitespace-pre-wrap mb-2">{n.body}</p>
                            {onSendEmail && (
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => handleSend(n)}
                                        disabled={sendingId === n.id}
                                        className="flex items-center gap-1 text-xs text-[#1a2744] font-semibold hover:underline disabled:opacity-50"
                                    >
                                        <Send size={12} /> {sendingId === n.id ? 'Invio...' : 'Invia ai partecipanti'}
                                    </button>
                                    {sendResult[n.id] && <span className="text-xs text-gray-500">{sendResult[n.id]}</span>}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
