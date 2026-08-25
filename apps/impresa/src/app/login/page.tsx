"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Mail, ArrowRight, AlertCircle } from "lucide-react";

export default function UnifiedLoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        // Login reale contro Odoo (25/08/2026): niente piu' credenziali
        // hardcoded nel frontend. /api/auth/login verifica email+password
        // contro erpv6_api_gateway (/api/v1/auth/login), che a sua volta
        // autentica sul database Odoo vero e restituisce il ruolo reale
        // dell'utente (admin/consultant/client) in base ai suoi gruppi -
        // mai un ruolo dedotto lato frontend.
        try {
            const res = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });
            const result = await res.json();

            if (!res.ok || !result.success) {
                setError(result.error || "Credenziali errate.");
                setLoading(false);
                return;
            }

            const { user, token } = result;
            const sessionData = JSON.stringify({
                role: user.role,
                name: user.name,
                email: user.email,
                clientId: String(user.id),
                partnerId: user.partnerId,
                // erpv6.consulting.consultant.id reale - usato per il link
                // pubblico di prenotazione (/booking/<id>). Null se questo
                // utente non e' ancora collegato a nessun consulente reale
                // (vedi report: da creare esplicitamente, mai dedotto).
                bookingConsultantId: user.consultantId,
                token, // JWT emesso da Odoo (erpv6.api.key/_generate_jwt) - usato per le chiamate autenticate al gateway
            });

            let redirectUrl = "/dashboard";
            if (user.role === "admin") redirectUrl = "/admin/dashboard";
            else if (user.role === "consultant") redirectUrl = "/consultant/dashboard";

            localStorage.setItem("pi_session", sessionData);
            document.cookie = `pi_session=${encodeURIComponent(sessionData)}; path=/; max-age=86400`;

            window.location.href = redirectUrl;
        } catch (err) {
            setError("Errore di connessione al server. Riprova.");
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#f8fafc] to-[#e2e8f0] flex items-center justify-center py-12 px-4">
            <div className="max-w-md w-full">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#1a2744] to-[#0f3460] mb-4">
                        <Lock size={32} className="text-white" />
                    </div>
                    <h1 className="text-3xl font-bold text-[#1a2744] mb-2">Accedi alla Piattaforma</h1>
                    <p className="text-gray-600">Area riservata unificata</p>
                </div>

                <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
                    {error && (
                        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
                            <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
                            <div className="text-sm text-red-800">{error}</div>
                        </div>
                    )}

                    <form onSubmit={handleLogin} className="space-y-5">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                            <div className="relative">
                                <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20" placeholder="nome@azienda.it" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                            <div className="relative">
                                <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20" placeholder="••••••••" />
                            </div>
                        </div>
                        <button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[#1a2744] to-[#0f3460] text-white font-bold py-3 rounded-xl hover:shadow-lg transition-all disabled:opacity-50">
                            {loading ? "Accesso..." : <><span>Accedi</span><ArrowRight size={18} /></>}
                        </button>
                    </form>

                    <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800">
                        Accesso con le credenziali reali del tuo account Odoo (email e password del consulente/amministratore).
                    </div>
                </div>
            </div>
        </div>
    );
}
