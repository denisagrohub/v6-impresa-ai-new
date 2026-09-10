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

// 10/09/2026 (Denis: "la immagino come una lavagna dove scrivi e quando
// salvi appare un post it che lo posizioni sulla lavagna e ha colori
// diversi in base a cosa è"): un colore per tipo, sempre lo stesso -
// non decorativo, e' l'unico modo per riconoscere un Brief da un
// Debrief a colpo d'occhio senza leggere il badge.
const TYPE_STYLE: Record<string, { bg: string; badge: string; label: string }> = {
    brief: { bg: 'bg-blue-100', badge: 'bg-blue-500 text-white', label: '📋 Brief' },
    debrief: { bg: 'bg-green-100', badge: 'bg-green-600 text-white', label: '📝 Debrief' },
    nota: { bg: 'bg-yellow-100', badge: 'bg-yellow-500 text-white', label: '🗒️ Nota' },
};
// Rotazione leggera e fissa per posizione (non casuale ad ogni render,
// altrimenti "salta" ad ogni salvataggio) - effetto post-it senza
// disordine.
const ROTATIONS = ['-rotate-1', 'rotate-1', 'rotate-0', 'rotate-1', '-rotate-1', 'rotate-0'];

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
    const [justAddedId, setJustAddedId] = useState<number | null>(null);

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
            if (data.success) {
                const newNotes = data.notes || [];
                setNotes(newNotes);
                if (newNotes.length) {
                    setJustAddedId(newNotes[0].id);
                    setTimeout(() => setJustAddedId(null), 600);
                }
            }
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
            <style jsx global>{`
                @keyframes postit-pop {
                    0% { transform: scale(0.85) translateY(8px); opacity: 0; }
                    100% { transform: scale(1) translateY(0); opacity: 1; }
                }
                .postit-pop { animation: postit-pop 0.35s ease-out; }
            `}</style>

            <h3 className="text-sm font-bold text-[#1a2744] mb-3 flex items-center gap-2">
                <ClipboardList size={16} className="text-blue-500" /> Lavagna di Lavoro
            </h3>

            <form onSubmit={handleSubmit} className="mb-6 border border-gray-200 rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 border-b border-gray-200">
                    <select value={noteType} onChange={(e) => setNoteType(e.target.value as any)}
                        className="px-2 py-1 rounded border border-gray-200 text-xs bg-white font-medium">
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
                <div className="rounded-xl bg-[#f5f1e8] border border-dashed border-gray-200 p-8 text-center">
                    <p className="text-sm text-gray-400">Ancora nulla in lavagna. Il primo post-it apparirà qui.</p>
                </div>
            ) : (
                <div className="rounded-xl bg-[#f5f1e8] border border-gray-100 p-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[32rem] overflow-y-auto p-1">
                        {notes.map((n, i) => {
                            const style = TYPE_STYLE[n.note_type] || TYPE_STYLE.nota;
                            return (
                                <div
                                    key={n.id}
                                    className={`${style.bg} ${ROTATIONS[i % ROTATIONS.length]} ${justAddedId === n.id ? 'postit-pop' : ''} rounded-sm shadow-md p-4 flex flex-col hover:rotate-0 hover:shadow-lg transition-transform`}
                                >
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                        <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${style.badge}`}>{style.label}</span>
                                    </div>
                                    {n.title && <div className="text-sm font-bold text-[#1a2744] mb-1">{n.title}</div>}
                                    <p className="text-sm text-gray-700 whitespace-pre-wrap mb-3 flex-1">{n.body}</p>
                                    <div className="text-xs text-gray-500 mb-2">{n.author} · {n.create_date ? new Date(n.create_date).toLocaleString('it-IT') : ''}</div>
                                    {onSendEmail && (
                                        <div className="flex items-center gap-2 pt-2 border-t border-black/10">
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
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
