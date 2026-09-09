"use client";
import { useState } from "react";
import { Handshake, Send, CheckCircle2, AlertCircle } from "lucide-react";

// Pagina pubblica "Diventa partner V6" (09/09/2026, prompt "Candidatura
// partnership + routing token prodotto + rotazione claim homepage",
// Parte A). Scope volutamente minimo: raccoglie interesse, non apre
// nessun accesso al sistema - nessun portale, nessuna autenticazione
// nuova, nessun consulente creato automaticamente. Stesso pattern di
// form/stile di /contatti, submit reale verso /api/partnership (mai un
// successo simulato: un errore di rete propaga davvero all'utente).
export default function PartnershipPage() {
    const [formData, setFormData] = useState({
        name: "", company_name: "", email: "", phone: "", proposal: "",
    });
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
        if (!formData.name.trim()) newErrors.name = "Obbligatorio";
        if (!formData.email.trim()) newErrors.email = "Obbligatorio";
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) newErrors.email = "Email non valida";
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate()) return;

        setSubmitting(true);
        setSubmitError("");
        try {
            const response = await fetch('/api/partnership', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });
            const responseBody = await response.json().catch(() => null);
            if (!response.ok || !responseBody?.success) {
                throw new Error(responseBody?.error || `Invio fallito (${response.status})`);
            }
            setSubmitted(true);
        } catch (error) {
            console.error('Errore invio candidatura partnership:', error);
            setSubmitError("Errore durante l'invio. Riprova più tardi o scrivici direttamente via email.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#F7F3ED]">
            {/* HERO */}
            <section className="bg-[#0F1E3C] px-4 pb-16 pt-14 sm:px-6 sm:pt-20 lg:px-8 lg:pt-24">
                <div className="mx-auto max-w-3xl text-center">
                    <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-xl bg-[#D4703A]/15">
                        <Handshake size={28} className="text-[#D4703A]" aria-hidden="true" />
                    </div>
                    <h1 className="text-balance font-serif text-4xl font-bold leading-[1.1] text-[#F8F6F2] sm:text-5xl">
                        Diventa partner V6
                    </h1>
                    <p className="mt-6 text-lg leading-relaxed text-stone-300 sm:text-xl">
                        Consulenti, commercialisti, direttori di banca, professionisti che seguono
                        già imprese: raccontaci la tua proposta di collaborazione. La valutiamo di
                        persona, senza automatismi.
                    </p>
                </div>
            </section>

            {/* FORM */}
            <section className="py-16 sm:py-20">
                <div className="mx-auto max-w-xl px-4 sm:px-6 lg:px-8">
                    <div className="rounded-2xl border border-stone-200 bg-white p-8 shadow-sm">
                        {!submitted ? (
                            <>
                                <h2 className="text-2xl font-bold text-[#1C2128]">Racconta la tua proposta</h2>
                                <p className="mt-2 text-sm text-stone-500">
                                    Ti risponderemo di persona: questa candidatura non crea nessun accesso
                                    automatico al sistema.
                                </p>

                                <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                                    <div>
                                        <label className="mb-1 block text-sm font-medium text-stone-700">Nome e cognome *</label>
                                        <input
                                            type="text" value={formData.name} onChange={(e) => update("name", e.target.value)}
                                            className={`w-full rounded-xl border px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#D4703A]/20 ${errors.name ? 'border-red-400 bg-red-50' : 'border-stone-200'}`}
                                            placeholder="Mario Rossi"
                                        />
                                        {errors.name && <p className="mt-1 flex items-center gap-1 text-sm text-red-600"><AlertCircle size={14} />{errors.name}</p>}
                                    </div>

                                    <div>
                                        <label className="mb-1 block text-sm font-medium text-stone-700">Azienda / studio</label>
                                        <input
                                            type="text" value={formData.company_name} onChange={(e) => update("company_name", e.target.value)}
                                            className="w-full rounded-xl border border-stone-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#D4703A]/20"
                                            placeholder="Studio Rossi & Associati"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="mb-1 block text-sm font-medium text-stone-700">Email *</label>
                                            <input
                                                type="email" value={formData.email} onChange={(e) => update("email", e.target.value)}
                                                className={`w-full rounded-xl border px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#D4703A]/20 ${errors.email ? 'border-red-400 bg-red-50' : 'border-stone-200'}`}
                                                placeholder="mario@example.com"
                                            />
                                            {errors.email && <p className="mt-1 flex items-center gap-1 text-sm text-red-600"><AlertCircle size={14} />{errors.email}</p>}
                                        </div>
                                        <div>
                                            <label className="mb-1 block text-sm font-medium text-stone-700">Telefono</label>
                                            <input
                                                type="tel" value={formData.phone} onChange={(e) => update("phone", e.target.value)}
                                                className="w-full rounded-xl border border-stone-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#D4703A]/20"
                                                placeholder="+39 333 123 4567"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="mb-1 block text-sm font-medium text-stone-700">La tua proposta di collaborazione</label>
                                        <textarea
                                            value={formData.proposal} onChange={(e) => update("proposal", e.target.value)}
                                            rows={5}
                                            className="w-full resize-none rounded-xl border border-stone-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#D4703A]/20"
                                            placeholder="Chi sei, con che tipo di clienti lavori, che tipo di collaborazione hai in mente..."
                                        />
                                    </div>

                                    {submitError && (
                                        <p className="flex items-center gap-1 text-sm text-red-600"><AlertCircle size={14} />{submitError}</p>
                                    )}

                                    <button
                                        type="submit"
                                        disabled={submitting}
                                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#D4703A] py-4 font-bold text-white transition-all hover:bg-[#c05f2e] hover:shadow-xl disabled:opacity-50"
                                    >
                                        <Send size={18} aria-hidden="true" />
                                        <span>{submitting ? "Invio in corso..." : "Invia candidatura"}</span>
                                    </button>
                                </form>
                            </>
                        ) : (
                            <div className="py-8 text-center">
                                <CheckCircle2 size={64} className="mx-auto mb-4 text-green-500" aria-hidden="true" />
                                <h2 className="mb-2 text-2xl font-bold text-[#1C2128]">Candidatura ricevuta</h2>
                                <p className="text-stone-600">
                                    Grazie {formData.name.split(" ")[0]}, abbiamo ricevuto la tua proposta.
                                    Ti risponderemo direttamente all&rsquo;indirizzo {formData.email}.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </section>
        </div>
    );
}
