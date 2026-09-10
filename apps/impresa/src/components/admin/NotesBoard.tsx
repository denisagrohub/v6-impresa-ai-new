"use client";
import { useEffect, useState } from "react";
import { ClipboardList, Loader2, Plus } from "lucide-react";

interface Note {
    id: number;
    note_type: 'brief' | 'debrief' | 'nota';
    title: string;
    body: string;
    author: string;
    create_date: string;
}

const TYPE_LABEL: Record<string, string> = { brief: '📋 Brief', debrief: '📝 Debrief', nota: '🗒️ Nota' };

// 10/09/2026 (Denis: "manca in tutti i progetti una lavagna di lavoro
// sia per appuntare i brief e debrief ma anche note e informazioni").
export default function NotesBoard({ resModel, resId }: { resModel: string; resId: number }) {
    const [notes, setNotes] = useState<Note[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [noteType, setNoteType] = useState<'brief' | 'debrief' | 'nota'>('nota');
    const [title, setTitle] = useState("");
    const [body, setBody] = useState("");
    const [saving, setSaving] = useState(false);

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
        setSaving(true);
        try {
            const res = await fetch('/api/admin/notes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ resModel, resId, noteType, title, body }),
            });
            const data = await res.json();
            if (data.success) setNotes(data.notes || []);
            setTitle(""); setBody(""); setShowForm(false);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-[#1a2744] flex items-center gap-2">
                    <ClipboardList size={16} className="text-blue-500" /> Lavagna di Lavoro
                </h3>
                <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1 text-xs text-[#1a2744] font-semibold hover:underline">
                    <Plus size={14} /> {showForm ? 'Annulla' : 'Aggiungi'}
                </button>
            </div>

            {showForm && (
                <form onSubmit={handleSubmit} className="space-y-2 bg-gray-50 rounded-lg p-3 mb-4">
                    <div className="flex gap-2">
                        <select value={noteType} onChange={(e) => setNoteType(e.target.value as any)}
                            className="px-2 py-1.5 rounded border border-gray-200 text-xs bg-white">
                            <option value="nota">🗒️ Nota</option>
                            <option value="brief">📋 Brief</option>
                            <option value="debrief">📝 Debrief</option>
                        </select>
                        <input
                            placeholder="Titolo (opzionale)"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="flex-1 px-2 py-1.5 rounded border border-gray-200 text-xs"
                        />
                    </div>
                    <textarea
                        required
                        rows={3}
                        placeholder="Contenuto..."
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        className="w-full px-2 py-1.5 rounded border border-gray-200 text-xs"
                    />
                    <button type="submit" disabled={saving} className="px-3 py-1.5 rounded bg-[#1a2744] text-white text-xs font-medium disabled:opacity-50">
                        {saving ? 'Salvo...' : 'Salva'}
                    </button>
                </form>
            )}

            {loading ? (
                <Loader2 size={18} className="animate-spin text-gray-400" />
            ) : notes.length === 0 ? (
                <p className="text-sm text-gray-400">Nessuna nota ancora.</p>
            ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                    {notes.map((n) => (
                        <div key={n.id} className="border border-gray-100 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-semibold text-[#1a2744]">{TYPE_LABEL[n.note_type]}{n.title ? ` — ${n.title}` : ''}</span>
                                <span className="text-xs text-gray-400">{n.author} · {n.create_date ? new Date(n.create_date).toLocaleString('it-IT') : ''}</span>
                            </div>
                            <p className="text-sm text-gray-600 whitespace-pre-wrap">{n.body}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
