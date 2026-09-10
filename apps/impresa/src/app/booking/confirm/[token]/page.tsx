"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { CheckCircle2, Calendar, User, Loader2 } from "lucide-react";

interface Booking {
    clientName: string;
    consultant: string;
    scheduledAt: string | null;
    confirmationState: string;
    rescheduleNote: string;
}

// 10/09/2026 (Denis: "ogni cambiamento deve essere comunicato anche al
// lead, che puo' solo confermare o cambiare data ed ora") - pagina
// pubblica raggiunta dal link nell'email di proposta orario, nessun
// login: il token e' l'unico segreto (stesso principio di /report/[token]).
export default function BookingConfirmPage() {
    const params = useParams();
    const token = params?.token as string;

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [booking, setBooking] = useState<Booking | null>(null);
    const [showReschedule, setShowReschedule] = useState(false);
    const [note, setNote] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [done, setDone] = useState<'confirmed' | 'rescheduled' | null>(null);

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch(`/api/booking-confirm/${token}`);
                const data = await res.json();
                if (!res.ok || !data.success) {
                    setError(data.error || 'Link non valido');
                    return;
                }
                setBooking(data.booking);
                if (data.booking.confirmationState === 'confermata') setDone('confirmed');
                if (data.booking.confirmationState === 'da_riprogrammare') setDone('rescheduled');
            } catch (err: any) {
                setError(err.message || 'Errore di rete');
            } finally {
                setLoading(false);
            }
        })();
    }, [token]);

    const handleConfirm = async () => {
        setSubmitting(true);
        try {
            const res = await fetch(`/api/booking-confirm/${token}/confirm`, { method: 'POST' });
            const data = await res.json();
            if (data.success) setDone('confirmed');
            else setError(data.error || 'Operazione fallita');
        } finally {
            setSubmitting(false);
        }
    };

    const handleReschedule = async () => {
        setSubmitting(true);
        try {
            const res = await fetch(`/api/booking-confirm/${token}/reschedule`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ note }),
            });
            const data = await res.json();
            if (data.success) setDone('rescheduled');
            else setError(data.error || 'Operazione fallita');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]"><Loader2 size={40} className="animate-spin text-orange-500" /></div>;
    }

    if (error || !booking) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] px-4">
                <div className="max-w-md text-center">
                    <h1 className="text-xl font-bold text-[#1a2744] mb-2">Link non valido</h1>
                    <p className="text-gray-500">{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] px-4 py-12">
            <div className="max-w-md w-full bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
                <h1 className="text-2xl font-bold text-[#1a2744] mb-1">Ciao {booking.clientName || ''}</h1>
                <p className="text-gray-500 mb-6">Ecco l&rsquo;orario proposto per la tua call</p>

                <div className="bg-[#f8fafc] rounded-xl p-6 mb-6 space-y-2">
                    <div className="flex items-center justify-center gap-2 text-lg font-bold text-[#1a2744]">
                        <Calendar size={20} />
                        {booking.scheduledAt ? new Date(booking.scheduledAt).toLocaleString('it-IT', { dateStyle: 'full', timeStyle: 'short' }) : 'Non ancora fissato'}
                    </div>
                    <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                        <User size={16} /> con {booking.consultant}
                    </div>
                </div>

                {done === 'confirmed' ? (
                    <div className="text-green-700 flex flex-col items-center gap-2">
                        <CheckCircle2 size={32} />
                        <p className="font-semibold">Orario confermato, ci vediamo lì!</p>
                    </div>
                ) : done === 'rescheduled' ? (
                    <div className="text-orange-700">
                        <p className="font-semibold">Richiesta inviata — ti ricontatteremo per un nuovo orario.</p>
                    </div>
                ) : showReschedule ? (
                    <div className="space-y-3">
                        <textarea
                            rows={3}
                            placeholder="Facci sapere quando preferisci (opzionale)"
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                        />
                        <button onClick={handleReschedule} disabled={submitting}
                            className="w-full px-4 py-2.5 rounded-lg bg-[#1a2744] text-white font-medium hover:bg-[#0f3460] disabled:opacity-50">
                            {submitting ? 'Invio...' : 'Invia richiesta'}
                        </button>
                        <button onClick={() => setShowReschedule(false)} className="text-sm text-gray-500 hover:underline">Annulla</button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <button onClick={handleConfirm} disabled={submitting}
                            className="w-full px-4 py-2.5 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 disabled:opacity-50">
                            {submitting ? '...' : 'Confermo'}
                        </button>
                        <button onClick={() => setShowReschedule(true)}
                            className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-gray-700 font-medium hover:bg-gray-50">
                            Vorrei cambiare orario
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
