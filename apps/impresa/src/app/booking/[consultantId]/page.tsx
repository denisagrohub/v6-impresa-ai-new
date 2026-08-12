"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
    Calendar, Clock, User, Mail, Phone, CheckCircle2,
    ArrowLeft, Loader2, AlertCircle
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

    useEffect(() => {
        // Carica slot pubblici disponibili per questo consulente
        fetch(`/api/consultant/public-slots?consultantId=${consultantId}`)
            .then(res => res.json())
            .then(data => {
                setSlots(data.slots || []);
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
                    bookingToken: selectedSlot.bookingToken,
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
                    <h2 className="text-2xl font-bold text-[#1a2744] mb-2">Prenotazione Confermata!</h2>
                    <p className="text-gray-600 mb-6">
                        Riceverai un'email di conferma con tutti i dettagli dell'appuntamento.
                    </p>
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 text-left">
                        <div className="text-sm text-blue-900">
                            <strong>Data:</strong> {new Date(selectedSlot.date).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}<br />
                            <strong>Ora:</strong> {selectedSlot.time}<br />
                            <strong>Durata:</strong> {selectedSlot.duration} minuti<br />
                            <strong>Consulente:</strong> {selectedSlot.consultantName}
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
                        Seleziona uno slot disponibile e compila il form per prenotare la tua call di 30 minuti
                    </p>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                    {/* Colonna Sinistra: Slot Disponibili */}
                    <div className="bg-white rounded-2xl border border-gray-200 p-6">
                        <h2 className="text-xl font-bold text-[#1a2744] mb-4 flex items-center gap-2">
                            <Calendar size={20} className="text-orange-500" />
                            Slot Disponibili
                        </h2>

                        {slots.length === 0 ? (
                            <div className="text-center py-12">
                                <Calendar size={48} className="mx-auto mb-4 text-gray-300" />
                                <p className="text-gray-500">Nessuno slot disponibile al momento</p>
                                <p className="text-sm text-gray-400 mt-2">Riprova più tardi o contattaci direttamente</p>
                            </div>
                        ) : (
                            <div className="space-y-3 max-h-[500px] overflow-y-auto">
                                {slots.map((slot) => (
                                    <button
                                        key={slot.id}
                                        onClick={() => handleSlotSelect(slot)}
                                        className={`w-full p-4 rounded-xl border-2 text-left transition-all ${selectedSlot?.id === slot.id
                                                ? 'border-orange-500 bg-orange-50'
                                                : 'border-gray-200 hover:border-orange-300 hover:bg-gray-50'
                                            }`}
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <Calendar size={16} className="text-orange-500" />
                                                <span className="font-bold text-[#1a2744]">
                                                    {new Date(slot.date).toLocaleDateString('it-IT', {
                                                        weekday: 'short',
                                                        day: 'numeric',
                                                        month: 'short'
                                                    })}
                                                </span>
                                            </div>
                                            {selectedSlot?.id === slot.id && (
                                                <CheckCircle2 size={20} className="text-orange-500" />
                                            )}
                                        </div>
                                        <div className="flex items-center gap-4 text-sm text-gray-600">
                                            <div className="flex items-center gap-1">
                                                <Clock size={14} />
                                                <span>{slot.time}</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <span>{slot.duration} min</span>
                                            </div>
                                        </div>
                                        <div className="text-xs text-gray-500 mt-1">
                                            con {slot.consultantName}
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
                                    <div className="text-sm font-bold text-orange-900 mb-1">Slot Selezionato</div>
                                    <div className="text-sm text-orange-800">
                                        {new Date(selectedSlot.date).toLocaleDateString('it-IT', {
                                            weekday: 'long',
                                            day: 'numeric',
                                            month: 'long',
                                            year: 'numeric'
                                        })} alle {selectedSlot.time}
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
