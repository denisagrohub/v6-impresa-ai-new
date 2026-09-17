"use client";
import { useEffect, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";

interface Indicator {
    nearMiss: number;
    problemiLievi: number;
    eventiGravi: number;
    cultura: string;
    note: string;
}

const CULTURA_LABEL: Record<string, { label: string; className: string }> = {
    toyota: { label: '🟢 Toyota — cultura della segnalazione', className: 'bg-green-50 text-green-700' },
    ford_silenziosa: { label: '🔴 Ford silenziosa — rischio nascosto', className: 'bg-red-50 text-red-700' },
    non_determinabile: { label: '⚪ Dati insufficienti', className: 'bg-gray-50 text-gray-600' },
};

// 14/09/2026: in modalità compact il pannello diventa un PALLINO MINIMO:
// - pallino stato cultura (verde/rosso/grigio), ~14px, inline col contenuto
// - badge numerico (giallo/rosso) se ci sono segnalazioni
// - il dettaglio (conteggi, cultura, note, form) si apre SOLO al click
export default function HeinrichPanel({ resModel, resId, compact = false }: { resModel: string; resId: number; compact?: boolean }) {
    const [indicator, setIndicator] = useState<Indicator | null>(null);
    const [loading, setLoading] = useState(true);
    const [open, setOpen] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [severity, setSeverity] = useState<'near_miss' | 'lieve' | 'grave'>('near_miss');
    const [description, setDescription] = useState("");
    const [saving, setSaving] = useState(false);

    const load = async () => {
        try {
            const res = await fetch(`/api/admin/heinrich?resModel={encodeURIComponent(resModel)}&resId={resId}`);
            const data = await res.json();
            if (data.success) setIndicator(data.indicator);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, [resModel, resId]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            await fetch('/api/admin/heinrich', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ resModel, resId, severity, description }),
            });
            setDescription("");
            setShowForm(false);
            await load();
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <Loader2 size={12} className="animate-spin text-gray-400" />;

    const total = (indicator?.nearMiss ?? 0) + (indicator?.problemiLievi ?? 0) + (indicator?.eventiGravi ?? 0);
    // colore = severità media: rosso se gravi, ambra se lievi, giallo se solo near miss,
    // rosso tenue se cultura "Ford silenziosa" pur senza segnalazioni, verde se pulito
    const dotColor =
        (indicator?.eventiGravi ?? 0) > 0 ? 'bg-red-500'
        : (indicator?.problemiLievi ?? 0) > 0 ? 'bg-amber-400'
        : (indicator?.nearMiss ?? 0) > 0 ? 'bg-yellow-300'
        : indicator?.cultura === 'ford_silenziosa' ? 'bg-red-400'
        : 'bg-green-400';
    const badge = total > 0
        ? (indicator!.eventiGravi > 0 ? 'bg-red-500' : indicator!.problemiLievi > 0 ? 'bg-amber-400' : 'bg-yellow-300')
        : null;

    // ── MODALITÀ PALLINO (compact): dettaglio solo al click ──
    if (compact) {
        return (
            <span className="relative inline-flex items-center">
                <button
                    type="button"
                    onClick={() => setOpen(!open)}
                    title={`Segnalazioni Heinrich: ${total}`}
                    className={`relative inline-flex h-[14px] w-[14px] items-center justify-center rounded-full ${dotColor} ring-1 ring-white cursor-pointer hover:scale-110 transition-transform`}
                >
                    {badge && (
                        <span className={`absolute -right-1.5 -top-1.5 flex h-[10px] min-w-[10px] items-center justify-center rounded-full px-0.5 text-[8px] font-bold text-white ${badge}`}>
                            {total}
                        </span>
                    )}
                </button>

                {open && (
                    <span className="absolute left-5 top-0 z-20 block w-64 rounded-lg border border-gray-200 bg-white p-3 text-left shadow-xl">
                        <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-gray-400">Segnalazioni Heinrich</span>
                        <span className="mb-1.5 flex gap-1 flex-wrap">
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-50 text-green-700">🟢 {indicator?.nearMiss ?? 0}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-yellow-50 text-yellow-700">🟡 {indicator?.problemiLievi ?? 0}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-50 text-red-700">🔴 {indicator?.eventiGravi ?? 0}</span>
                        </span>
                        {indicator?.cultura && CULTURA_LABEL[indicator.cultura] && (
                            <span className={`mb-1.5 block text-[10px] px-1.5 py-0.5 rounded-full ${CULTURA_LABEL[indicator.cultura].className}`}>
                                {CULTURA_LABEL[indicator.cultura].label}
                            </span>
                        )}
                        {indicator?.note && (
                            <span className="mb-1.5 block max-h-32 space-y-1 overflow-y-auto">
                                {indicator.note.split('\n').filter(l => l.trim()).map((line, i) => {
                                    const sev = /\((near_miss|lieve|grave)\)/.exec(line)?.[1];
                                    return (
                                        <span key={i} className={`block whitespace-pre-wrap rounded px-1.5 py-0.5 text-[10px] ${
                                            sev === 'grave' ? 'bg-red-50 text-red-700'
                                            : sev === 'lieve' ? 'bg-yellow-50 text-yellow-700'
                                            : 'bg-green-50 text-green-700'
                                        }`}>{line}</span>
                                    );
                                })}
                            </span>
                        )}
                        {!showForm && (
                            <button type="button" onClick={() => setShowForm(true)}
                                className="text-[10px] font-semibold text-[#1a2744] hover:underline cursor-pointer">
                                + Aggiungi segnalazione
                            </button>
                        )}
                        {showForm && (
                            <form onSubmit={handleSubmit} className="flex flex-col gap-1.5">
                                <select value={severity} onChange={(e) => setSeverity(e.target.value as any)}
                                    className="rounded border border-gray-200 px-1 py-0.5 text-[10px] bg-white">
                                    <option value="near_miss">🟢 Near miss</option>
                                    <option value="lieve">🟡 Problema lieve</option>
                                    <option value="grave">🔴 Evento grave</option>
                                </select>
                                <input required placeholder="Descrizione..." value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    className="rounded border border-gray-200 px-1.5 py-0.5 text-[10px]" />
                                <button type="submit" disabled={saving}
                                    className="rounded bg-[#1a2744] py-0.5 text-[10px] font-medium text-white disabled:opacity-50 cursor-pointer">
                                    {saving ? '...' : 'Salva'}
                                </button>
                            </form>
                        )}
                    </span>
                )}
            </span>
        );
    }

    // ── MODALITÀ FULL (invariata) ──
    const cultura = indicator ? CULTURA_LABEL[indicator.cultura] : null;

    return (
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <h3 className="text-sm font-bold text-[#1a2744] mb-3 flex items-center gap-2">
                <AlertTriangle size={16} className="text-orange-500" /> Segnalazioni Heinrich
            </h3>
            <div className="flex items-center gap-3 flex-wrap mb-2">
                <span className="text-xs px-2 py-1 rounded-full bg-green-50 text-green-700">🟢 Near miss: {indicator?.nearMiss ?? 0}</span>
                <span className="text-xs px-2 py-1 rounded-full bg-yellow-50 text-yellow-700">🟡 Lievi: {indicator?.problemiLievi ?? 0}</span>
                <span className="text-xs px-2 py-1 rounded-full bg-red-50 text-red-700">🔴 Gravi: {indicator?.eventiGravi ?? 0}</span>
                {cultura && <span className={`text-xs px-2 py-1 rounded-full ${cultura.className}`}>{cultura.label}</span>}
                <button onClick={() => setShowForm(!showForm)} className="text-xs text-[#1a2744] font-semibold hover:underline ml-auto">
                    {showForm ? 'Annulla' : '+ Segnala'}
                </button>
            </div>

            {indicator?.note && (
                <pre className="text-xs text-gray-500 whitespace-pre-wrap bg-gray-50 rounded-lg p-2 mb-2 max-h-32 overflow-y-auto">{indicator.note}</pre>
            )}

            {showForm && (
                <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2 bg-gray-50 rounded-lg p-3">
                    <select value={severity} onChange={(e) => setSeverity(e.target.value as any)}
                        className="px-2 py-1.5 rounded border border-gray-200 text-xs bg-white">
                        <option value="near_miss">🟢 Near miss</option>
                        <option value="lieve">🟡 Problema lieve</option>
                        <option value="grave">🔴 Evento grave</option>
                    </select>
                    <input
                        required
                        placeholder="Descrizione..."
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="flex-1 min-w-[160px] px-2 py-1.5 rounded border border-gray-200 text-xs"
                    />
                    <button type="submit" disabled={saving} className="px-3 py-1.5 rounded bg-[#1a2744] text-white text-xs font-medium disabled:opacity-50">
                        {saving ? '...' : 'Salva'}
                    </button>
                </form>
            )}
        </div>
    );
}
