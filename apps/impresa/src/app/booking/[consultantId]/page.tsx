"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
    Calendar, Clock, User, Mail, Phone, CheckCircle2,
    ArrowLeft, Loader2, AlertCircle, Video
} from "lucide-react";

export default function PublicBookingPage() {
    const params = useParams();
    const router = useRouter();
    const consultantId = params.consultantId as string;

    const [loading, setLoading] = useState(true);
    const [slots, setSlots] = useState<any[]>([]);
    const [selectedSlot, setSelectedSlot] = useState<any>(null);
    const [formData, setFormData] = useState({
        clientName: '',
        clientEmail: '',
        clientPhone: '',
        notes: ''
    });
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState('');

    const [consultantName, setConsultantName] = useState('');

    useEffect(() => {
        // Carica i link di prenotazione realmente disponibili per questo
        // consulente (erpv6.booking.token, Odoo) - 25/08/2026: prima
        // leggeva un JSON finto su disco. Il modello reale non ha
        // giorno/ora (e' un link monouso con sola scadenza), quindi qui
        // "slot" = link prenotabile con una scadenza reale, non un
        // orario scelto a priori.
        fetch(`/api/consultant/public-slots?consultantId=${consultantId}`)
            .then(res => res.json())
            .then(data => {
                if (data.error) {
                    setError(data.error);
                } else {
                    setSlots(data.tokens || []);
                    setConsultantName(data.consultantName || '');
                }
                setLoading(false);
            })
            .catch(err => {
                console.error('Errore caricamento slot:', err);
                setError('Errore caricamento disponibilità');
                setLoading(false);
            });
    }, [consultantId]);

    const handleSlotSelect = (slot: any) => {
        setSelectedSlot(slot);
        setError('');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!selectedSlot) {
            setError('Seleziona uno slot disponibile');
            return;
        }

        if (!formData.clientName.trim() || !formData.clientEmail.trim()) {
            setError('Nome ed email sono obbligatori');
            return;
        }

        setSubmitting(true);
        setError('');

        try {
            const response = await fetch('/api/booking', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    bookingToken: selectedSlot.token,
                    ...formData
                })
            });

            const data = await response.json();

            if (response.ok) {
                setSuccess(true);
            } else {
                setError(data.error || 'Errore prenotazione');
            }
        } catch (err) {
            setError('Errore di connessione');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
                <Loader2 size={40} className="animate-spin text-orange-500" />
            </div>
        );
    }

    if (success) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] px-4">
                <div className="max-w-md w-full bg-white rounded-2xl border border-gray-200 p-8 text-center">
                    <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
                        <CheckCircle2 size={48} className="text-green-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-[#1a2744] mb-2">Richiesta Inviata!</h2>
                    <p className="text-gray-600 mb-6">
                        Il consulente ti ricontattera' a breve su questo contatto per fissare l'orario della call.
                    </p>
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 text-left">
                        <div className="text-sm text-blue-900">
                            <strong>Consulente:</strong> {consultantName}
                        </div>
                    </div>
                    <Link href="/" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#1a2744] text-white font-medium hover:bg-[#0f3460]">
                        Torna alla Home
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f8fafc] py-12 px-4">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <Link href="/" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 mb-4">
                        <ArrowLeft size={16} /> Torna al sito
                    </Link>
                    <h1 className="text-3xl font-bold text-[#1a2744]">Prenota una Call Gratuita</h1>
                    <p className="text-gray-600 mt-1">
                        {consultantName ? `Richiedi una call con ${consultantName}` : 'Seleziona un link di prenotazione disponibile e compila il form'} - ti ricontattera' per fissare l'orario.
                    </p>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                    {/* Colonna Sinistra: Link di prenotazione disponibili.
                        Il modello Odoo reale (erpv6.booking.token) non ha
                        giorno/ora - e' un link monouso valido fino a una
                        scadenza. Niente calendario con orari finti. */}
                    <div className="bg-white rounded-2xl border border-gray-200 p-6">
                        <h2 className="text-xl font-bold text-[#1a2744] mb-4 flex items-center gap-2">
                            <Calendar size={20} className="text-orange-500" />
                            Link Disponibili
                        </h2>

                        {slots.length === 0 ? (
                            <div className="text-center py-12">
                                <Calendar size={48} className="mx-auto mb-4 text-gray-300" />
                                <p className="text-gray-500">Nessun link di prenotazione disponibile al momento</p>
                                <p className="text-sm text-gray-400 mt-2">Riprova più tardi o contattaci direttamente</p>
                            </div>
                        ) : (
                            <div className="space-y-3 max-h-[500px] overflow-y-auto">
                                {slots.map((slot) => (
                                    <button
                                        key={slot.token}
                                        onClick={() => handleSlotSelect(slot)}
                                        className={`w-full p-4 rounded-xl border-2 text-left transition-all ${selectedSlot?.token === slot.token
                                                ? 'border-orange-500 bg-orange-50'
                                                : 'border-gray-200 hover:border-orange-300 hover:bg-gray-50'
                                            }`}
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <Video size={16} className="text-orange-500" />
                                                <span className="font-bold text-[#1a2744]">Call con {consultantName}</span>
                                            </div>
                                            {selectedSlot?.token === slot.token && (
                                                <CheckCircle2 size={20} className="text-orange-500" />
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1 text-sm text-gray-600">
                                            <Clock size={14} />
                                            <span>
                                                Valido fino al {new Date(slot.expires_at).toLocaleString('it-IT', {
                                                    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                                                })}
                                            </span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Colonna Destra: Form Prenotazione */}
                    <div className="bg-white rounded-2xl border border-gray-200 p-6">
                        <h2 className="text-xl font-bold text-[#1a2744] mb-4 flex items-center gap-2">
                            <User size={20} className="text-orange-500" />
                            I Tuoi Dati
                        </h2>

                        {error && (
                            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
                                <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
                                <div className="text-sm text-red-800">{error}</div>
                            </div>
                        )}

                        {selectedSlot ? (
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="p-4 bg-orange-50 border border-orange-200 rounded-xl mb-4">
                                    <div className="text-sm font-bold text-orange-900 mb-1">Link Selezionato</div>
                                    <div className="text-sm text-orange-800">
                                        Call con {consultantName} - valido fino al {new Date(selectedSlot.expires_at).toLocaleString('it-IT', {
                                            day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit'
                                        })}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Nome Completo *
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.clientName}
                                        onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                                        placeholder="Mario Rossi"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Email *
                                    </label>
                                    <input
                                        type="email"
                                        value={formData.clientEmail}
                                        onChange={(e) => setFormData({ ...formData, clientEmail: e.target.value })}
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                                        placeholder="mario@example.com"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Telefono
                                    </label>
                                    <input
                                        type="tel"
                                        value={formData.clientPhone}
                                        onChange={(e) => setFormData({ ...formData, clientPhone: e.target.value })}
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                                        placeholder="+39 333 1234567"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Note (opzionale)
                                    </label>
                                    <textarea
                                        value={formData.notes}
                                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                        rows={3}
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 resize-none"
                                        placeholder="Argomenti che vuoi discutere..."
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold py-4 rounded-xl hover:shadow-xl transition-all disabled:opacity-50"
                                >
                                    {submitting ? (
                                        <>
                                            <Loader2 size={20} className="animate-spin" />
                                            Prenotazione in corso...
                                        </>
                                    ) : (
                                        <>
                                            <CheckCircle2 size={20} />
                                            Conferma Prenotazione
                                        </>
                                    )}
                                </button>

                                <p className="text-xs text-gray-500 text-center">
                                    🔒 I tuoi dati sono al sicuro. Non condividiamo informazioni con terzi.
                                </p>
                            </form>
                        ) : (
                            <div className="text-center py-12">
                                <Calendar size={48} className="mx-auto mb-4 text-gray-300" />
                                <p className="text-gray-500">Seleziona uno slot dalla colonna a sinistra</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
