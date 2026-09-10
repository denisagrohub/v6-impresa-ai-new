"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, ArrowLeft, User, Mail, Phone, ChevronDown, ChevronUp } from "lucide-react";
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
}

// 10/09/2026 (Denis: "manca in dashboard una vista per i slot prenotati
// e con i dati di chi lo ha prenotato e appunto una lavagna di lavoro
// dove annotare la call e quello che ne è uscito").
export default function BookingsPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [openId, setOpenId] = useState<number | null>(null);

    useEffect(() => {
        const session = localStorage.getItem("pi_session");
        if (!session) {
            router.push("/login");
            return;
        }
        (async () => {
            try {
                const res = await fetch('/api/admin/bookings');
                const data = await res.json();
                if (!res.ok || !data.success) {
                    setLoadError(data.error || 'Odoo non raggiungibile');
                    return;
                }
                setBookings(data.bookings || []);
            } catch (error: any) {
                setLoadError(error.message || 'Errore di rete');
            } finally {
                setLoading(false);
            }
        })();
    }, [router]);

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
                        <p className="text-gray-500">Chi ha prenotato, con chi, e note sulla call</p>
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
                        {bookings.map((b) => (
                            <div key={b.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                                <button
                                    onClick={() => setOpenId(openId === b.id ? null : b.id)}
                                    className="w-full flex items-center justify-between p-6 text-left hover:bg-gray-50"
                                >
                                    <div>
                                        <div className="text-sm font-bold text-[#1a2744]">{b.clientName || 'Cliente senza nome'}</div>
                                        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                                            <span className="flex items-center gap-1"><User size={12} /> Consulente: {b.consultant}</span>
                                            {b.clientEmail && <span className="flex items-center gap-1"><Mail size={12} /> {b.clientEmail}</span>}
                                            {b.clientPhone && <span className="flex items-center gap-1"><Phone size={12} /> {b.clientPhone}</span>}
                                            {b.bookedAt && <span>Prenotato il {new Date(b.bookedAt).toLocaleString('it-IT')}</span>}
                                        </div>
                                    </div>
                                    {openId === b.id ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
                                </button>
                                {openId === b.id && (
                                    <div className="px-6 pb-6">
                                        <NotesBoard resModel="erpv6.booking.token" resId={b.id} />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
