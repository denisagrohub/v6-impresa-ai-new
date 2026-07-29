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

        setTimeout(() => {
            let sessionData = "";
            let redirectUrl = "/login";

            if (email === "admin@progettoimpresa.it" && password === "admin123") {
                sessionData = JSON.stringify({ role: "admin", name: "Amministratore", clientId: "admin_001", token: Date.now() });
                redirectUrl = "/admin/dashboard";
            } else if (email === "demo@progettoimpresa.it" && password === "demo123") {
                sessionData = JSON.stringify({ role: "client", name: "Mario Rossi", clientId: "client_001", token: Date.now() });
                redirectUrl = "/dashboard";
            } else if (email === "christian@progettoimpresa.it" && password === "consultant123") {
                sessionData = JSON.stringify({ role: "consultant", name: "Christian Rossi", clientId: "PART-004", token: Date.now() });
                redirectUrl = "/consultant/dashboard";
            } else {
                setError("Credenziali errate. Usa le demo indicate sotto.");
                setLoading(false);
                return;
            }

            localStorage.setItem("pi_session", sessionData);
            // 🔥 Aggiungi 'domain' per assicurarti che il cookie sia valido su localhost
            document.cookie = `pi_session=${encodeURIComponent(sessionData)}; path=/; max-age=86400; domain=localhost`;

            window.location.href = redirectUrl;
        }, 500);
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

                    <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800 space-y-1">
                        <div><strong>👨‍💼 Admin:</strong> admin@progettoimpresa.it / admin123</div>
                        <div><strong>👤 Cliente:</strong> demo@progettoimpresa.it / demo123</div>
                        <div><strong>👔 Consulente:</strong> christian@progettoimpresa.it / consultant123</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
