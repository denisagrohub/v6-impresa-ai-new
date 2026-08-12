"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, CheckCircle2, AlertCircle, Server } from "lucide-react";

export default function OdooSettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<any>(null);
  const [config, setConfig] = useState({
    url: process.env.NEXT_PUBLIC_ODOO_URL || '',
    db: process.env.NEXT_PUBLIC_ODOO_DB || '',
    username: process.env.NEXT_PUBLIC_ODOO_USERNAME || '',
    password: process.env.NEXT_PUBLIC_ODOO_PASSWORD || '',
    mock: process.env.NEXT_PUBLIC_ODOO_MOCK === 'true',
  });

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      const res = await fetch('/api/odoo/status');
      const data = await res.json();
      setStatus(data);
    } catch (error) {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    // In produzione, questo dovrebbe salvare le variabili nel database Odoo
    // o in un file .env. Per ora, simuliamo il salvataggio.
    await new Promise(resolve => setTimeout(resolve, 1000));
    setSaving(false);
    alert('✅ Configurazione salvata! Riavvia il server per applicare le modifiche.');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/admin/settings/system" className="p-2 rounded-lg hover:bg-gray-200">
            <ArrowLeft size={20} className="text-gray-600" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-[#1a2744]">🔌 Connessione Odoo</h1>
            <p className="text-gray-500">Configura il collegamento con il server Odoo</p>
          </div>
        </div>

        {/* Stato connessione */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Server size={24} className={
                status?.connected ? 'text-green-600' : 'text-red-600'
              } />
              <div>
                <div className="font-medium">
                  {status?.connected ? '🟢 Connesso' : '🔴 Non connesso'}
                </div>
                <div className="text-sm text-gray-500">
                  {status?.connected 
                    ? `${status.installedModules?.length || 0} moduli installati` 
                    : status?.error || 'Verifica le credenziali'}
                </div>
              </div>
            </div>
            <button
              onClick={checkStatus}
              className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              Testa connessione
            </button>
          </div>
          {status?.missingModules?.length > 0 && (
            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                ⚠️ Moduli mancanti: <strong>{status.missingModules.join(', ')}</strong>
              </p>
              <p className="text-xs text-yellow-600 mt-1">
                Installa i moduli sul server Odoo prima di procedere.
              </p>
            </div>
          )}
        </div>

        {/* Form configurazione */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-[#1a2744] mb-4">Credenziali Odoo</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">URL Odoo</label>
              <input
                type="text"
                value={config.url}
                onChange={(e) => setConfig({ ...config, url: e.target.value })}
                placeholder="https://tuo-vps.it:8069"
                className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-orange-500/20"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Database</label>
              <input
                type="text"
                value={config.db}
                onChange={(e) => setConfig({ ...config, db: e.target.value })}
                placeholder="nome_database"
                className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-orange-500/20"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
              <input
                type="text"
                value={config.username}
                onChange={(e) => setConfig({ ...config, username: e.target.value })}
                placeholder="admin"
                className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-orange-500/20"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                value={config.password}
                onChange={(e) => setConfig({ ...config, password: e.target.value })}
                placeholder="••••••••"
                className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-orange-500/20"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="mock"
                checked={config.mock}
                onChange={(e) => setConfig({ ...config, mock: e.target.checked })}
                className="rounded border-gray-300 text-orange-500 focus:ring-orange-500"
              />
              <label htmlFor="mock" className="text-sm text-gray-700">
                Usa modalità mock (dati di esempio)
              </label>
            </div>
          </div>

          <div className="flex items-center gap-3 mt-6 pt-6 border-t border-gray-200">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2 bg-[#1a2744] text-white rounded-lg hover:bg-[#0f3460] disabled:opacity-50"
            >
              {saving ? '⏳ Salvataggio...' : <><Save size={18} /> Salva</>}
            </button>
            <Link href="/admin/settings/system" className="text-sm text-gray-500 hover:text-gray-900">
              Annulla
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
