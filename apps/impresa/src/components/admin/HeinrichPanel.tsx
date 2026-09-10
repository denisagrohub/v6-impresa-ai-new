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

// 10/09/2026 (Denis, esempio Progetto TEE/Trader): pannello per
// registrare e leggere le segnalazioni Heinrich (near_miss/lieve/grave)
// su un progetto o su una parte collegata - "cultura_organizzativa" e'
// gia' calcolata da Odoo (euristica Toyota/Ford esistente), mai un
// punteggio inventato qui.
export default function HeinrichPanel({ resModel, resId, compact = false }: { resModel: string; resId: number; compact?: boolean }) {
    const [indicator, setIndicator] = useState<Indicator | null>(null);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [severity, setSeverity] = useState<'near_miss' | 'lieve' | 'grave'>('near_miss');
    const [description, setDescription] = useState("");
    const [saving, setSaving] = useState(false);

    const load = async () => {
        try {
            const res = await fetch(`/api/admin/heinrich?resModel=${encodeURIComponent(resModel)}&resId=${resId}`);
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

    if (loading) return <Loader2 size={16} className="animate-spin text-gray-400" />;

    const cultura = indicator ? CULTURA_LABEL[indicator.cultura] : null;

    return (
        <div className={compact ? "" : "bg-white rounded-2xl border border-gray-100 p-6"}>
            {!compact && (
                <h3 className="text-sm font-bold text-[#1a2744] mb-3 flex items-center gap-2">
                    <AlertTriangle size={16} className="text-orange-500" /> Segnalazioni Heinrich
                </h3>
            )}
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
