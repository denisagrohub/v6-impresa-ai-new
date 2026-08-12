"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { CheckCircle, AlertCircle, Loader2, FileText, Lock } from "lucide-react";

export default function OnboardingPage() {
    const params = useParams();
    const router = useRouter();
    const token = params.token as string;

    const [loading, setLoading] = useState(true);
    const [valid, setValid] = useState(false);
    const [consultant, setConsultant] = useState<any>(null);
    const [step, setStep] = useState(1);
    const [submitting, setSubmitting] = useState(false);

    const [formData, setFormData] = useState({
        password: "",
        confirmPassword: "",
        cvUploaded: false,
        acceptedTerms: false
    });

    useEffect(() => {
        verifyToken();
    }, [token]);

    const verifyToken = async () => {
        try {
            const res = await fetch(`/api/onboarding/verify?token=${token}`);
            const data = await res.json();
            if (data.valid) {
                setValid(true);
                setConsultant(data.consultant);
            } else {
                setValid(false);
            }
        } catch (error) {
            setValid(false);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async () => {
        if (formData.password !== formData.confirmPassword) {
            alert("Le password non corrispondono");
            return;
        }
        if (!formData.acceptedTerms) {
            alert("Devi accettare i termini e condizioni");
            return;
        }

        setSubmitting(true);
        try {
            const res = await fetch('/api/onboarding/complete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    token,
                    password: formData.password,
                    cvUploaded: formData.cvUploaded,
                    acceptedTerms: formData.acceptedTerms
                })
            });

            if (res.ok) {
                setStep(3);
            } else {
                alert("Errore durante il salvataggio");
            }
        } catch (error) {
            alert("Errore di connessione");
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

    if (!valid) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] p-4">
                <div className="bg-white rounded-2xl border border-red-200 p-8 max-w-md w-full text-center">
                    <AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-[#1a2744] mb-2">Link Non Valido</h2>
                    <p className="text-gray-500">Questo link di onboarding è scaduto o è già stato utilizzato. Contatta l'amministratore per riceverne uno nuovo.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-lg max-w-lg w-full p-8">
                {step === 1 && (
                    <div className="space-y-6">
                        <div className="text-center">
                            <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <span className="text-2xl font-bold text-orange-600">{consultant?.name.charAt(0)}</span>
                            </div>
                            <h1 className="text-2xl font-bold text-[#1a2744]">Benvenuto in Progetto Impresa</h1>
                            <p className="text-gray-500 mt-2">Ciao {consultant?.name}, completa la tua registrazione per attivare il tuo account.</p>
                        </div>
                        <button onClick={() => setStep(2)} className="w-full py-3 bg-[#1a2744] text-white rounded-xl font-bold hover:bg-[#0f3460] transition-colors">
                            Inizia Registrazione
                        </button>
                    </div>
                )}

                {step === 2 && (
                    <div className="space-y-6">
                        <h2 className="text-xl font-bold text-[#1a2744]">Imposta le tue credenziali</h2>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                            <input
                                type="password"
                                value={formData.password}
                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-orange-500/20"
                                placeholder="Minimo 8 caratteri"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Conferma Password</label>
                            <input
                                type="password"
                                value={formData.confirmPassword}
                                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-orange-500/20"
                                placeholder="Ripeti la password"
                            />
                        </div>

                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 border-dashed flex items-center gap-4">
                            <FileText size={24} className="text-gray-400" />
                            <div className="flex-1">
                                <div className="text-sm font-medium text-gray-700">Carica il tuo CV (PDF)</div>
                                <div className="text-xs text-gray-500">Facoltativo, ma consigliato</div>
                            </div>
                            <button
                                onClick={() => setFormData({ ...formData, cvUploaded: true })}
                                className={`px-3 py-1.5 rounded-lg text-sm font-medium ${formData.cvUploaded ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}
                            >
                                {formData.cvUploaded ? 'Caricato ✓' : 'Sfoglia'}
                            </button>
                        </div>

                        <label className="flex items-start gap-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={formData.acceptedTerms}
                                onChange={(e) => setFormData({ ...formData, acceptedTerms: e.target.checked })}
                                className="mt-1 w-4 h-4 text-orange-500 rounded border-gray-300"
                            />
                            <span className="text-sm text-gray-600">
                                Accetto i <span className="text-orange-600 underline">Termini e Condizioni</span> e l'Accordo di Riservatezza (NDA) di Progetto Impresa.
                            </span>
                        </label>

                        <div className="flex gap-3 pt-2">
                            <button onClick={() => setStep(1)} className="flex-1 py-3 border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50">
                                Indietro
                            </button>
                            <button
                                onClick={handleSubmit}
                                disabled={submitting}
                                className="flex-1 py-3 bg-orange-500 text-white rounded-xl font-bold hover:bg-orange-600 flex items-center justify-center gap-2"
                            >
                                {submitting ? <Loader2 size={20} className="animate-spin" /> : 'Completa Registrazione'}
                            </button>
                        </div>
                    </div>
                )}

                {step === 3 && (
                    <div className="text-center space-y-6">
                        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                            <CheckCircle size={40} className="text-green-600" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-[#1a2744]">Registrazione Completata!</h2>
                            <p className="text-gray-500 mt-2">
                                Il tuo account è ora attivo. Puoi accedere alla tua dashboard utilizzando la password che hai appena impostato.
                            </p>
                        </div>
                        <button onClick={() => router.push('/login')} className="w-full py-3 bg-[#1a2744] text-white rounded-xl font-bold hover:bg-[#0f3460] flex items-center justify-center gap-2">
                            <Lock size={18} /> Vai al Login
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
