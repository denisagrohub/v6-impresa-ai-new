"use client";
import { useEffect, useRef, useState } from "react";
import { ClipboardList, Loader2, Send, GripVertical, Sparkles } from "lucide-react";

interface Note {
    id: number;
    note_type: 'brief' | 'debrief' | 'nota' | 'analisi';
    title: string;
    body: string;
    author: string;
    create_date: string;
    sequence: number;
}

// 10/09/2026 (Denis: "la immagino come una lavagna dove scrivi e quando
// salvi appare un post it... colori diversi in base a cosa è"): un
// colore per tipo, sempre lo stesso. 'analisi' aggiunto lo stesso
// giorno (Denis: "dare in pasto a metodology tutta la lavagna e avere
// un responso") - mai scritto da una persona, solo da analyze_board().
const TYPE_STYLE: Record<string, { bg: string; badge: string; label: string }> = {
    brief: { bg: 'bg-blue-100', badge: 'bg-blue-500 text-white', label: '📋 Brief' },
    debrief: { bg: 'bg-green-100', badge: 'bg-green-600 text-white', label: '📝 Debrief' },
    nota: { bg: 'bg-yellow-100', badge: 'bg-yellow-500 text-white', label: '🗒️ Nota' },
    analisi: { bg: 'bg-purple-100', badge: 'bg-purple-600 text-white', label: '✨ Analisi Metodologica' },
};
const ROTATIONS = ['-rotate-1', 'rotate-1', 'rotate-0'];

// 10/09/2026 (Denis: "i post it si appendono sulla destra e posso
// modificare l'ordine prendendoli con il mouse"): colonna verticale
// stretta (vive nella terza colonna dedicata della pagina, non piu' una
// griglia larga), drag&drop nativo HTML5 per riordinare - l'ordine si
// salva davvero (sequence su erpv6.project.note), non solo visivo.
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
    const [dragOverId, setDragOverId] = useState<number | null>(null);
    const dragIdRef = useRef<number | null>(null);
    const [analyzing, setAnalyzing] = useState(false);
    const [analyzeError, setAnalyzeError] = useState<string | null>(null);

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

    const handleAnalyze = async () => {
        setAnalyzing(true);
        setAnalyzeError(null);
        try {
            const res = await fetch('/api/admin/notes/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ resModel, resId }),
            });
            const data = await res.json();
            if (data.success) {
                setNotes(data.notes || []);
                if (data.notes?.length) {
                    setJustAddedId(data.notes[0].id);
                    setTimeout(() => setJustAddedId(null), 600);
                }
            } else {
                setAnalyzeError(data.error || 'Analisi fallita');
            }
        } finally {
            setAnalyzing(false);
        }
    };

    const persistOrder = async (ordered: Note[]) => {
        try {
            await fetch('/api/admin/notes/reorder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderedIds: ordered.map((n) => n.id) }),
            });
        } catch { /* riordino best-effort, il prossimo load() risincronizza se fallito */ }
    };

    const handleDrop = (targetId: number) => {
        const draggedId = dragIdRef.current;
        dragIdRef.current = null;
        setDragOverId(null);
        if (draggedId == null || draggedId === targetId) return;

        setNotes((prev) => {
            const draggedIndex = prev.findIndex((n) => n.id === draggedId);
            const targetIndex = prev.findIndex((n) => n.id === targetId);
            if (draggedIndex === -1 || targetIndex === -1) return prev;
            const next = [...prev];
            const [moved] = next.splice(draggedIndex, 1);
            next.splice(targetIndex, 0, moved);
            persistOrder(next);
            return next;
        });
    };

    return (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 h-full flex flex-col">
            <style jsx global>{`
                @keyframes postit-pop {
                    0% { transform: scale(0.85) translateY(8px); opacity: 0; }
                    100% { transform: scale(1) translateY(0); opacity: 1; }
                }
                .postit-pop { animation: postit-pop 0.35s ease-out; }
            `}</style>

            <div className="flex items-center justify-between mb-3 gap-2">
                <h3 className="text-sm font-bold text-[#1a2744] flex items-center gap-2">
                    <ClipboardList size={16} className="text-blue-500" /> Lavagna di Lavoro
                </h3>
                <button
                    onClick={handleAnalyze}
                    disabled={analyzing || notes.filter((n) => n.note_type !== 'analisi').length === 0}
                    title="Analizza la lavagna con il Metodo V6 (Kairós/Pareto/5S)"
                    className="flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-purple-600 text-white font-medium hover:bg-purple-700 disabled:opacity-40 flex-shrink-0"
                >
                    <Sparkles size={12} /> {analyzing ? 'Analizzo...' : 'Analizza'}
                </button>
            </div>
            {analyzeError && <p className="text-xs text-red-600 mb-2">{analyzeError}</p>}

            <form onSubmit={handleSubmit} className="mb-4 border border-gray-200 rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 bg-gray-50 px-2 py-2 border-b border-gray-200">
                    <select value={noteType} onChange={(e) => setNoteType(e.target.value as any)}
                        className="px-2 py-1 rounded border border-gray-200 text-xs bg-white font-medium">
                        <option value="nota">🗒️ Nota</option>
                        <option value="brief">📋 Brief</option>
                        <option value="debrief">📝 Debrief</option>
                    </select>
                    <input
                        placeholder="Titolo (opz.)"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="flex-1 min-w-0 px-2 py-1 rounded border border-gray-200 text-xs"
                    />
                </div>
                <textarea
                    rows={3}
                    placeholder="Scrivi qui: appunti della call, punti emersi..."
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    className="w-full px-2 py-2 text-sm focus:outline-none resize-y"
                />
                <div className="flex justify-end px-2 py-2 bg-gray-50 border-t border-gray-200">
                    <button type="submit" disabled={saving || !body.trim()} className="px-3 py-1.5 rounded bg-[#1a2744] text-white text-xs font-medium disabled:opacity-40">
                        {saving ? 'Salvo...' : 'Aggiungi'}
                    </button>
                </div>
            </form>

            {loading ? (
                <Loader2 size={18} className="animate-spin text-gray-400" />
            ) : notes.length === 0 ? (
                <div className="rounded-xl bg-[#f5f1e8] border border-dashed border-gray-200 p-6 text-center flex-1">
                    <p className="text-sm text-gray-400">Ancora nulla in lavagna.</p>
                </div>
            ) : (
                <div className="rounded-xl bg-[#f5f1e8] border border-gray-100 p-3 flex-1 overflow-y-auto">
                    <div className="flex flex-col gap-3">
                        {notes.map((n, i) => {
                            const style = TYPE_STYLE[n.note_type] || TYPE_STYLE.nota;
                            return (
                                <div
                                    key={n.id}
                                    draggable
                                    onDragStart={() => { dragIdRef.current = n.id; }}
                                    onDragOver={(e) => { e.preventDefault(); setDragOverId(n.id); }}
                                    onDragLeave={() => setDragOverId((prev) => (prev === n.id ? null : prev))}
                                    onDrop={(e) => { e.preventDefault(); handleDrop(n.id); }}
                                    onDragEnd={() => { dragIdRef.current = null; setDragOverId(null); }}
                                    className={`${style.bg} ${ROTATIONS[i % ROTATIONS.length]} ${justAddedId === n.id ? 'postit-pop' : ''} ${dragOverId === n.id ? 'ring-2 ring-[#1a2744]' : ''} rounded-sm shadow-md p-3 flex flex-col cursor-grab active:cursor-grabbing hover:rotate-0 hover:shadow-lg transition-transform`}
                                >
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                        <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${style.badge}`}>{style.label}</span>
                                        <GripVertical size={14} className="text-black/20 flex-shrink-0" />
                                    </div>
                                    {n.title && <div className="text-sm font-bold text-[#1a2744] mb-1">{n.title}</div>}
                                    <p className="text-sm text-gray-700 whitespace-pre-wrap mb-2">{n.body}</p>
                                    <div className="text-xs text-gray-500 mb-2">{n.author} · {n.create_date ? new Date(n.create_date).toLocaleString('it-IT') : ''}</div>
                                    {onSendEmail && (
                                        <div className="flex items-center gap-2 pt-2 border-t border-black/10">
                                            <button
                                                onClick={() => handleSend(n)}
                                                disabled={sendingId === n.id}
                                                className="flex items-center gap-1 text-xs text-[#1a2744] font-semibold hover:underline disabled:opacity-50"
                                            >
                                                <Send size={12} /> {sendingId === n.id ? 'Invio...' : 'Invia'}
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
