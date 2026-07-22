"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, User, Loader2, Server, Globe, ArrowRight } from "lucide-react";

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [sessionInfo, setSessionInfo] = useState<any>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    
    try {
      // Demo: in produzione si collega a Odoo
      if (username === "admin" && password === "admin") {
        setSessionInfo({ 
          username: "admin", 
          user_context: { company_name: "AgroHub Group" } 
        });
        setAuthenticated(true);
      } else {
        setError("Credenziali non valide");
      }
    } catch {
      setError("Errore di connessione al server");
    } finally {
      setLoading(false);
    }
  };

  const chooseBackend = (target: 'odoo' | 'nextjs') => {
    if (target === 'odoo') {
      alert("In produzione: redirect al backend Odoo");
    } else {
      localStorage.setItem("odoo_session", JSON.stringify(sessionInfo));
      router.push("/admin/dashboard");
    }
  };

  // Schermata scelta backend (dopo login riuscito)
  if (authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#f8fafc' }}>
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 max-w-2xl w-full">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center mx-auto mb-4">
              <span className="text-white text-2xl font-bold">
                {sessionInfo.username?.[0]?.toUpperCase()}
              </span>
            </div>
            <h1 className="text-2xl font-bold" style={{ color: '#1a2744' }}>
              Benvenuto, {sessionInfo.username}!
            </h1>
            <p className="text-gray-500 text-sm mt-2">
              Autenticato come <strong>{sessionInfo.user_context?.company_name}</strong>
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <button 
              onClick={() => chooseBackend('odoo')}
              className="group p-6 rounded-2xl border-2 border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-all text-left"
            >
              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center mb-4">
                <Server size={24} className="text-blue-600" />
              </div>
              <h3 className="font-bold text-lg mb-1">Backend Odoo</h3>
              <p className="text-sm text-gray-500 mb-3">CRM, fatture, configurazione AI</p>
              <div className="flex items-center gap-2 text-blue-600 font-semibold text-sm">
                <span>Accedi</span>
                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </div>
            </button>

            <button 
              onClick={() => chooseBackend('nextjs')}
              className="group p-6 rounded-2xl border-2 border-gray-200 hover:border-orange-500 hover:bg-orange-50 transition-all text-left"
            >
              <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center mb-4">
                <Globe size={24} className="text-orange-600" />
              </div>
              <h3 className="font-bold text-lg mb-1">Pannello Progetto Impresa</h3>
              <p className="text-sm text-gray-500 mb-3">Dashboard, validazione BP, editor</p>
              <div className="flex items-center gap-2 text-orange-600 font-semibold text-sm">
                <span>Accedi</span>
                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Schermata login iniziale
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#f8fafc' }}>
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 max-w-md w-full">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center mx-auto mb-4">
            <Server size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold" style={{ color: '#1a2744' }}>Accesso Unificato</h1>
          <p className="text-gray-500 text-sm mt-2">Usa le tue credenziali Odoo</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
            <input 
              type="text" 
              value={username} 
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
              placeholder="admin"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
              placeholder="admin"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
              {error}
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold py-3 rounded-xl hover:shadow-xl transition-all disabled:opacity-50"
          >
            {loading ? (
              <Loader2 size={20} className="animate-spin mx-auto" />
            ) : (
              "Accedi"
            )}
          </button>

          <p className="text-xs text-gray-400 text-center">
            Demo: admin / admin
          </p>
        </form>
      </div>
    </div>
  );
}
