"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, ArrowLeft, User, Mail, Phone, ChevronDown, ChevronUp, Calendar, Send } from "lucide-react";
import NotesBoard from "@/components/admin/NotesBoard";

interface Booking {
    id: number;
    consultant: string;
    consultantId: number | null;
    clientName: string;
    clientEmail: string;
    clientPhone: string;
    notes: string;
    bookedAt: string | null;
    expiresAt: string | null;
    scheduledAt: string | null;
    confirmationState: string;
    rescheduleNote: string;
}

interface Consultant {
    id: number;
    name: string;
}

const STATE_LABEL: Record<string, { label: string; className: string }> = {
    da_proporre: { label: 'Da proporre', className: 'bg-gray-100 text-gray-600' },
    proposta: { label: 'In attesa di conferma', className: 'bg-orange-100 text-orange-700' },
    confermata: { label: 'Confermata', className: 'bg-green-100 text-green-700' },
    da_riprogrammare: { label: 'Il cliente vuole cambiare', className: 'bg-red-100 text-red-700' },
};

// 10/09/2026 (Denis: "dobbiamo inserire l'orario e il giorno in cui la
// programmiamo... la possibilità di modificare orario data e
// consulente, ogni cambiamento deve essere comunicato anche al lead").
export default function BookingsPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [consultants, setConsultants] = useState<Consultant[]>([]);
    const [openId, setOpenId] = useState<number | null>(null);

    const [scheduleDraft, setScheduleDraft] = useState<Record<number, { date: string; consultantId: string }>>({});
    const [sendingId, setSendingId] = useState<number | null>(null);
    const [sendResult, setSendResult] = useState<Record<number, string>>({});

    const load = async () => {
        try {
            const [bRes, cRes] = await Promise.all([
                fetch('/api/admin/bookings'),
                fetch('/api/admin/consultants'),
            ]);
            const bData = await bRes.json();
            const cData = await cRes.json();
            if (!bRes.ok || !bData.success) {
                setLoadError(bData.error || 'Odoo non raggiungibile');
                return;
            }
            setBookings(bData.bookings || []);
            if (cData.success) setConsultants(cData.consultants || []);
        } catch (error: any) {
            setLoadError(error.message || 'Errore di rete');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const session = localStorage.getItem("pi_session");
        if (!session) { router.push("/login"); return; }
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [router]);

    const draftFor = (b: Booking) => scheduleDraft[b.id] || {
        date: b.scheduledAt ? b.scheduledAt.slice(0, 16) : '',
        consultantId: String(b.consultantId || ''),
    };

    const updateDraft = (bookingId: number, field: 'date' | 'consultantId', value: string, base: Booking) => {
        setScheduleDraft((prev) => ({
            ...prev,
            [bookingId]: { ...draftFor(base), ...prev[bookingId], [field]: value },
        }));
    };

    const handlePropose = async (b: Booking) => {
        const draft = draftFor(b);
        if (!draft.date) {
            setSendResult((prev) => ({ ...prev, [b.id]: 'Scegli una data e ora.' }));
            return;
        }
        setSendingId(b.id);
        try {
            const res = await fetch(`/api/admin/bookings/${b.id}/propose-schedule`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ scheduledAt: draft.date, consultantId: draft.consultantId || undefined }),
            });
            const data = await res.json();
            if (data.success) {
                setSendResult((prev) => ({ ...prev, [b.id]: 'Email inviata al cliente.' }));
                load();
            } else {
                setSendResult((prev) => ({ ...prev, [b.id]: data.error || 'Invio fallito' }));
            }
        } finally {
            setSendingId(null);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
                <Loader2 size={40} className="animate-spin text-orange-500" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f8fafc]">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="flex items-center gap-4 mb-8">
                    <Link href="/admin/dashboard" className="p-2 rounded-lg hover:bg-gray-200 transition-colors">
                        <ArrowLeft size={20} className="text-gray-600" />
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold text-[#1a2744]">Call Prenotate</h1>
                        <p className="text-gray-500">Chi ha prenotato, con chi, quando, e note sulla call</p>
                    </div>
                </div>

                {loadError && (
                    <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                        Dati non aggiornati: {loadError}
                    </div>
                )}

                {bookings.length === 0 && !loadError ? (
                    <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-gray-500">
                        Nessuna call prenotata al momento.
                    </div>
                ) : (
                    <div className="space-y-3">
                        {bookings.map((b) => {
                            const state = STATE_LABEL[b.confirmationState] || STATE_LABEL.da_proporre;
                            const draft = draftFor(b);
                            return (
                                <div key={b.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                                    <button
                                        onClick={() => setOpenId(openId === b.id ? null : b.id)}
                                        className="w-full flex items-center justify-between p-6 text-left hover:bg-gray-50"
                                    >
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-bold text-[#1a2744]">{b.clientName || 'Cliente senza nome'}</span>
                                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${state.className}`}>{state.label}</span>
                                            </div>
                                            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                                                <span className="flex items-center gap-1"><User size={12} /> {b.consultant}</span>
                                                {b.clientEmail && <span className="flex items-center gap-1"><Mail size={12} /> {b.clientEmail}</span>}
                                                {b.clientPhone && <span className="flex items-center gap-1"><Phone size={12} /> {b.clientPhone}</span>}
                                                {b.scheduledAt && (
                                                    <span className="flex items-center gap-1"><Calendar size={12} /> {new Date(b.scheduledAt).toLocaleString('it-IT')}</span>
                                                )}
                                            </div>
                                            {b.confirmationState === 'da_riprogrammare' && b.rescheduleNote && (
                                                <div className="mt-1 text-xs text-red-600">Nota cliente: {b.rescheduleNote}</div>
                                            )}
                                        </div>
                                        {openId === b.id ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
                                    </button>
                                    {openId === b.id && (
                                        <div className="px-6 pb-6 space-y-4">
                                            <div className="bg-gray-50 rounded-xl p-4">
                                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Data, ora e consulente</h3>
                                                <div className="flex flex-wrap items-end gap-3">
                                                    <div>
                                                        <label className="block text-xs text-gray-500 mb-1">Data e ora</label>
                                                        <input
                                                            type="datetime-local"
                                                            value={draft.date}
                                                            onChange={(e) => updateDraft(b.id, 'date', e.target.value, b)}
                                                            className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs text-gray-500 mb-1">Consulente</label>
                                                        <select
                                                            value={draft.consultantId}
                                                            onChange={(e) => updateDraft(b.id, 'consultantId', e.target.value, b)}
                                                            className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm bg-white"
                                                        >
                                                            {consultants.map((c) => (
                                                                <option key={c.id} value={c.id}>{c.name}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    <button
                                                        onClick={() => handlePropose(b)}
                                                        disabled={sendingId === b.id}
                                                        className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-[#1a2744] text-white text-sm font-medium hover:bg-[#0f3460] disabled:opacity-50"
                                                    >
                                                        <Send size={14} /> {sendingId === b.id ? 'Invio...' : b.scheduledAt ? 'Aggiorna e avvisa' : 'Proponi e avvisa'}
                                                    </button>
                                                </div>
                                                {sendResult[b.id] && <p className="text-xs text-gray-500 mt-2">{sendResult[b.id]}</p>}
                                            </div>
                                            <NotesBoard resModel="erpv6.booking.token" resId={b.id} />
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
