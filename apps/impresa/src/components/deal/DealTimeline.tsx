'use client';

import { useEffect, useState } from 'react';
import {
    MessageSquare, Phone, Mail, FileText, TrendingUp, User, RefreshCw,
    StickyNote, Circle, Plus, X, Clock, ChevronDown, ChevronRight, Trash2,
} from 'lucide-react';

export type DealEvent = {
    id: number;
    eventType: string;
    eventDate: string | null;
    title: string;
    description: string;
    visibility: string;
    isAuto: boolean;
    createdBy: string;
    createdAt: string | null;
    attendees: { id: number; name: string; email?: string }[];
    changesApplied: Record<string, any>;
};

export type DealSnapshot = {
    id: number;
    version: number;
    snapshotDate: string | null;
    triggerType: string;
    triggerEventId: number | null;
    triggerEventTitle: string;
    values: Record<string, any>;
    diffFromPrev: Record<string, { from: any; to: any }>;
    isCurrent: boolean;
    createdBy: string;
    note: string;
};

type Props = {
    dealId?: number;
    relationId?: number;
    mode: 'admin' | 'consultant';
    authToken: string;
    onRefresh?: () => void;
};

const TYPE_META: Record<string, { icon: any; label: string; color: string }> = {
    tavolo_incontro:    { icon: MessageSquare, label: 'Tavolo/Incontro', color: 'bg-purple-100 text-purple-700' },
    call:               { icon: Phone,         label: 'Call',             color: 'bg-blue-100 text-blue-700' },
    email_rilevante:    { icon: Mail,          label: 'Email',            color: 'bg-amber-100 text-amber-700' },
    documento_ricevuto: { icon: FileText,      label: 'Documento',        color: 'bg-cyan-100 text-cyan-700' },
    cambio_numeri:      { icon: TrendingUp,    label: 'Cambio numeri',    color: 'bg-emerald-100 text-emerald-700' },
    nuovo_stakeholder:  { icon: User,          label: 'Stakeholder',      color: 'bg-indigo-100 text-indigo-700' },
    cambio_stato:       { icon: RefreshCw,     label: 'Cambio stato',     color: 'bg-orange-100 text-orange-700' },
    nota_operativa:     { icon: StickyNote,    label: 'Nota',             color: 'bg-gray-100 text-gray-600' },
    altro:              { icon: Circle,        label: 'Altro',            color: 'bg-gray-100 text-gray-500' },
};

function fmtDate(s: string | null): string {
    if (!s) return '—';
    const d = new Date(s.replace(' ', 'T') + (s.includes('Z') || s.includes('+') ? '' : 'Z'));
    return d.toLocaleString('it-IT', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function DealTimeline({ dealId, relationId, mode, authToken, onRefresh }: Props) {
    // 01/10/2026: supporto sia dealId (deal) sia relationId (progetto/canale)
    const entityType: 'deal' | 'relation' = dealId ? 'deal' : 'relation';
    const entityId = dealId || relationId || 0;
    const entityPath = entityType === 'deal' ? 'deals' : 'relations';
    const [events, setEvents] = useState<DealEvent[]>([]);
    const [snapshots, setSnapshots] = useState<DealSnapshot[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showSnapshots, setShowSnapshots] = useState(false);
    const [showNewEvent, setShowNewEvent] = useState(false);
    // 01/10/2026: collassata di default per non occupare l'intera pagina
    const [collapsed, setCollapsed] = useState(true);

    const baseUrl = mode === 'admin' ? '/api/admin' : '/api/consultant';

    const load = async () => {
        setLoading(true);
        setError(null);
        try {
            const r = await fetch(`${baseUrl}/${entityPath}/${entityId}/events`, {
                headers: { Authorization: `JWT ${authToken}` },
            });
            const d = await r.json();
            if (!r.ok || !d.success) throw new Error(d.error || 'Errore caricamento');
            setEvents(d.events || []);

            // Snapshot solo per deal (i progetti non hanno snapshot versionati)
            if (mode === 'admin' && entityType === 'deal') {
                const r2 = await fetch(`${baseUrl}/deals/${entityId}/snapshots`, {
                    headers: { Authorization: `JWT ${authToken}` },
                });
                const d2 = await r2.json();
                if (r2.ok && d2.success) setSnapshots(d2.snapshots || []);
            }
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, [dealId, relationId, authToken, mode]);

    const handleDelete = async (id: number) => {
        if (mode !== 'admin') return;
        if (!confirm('Eliminare questo evento dalla timeline?')) return;
        try {
            const r = await fetch(`${baseUrl}/${entityPath}/${entityId}/events/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `JWT ${authToken}` },
            });
            if (r.ok) { await load(); onRefresh?.(); }
        } catch { /* best effort */ }
    };

    return (
        <section className="mb-4 rounded-xl border border-gray-200 bg-white p-5">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className="text-base font-semibold flex items-center gap-2 hover:text-indigo-700 transition-colors"
                >
                    {collapsed ? <ChevronRight size={16} className="text-indigo-600" /> : <ChevronDown size={16} className="text-indigo-600" />}
                    <Clock size={16} className="text-indigo-600" />
                    Storia del deal
                    {events.length > 0 && (
                        <span className="text-xs font-normal text-gray-500">({events.length} eventi)</span>
                    )}
                </button>
                <div className="flex items-center gap-2">
                    {mode === 'admin' && snapshots.length > 0 && (
                        <button
                            onClick={() => setShowSnapshots(!showSnapshots)}
                            className={`px-3 py-1.5 text-xs rounded border flex items-center gap-1.5 transition-colors ${
                                showSnapshots ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'border-gray-300 hover:bg-gray-50'
                            }`}
                        >
                            {showSnapshots ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                            Traiettoria ({snapshots.length})
                        </button>
                    )}
                    <button
                        onClick={() => setShowNewEvent(true)}
                        className="px-3 py-1.5 text-xs rounded bg-indigo-600 text-white hover:bg-indigo-700 flex items-center gap-1.5"
                    >
                        <Plus size={12} />
                        {mode === 'admin' ? 'Nuovo evento' : 'Aggiungi nota'}
                    </button>
                </div>
            </div>

            {/* Anteprima quando collapsed */}
            {collapsed && events.length > 0 && (
                <div className="mt-2 text-xs text-gray-500">
                    Ultimo: <span className="font-medium text-gray-700">{events[0].title}</span>
                    {events[0].eventDate && (
                        <span className="ml-2 text-gray-400">
                            {new Date(events[0].eventDate).toLocaleString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                    )}
                </div>
            )}

            {loading && !collapsed && (
                <div className="text-center py-6 text-gray-400 text-sm">Carico la storia…</div>
            )}

            {error && (
                <div className="p-3 rounded bg-red-50 border border-red-200 text-sm text-red-700 mb-3">
                    {error}
                </div>
            )}

            {!loading && !collapsed && events.length === 0 && (
                <div className="text-center py-8 text-gray-400 text-sm">
                    Nessun evento ancora. La storia si costruisce aggiungendo il primo tavolo, call o nota.
                </div>
            )}

            {!loading && !collapsed && events.length > 0 && (
                <ol className="relative border-l-2 border-gray-100 ml-3 space-y-4 pb-2 max-h-[400px] overflow-y-auto">
                    {events.map((ev) => {
                        const meta = TYPE_META[ev.eventType] || TYPE_META.altro;
                        const Icon = meta.icon;
                        return (
                            <li key={ev.id} className="ml-6 relative group">
                                <span className={`absolute -left-[35px] top-1 w-6 h-6 rounded-full flex items-center justify-center ${meta.color}`}>
                                    <Icon size={12} />
                                </span>
                                <div className="bg-gray-50 rounded-xl p-3 hover:bg-gray-100 transition-colors">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${meta.color}`}>
                                                    {meta.label}
                                                </span>
                                                <span className="text-xs text-gray-500">{fmtDate(ev.eventDate)}</span>
                                                {ev.visibility === 'internal' && (
                                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-200 text-gray-600">interno</span>
                                                )}
                                            </div>
                                            <div className="font-medium text-sm text-[#1a2744] mt-1">{ev.title}</div>
                                            {ev.description && (
                                                <div className="text-xs text-gray-600 mt-1 whitespace-pre-wrap">{ev.description}</div>
                                            )}
                                            {ev.attendees.length > 0 && (
                                                <div className="flex flex-wrap gap-1 mt-2">
                                                    {ev.attendees.map((a) => (
                                                        <span key={a.id} className="text-[10px] px-2 py-0.5 rounded-full bg-white border border-gray-200 text-gray-600">
                                                            {a.name}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                            {ev.changesApplied && Object.keys(ev.changesApplied).length > 0 && (
                                                <div className="mt-2 text-[11px] text-emerald-700 font-medium">
                                                    Modifiche: {Object.entries(ev.changesApplied).map(([k, v]: any) =>
                                                        `${k}: ${v?.from ?? '—'} → ${v?.to ?? v}`
                                                    ).join(' · ')}
                                                </div>
                                            )}
                                            <div className="text-[10px] text-gray-400 mt-1">
                                                da {ev.createdBy || 'sistema'}
                                            </div>
                                        </div>
                                        {mode === 'admin' && (
                                            <button
                                                onClick={() => handleDelete(ev.id)}
                                                className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-opacity"
                                                title="Elimina"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </li>
                        );
                    })}
                </ol>
            )}

            {!collapsed && showSnapshots && snapshots.length > 0 && (
                <div className="mt-5 pt-4 border-t border-gray-100">
                    <h3 className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-3">
                        Traiettoria deal ({snapshots.length} versioni)
                    </h3>
                    <div className="space-y-1.5">
                        {snapshots.map((s) => (
                            <div key={s.id} className={`text-xs rounded-lg px-3 py-2 ${s.isCurrent ? 'bg-emerald-50 border border-emerald-100' : 'bg-gray-50'}`}>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-bold text-gray-700">v{s.version}</span>
                                    <span className="text-gray-400">{fmtDate(s.snapshotDate)}</span>
                                    {s.isCurrent && (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-200 text-emerald-800 font-medium">corrente</span>
                                    )}
                                    {s.triggerEventTitle && (
                                        <span className="text-gray-500 italic truncate">← {s.triggerEventTitle}</span>
                                    )}
                                </div>
                                {s.diffFromPrev && Object.keys(s.diffFromPrev).length > 0 && (
                                    <div className="mt-1 text-gray-600">
                                        {Object.entries(s.diffFromPrev).map(([k, v]) => (
                                            <div key={k} className="ml-2">
                                                <span className="font-medium">{k}:</span>{' '}
                                                <span className="text-red-500 line-through">{String(v.from ?? '—')}</span>{' '}
                                                <span className="text-gray-400">→</span>{' '}
                                                <span className="text-emerald-700 font-medium">{String(v.to ?? '—')}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {showNewEvent && (
                <NewEventModal
                    entityType={entityType}
                    entityId={entityId}
                    mode={mode}
                    authToken={authToken}
                    onClose={() => setShowNewEvent(false)}
                    onSaved={() => { setShowNewEvent(false); load(); onRefresh?.(); }}
                />
            )}
        </section>
    );
}

// ─────────────────────────────────────────────────────────────
// Modal nuovo evento
// ─────────────────────────────────────────────────────────────
function NewEventModal({
    entityType, entityId, mode, authToken, onClose, onSaved,
}: { entityType: 'deal' | 'relation'; entityId: number; mode: 'admin' | 'consultant'; authToken: string; onClose: () => void; onSaved: () => void }) {
    const [eventType, setEventType] = useState(mode === 'consultant' ? 'nota_operativa' : 'tavolo_incontro');
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [eventDate, setEventDate] = useState('');
    const [visibility, setVisibility] = useState('consultant');
    const [attendeesText, setAttendeesText] = useState('');
    const [chgField, setChgField] = useState('');
    const [chgFrom, setChgFrom] = useState('');
    const [chgTo, setChgTo] = useState('');
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    const baseUrl = mode === 'admin' ? '/api/admin' : '/api/consultant';

    const submit = async () => {
        if (!title.trim()) { setErr('Titolo obbligatorio'); return; }
        setSaving(true); setErr(null);
        try {
            const body: any = {
                eventType,
                title: title.trim(),
                description: description.trim(),
                eventDate: eventDate ? new Date(eventDate).toISOString() : undefined,
            };
            if (mode === 'admin') {
                body.visibility = visibility;
                // applyChanges solo per deal (relation non ha campi numerici tracciati)
                if (entityType === 'deal' && chgField.trim()) {
                    body.changesApplied = { [chgField.trim()]: { from: chgFrom, to: chgTo } };
                    body.applyChanges = true;
                }
            }
            const entityPath = entityType === 'deal' ? 'deals' : 'relations';
            const r = await fetch(`${baseUrl}/${entityPath}/${entityId}/events`, {
                method: 'POST',
                headers: { Authorization: `JWT ${authToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const d = await r.json();
            if (!r.ok || !d.success) throw new Error(d.error || 'Errore salvataggio');
            onSaved();
        } catch (e: any) {
            setErr(e.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => !saving && onClose()}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <div className="border-b border-gray-100 px-5 py-3 flex items-center justify-between">
                    <h3 className="text-base font-bold">{mode === 'admin' ? 'Nuovo evento' : 'Nuova nota'}</h3>
                    <button onClick={onClose} disabled={saving} className="text-gray-400 hover:text-gray-700">
                        <X size={18} />
                    </button>
                </div>
                <div className="p-5 space-y-3">
                    {mode === 'admin' && (
                        <div>
                            <label className="block text-[11px] font-semibold text-gray-500 uppercase mb-1">Tipo</label>
                            <select value={eventType} onChange={(e) => setEventType(e.target.value)} className="w-full px-3 py-2 rounded border border-gray-200 text-sm">
                                {Object.entries(TYPE_META).map(([k, v]) => (
                                    <option key={k} value={k}>{v.label}</option>
                                ))}
                            </select>
                        </div>
                    )}
                    <div>
                        <label className="block text-[11px] font-semibold text-gray-500 uppercase mb-1">Titolo *</label>
                        <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-3 py-2 rounded border border-gray-200 text-sm" placeholder="Es. Tavolo TEE con commercialista" />
                    </div>
                    <div>
                        <label className="block text-[11px] font-semibold text-gray-500 uppercase mb-1">Data/ora</label>
                        <input type="datetime-local" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className="w-full px-3 py-2 rounded border border-gray-200 text-sm" />
                    </div>
                    <div>
                        <label className="block text-[11px] font-semibold text-gray-500 uppercase mb-1">Descrizione</label>
                        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className="w-full px-3 py-2 rounded border border-gray-200 text-sm" placeholder="Cosa è emerso, decisioni, prossimi passi…" />
                    </div>
                    {mode === 'admin' && (
                        <>
                            <div>
                                <label className="block text-[11px] font-semibold text-gray-500 uppercase mb-1">Visibilità</label>
                                <select value={visibility} onChange={(e) => setVisibility(e.target.value)} className="w-full px-3 py-2 rounded border border-gray-200 text-sm">
                                    <option value="internal">Solo admin</option>
                                    <option value="consultant">Admin + consulente del deal</option>
                                    <option value="all">Tutti i participant</option>
                                </select>
                            </div>
                            <details className="rounded border border-gray-200 p-3">
                                <summary className="text-xs font-semibold text-gray-600 cursor-pointer">Cambio numeri (opzionale)</summary>
                                <div className="grid grid-cols-3 gap-2 mt-2">
                                    <input value={chgField} onChange={(e) => setChgField(e.target.value)} placeholder="campo (es. prezzo_cessione)" className="px-2 py-1.5 rounded border border-gray-200 text-xs" />
                                    <input value={chgFrom} onChange={(e) => setChgFrom(e.target.value)} placeholder="da (es. 84)" className="px-2 py-1.5 rounded border border-gray-200 text-xs" />
                                    <input value={chgTo} onChange={(e) => setChgTo(e.target.value)} placeholder="a (es. 86)" className="px-2 py-1.5 rounded border border-gray-200 text-xs" />
                                </div>
                                <p className="text-[10px] text-gray-500 mt-2">
                                    Applica la modifica al deal e crea snapshot versionato.
                                </p>
                            </details>
                        </>
                    )}
                    {err && <div className="p-2 rounded bg-red-50 border border-red-200 text-xs text-red-700">{err}</div>}
                </div>
                <div className="border-t border-gray-100 px-5 py-3 flex justify-end gap-2">
                    <button onClick={onClose} disabled={saving} className="px-4 py-2 rounded text-sm border border-gray-200 hover:bg-gray-50">
                        Annulla
                    </button>
                    <button onClick={submit} disabled={saving || !title.trim()} className="px-4 py-2 rounded text-sm bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50">
                        {saving ? 'Salvo…' : 'Salva'}
                    </button>
                </div>
            </div>
        </div>
    );
}
