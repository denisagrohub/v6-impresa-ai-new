"use client";
import { useState } from "react";
import { Mail, Phone, MapPin, Clock, Send, CheckCircle2, AlertCircle } from "lucide-react";

export default function ContattiPage() {
    const [formData, setFormData] = useState({ nome: "", email: "", telefono: "", messaggio: "", motivo: "" });
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [submitted, setSubmitted] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState("");

    const update = (f: string, v: string) => {
        setFormData({ ...formData, [f]: v });
        if (errors[f]) setErrors({ ...errors, [f]: "" });
    };

    const validate = (): boolean => {
        const newErrors: Record<string, string> = {};
        if (!formData.nome.trim()) newErrors.nome = "Obbligatorio";
        if (!formData.email.trim()) newErrors.email = "Obbligatorio";
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) newErrors.email = "Email non valida";
        if (!formData.messaggio.trim()) newErrors.messaggio = "Obbligatorio";
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate()) return;

        setSubmitting(true);
        setSubmitError("");
        try {
            const response = await fetch('/api/leads', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    source: 'contatti',
                    data: {
                        nome: formData.nome,
                        email: formData.email,
                        telefono: formData.telefono,
                        obiettivi: formData.motivo
                            ? `[${formData.motivo}] ${formData.messaggio}`
                            : formData.messaggio,
                    },
                }),
            });
            const responseBody = await response.json().catch(() => null);
            if (!response.ok || !responseBody?.success) {
                throw new Error(responseBody?.error || `Invio fallito (${response.status})`);
            }
            setSubmitted(true);
        } catch (error) {
            console.error('Errore invio contatto:', error);
            setSubmitError("Errore durante l'invio. Riprova più tardi o scrivici direttamente via email.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-white">
            {/* HERO */}
            <section className="relative py-24 bg-gradient-to-br from-[#1a2744] to-[#0f172a] text-white overflow-hidden">
                <div className="absolute inset-0 opacity-20">
                    <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-orange-500 rounded-full mix-blend-multiply filter blur-3xl" />
                </div>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                    <div className="max-w-3xl">
                        <h1 className="text-5xl sm:text-6xl font-bold mb-6 leading-tight">
                            Parliamo del tuo <span className="text-orange-400">progetto</span>
                        </h1>
                        <p className="text-xl text-gray-300 leading-relaxed">
                            Compila il form o contattaci direttamente. Rispondiamo entro 24 ore lavorative.
                        </p>
                    </div>
                </div>
            </section>

            {/* CONTATTI + FORM */}
            <section className="py-24 bg-[#f8fafc]">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid lg:grid-cols-2 gap-12">
                        {/* Info */}
                        <div className="space-y-8">
                            <div>
                                <h2 className="text-3xl font-bold text-[#1a2744] mb-6">Informazioni di contatto</h2>
                                <p className="text-gray-600 mb-8">
                                    Siamo disponibili per una prima consulenza gratuita. Scegli il canale che preferisci.
                                </p>
                            </div>

                            <div className="space-y-4">
                                {[
                                    { icon: Mail, label: "Email", value: "info@progettoimpresa.it", sub: "Risposta entro 24h" },
                                    { icon: Phone, label: "Telefono", value: "+39 02 123 4567", sub: "Lun-Ven 9:00-18:00" },
                                    { icon: MapPin, label: "Sede", value: "Via Monte Napoleone, 8", sub: "20121 Milano MI" },
                                    { icon: Clock, label: "Orari", value: "Lunedì - Venerdì", sub: "9:00 - 18:00" },
                                ].map((item, i) => (
                                    <div key={i} className="flex items-start gap-4 p-4 bg-white rounded-xl border border-gray-100">
                                        <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0">
                                            <item.icon size={20} className="text-orange-600" />
                                        </div>
                                        <div>
                                            <div className="text-xs text-gray-500 uppercase font-bold mb-1">{item.label}</div>
                                            <div className="font-semibold text-[#1a2744]">{item.value}</div>
                                            <div className="text-sm text-gray-500">{item.sub}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-2xl p-6 border border-orange-200">
                                <div className="text-sm font-bold text-orange-700 uppercase mb-2">Consulenza gratuita</div>
                                <p className="text-gray-800 text-sm leading-relaxed">
                                    La prima call di 30 minuti è sempre gratuita e senza impegno. Serve a capire se possiamo aiutarti e come.
                                </p>
                            </div>
                        </div>

                        {/* Form */}
                        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
                            {!submitted ? (
                                <>
                                    <h3 className="text-2xl font-bold text-[#1a2744] mb-2">Scrivici un messaggio</h3>
                                    <p className="text-gray-500 mb-6">Ti rispondiamo entro 24 ore lavorative.</p>

                                    <form onSubmit={handleSubmit} className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Nome completo *</label>
                                            <input
                                                type="text" value={formData.nome} onChange={(e) => update("nome", e.target.value)}
                                                className={`w-full px-4 py-3 rounded-xl border ${errors.nome ? 'border-red-400 bg-red-50' : 'border-gray-200'} focus:outline-none focus:ring-2 focus:ring-orange-500/20`}
                                                placeholder="Mario Rossi"
                                            />
                                            {errors.nome && <p className="mt-1 text-sm text-red-600 flex items-center gap-1"><AlertCircle size={14} />{errors.nome}</p>}
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                                                <input
                                                    type="email" value={formData.email} onChange={(e) => update("email", e.target.value)}
                                                    className={`w-full px-4 py-3 rounded-xl border ${errors.email ? 'border-red-400 bg-red-50' : 'border-gray-200'} focus:outline-none focus:ring-2 focus:ring-orange-500/20`}
                                                    placeholder="mario@example.com"
                                                />
                                                {errors.email && <p className="mt-1 text-sm text-red-600 flex items-center gap-1"><AlertCircle size={14} />{errors.email}</p>}
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Telefono</label>
                                                <input
                                                    type="tel" value={formData.telefono} onChange={(e) => update("telefono", e.target.value)}
                                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                                                    placeholder="+39 333 123 4567"
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Motivo del contatto</label>
                                            <select
                                                value={formData.motivo} onChange={(e) => update("motivo", e.target.value)}
                                                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 bg-white"
                                            >
                                                <option value="">Seleziona...</option>
                                                <option value="l1">Pacchetto Startup (L1)</option>
                                                <option value="l2">Piano Industriale PMI (L2)</option>
                                                <option value="l3">Advisory & Project Finance (L3)</option>
                                                <option value="info">Informazioni generali</option>
                                                <option value="altro">Altro</option>
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Messaggio *</label>
                                            <textarea
                                                value={formData.messaggio} onChange={(e) => update("messaggio", e.target.value)}
                                                rows={5}
                                                className={`w-full px-4 py-3 rounded-xl border ${errors.messaggio ? 'border-red-400 bg-red-50' : 'border-gray-200'} focus:outline-none focus:ring-2 focus:ring-orange-500/20 resize-none`}
                                                placeholder="Descrivi brevemente il tuo progetto..."
                                            />
                                            {errors.messaggio && <p className="mt-1 text-sm text-red-600 flex items-center gap-1"><AlertCircle size={14} />{errors.messaggio}</p>}
                                        </div>

                                        {submitError && (
                                            <p className="text-sm text-red-600 flex items-center gap-1"><AlertCircle size={14} />{submitError}</p>
                                        )}

                                        <button
                                            type="submit"
                                            disabled={submitting}
                                            className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold py-4 rounded-xl hover:shadow-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                        >
                                            <Send size={18} />
                                            <span>{submitting ? "Invio in corso..." : "Invia messaggio"}</span>
                                        </button>
                                    </form>
                                </>
                            ) : (
                                <div className="text-center py-12">
                                    <CheckCircle2 size={64} className="mx-auto mb-4 text-green-500" />
                                    <h3 className="text-2xl font-bold mb-2 text-[#1a2744]">Messaggio inviato!</h3>
                                    <p className="text-gray-600">
                                        Ti risponderemo entro 24 ore lavorative all'indirizzo {formData.email}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}
