'use client';
import { useState, useEffect } from 'react';
import { CheckCircle2, XCircle, AlertCircle, RefreshCw, Server } from 'lucide-react';

export function OdooStatus() {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const checkStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/odoo/status');
      const data = await res.json();
      setStatus(data);
    } catch (error) {
      setStatus({
        success: false,
        connected: false,
        error: 'Errore di rete',
        missingModules: [],
        allInstalled: false
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkStatus();
    // Aggiorna ogni 30 secondi
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !status) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex items-center gap-3">
        <RefreshCw size={20} className="animate-spin text-gray-400" />
        <span className="text-sm text-gray-500">Verifica connessione Odoo...</span>
      </div>
    );
  }

  if (!status) return null;

  const isConnected = status.connected;
  const allInstalled = status.allInstalled;
  const missingModules = status.missingModules || [];

  return (
    <div className={`rounded-xl border p-4 ${
      isConnected && allInstalled ? 'bg-green-50 border-green-200' :
      isConnected && !allInstalled ? 'bg-yellow-50 border-yellow-200' :
      'bg-red-50 border-red-200'
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Server size={20} className={
            isConnected && allInstalled ? 'text-green-600' :
            isConnected && !allInstalled ? 'text-yellow-600' :
            'text-red-600'
          } />
          <div>
            <div className="font-medium text-sm">
              {isConnected && allInstalled && '✅ Odoo connesso e moduli installati'}
              {isConnected && !allInstalled && '⚠️ Odoo connesso ma moduli mancanti'}
              {!isConnected && '❌ Odoo non raggiungibile'}
            </div>
            <div className="text-xs text-gray-600 mt-1">
              {isConnected && allInstalled && `${status.installedModules?.length || 0} moduli attivi`}
              {isConnected && !allInstalled && `Mancano: ${missingModules.join(', ')}`}
              {!isConnected && (status.error || 'Verifica URL, credenziali o rete')}
            </div>
          </div>
        </div>
        <button
          onClick={checkStatus}
          disabled={loading}
          className="p-2 rounded-lg hover:bg-white/50 transition-colors disabled:opacity-50"
          title="Aggiorna"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>
      {!isConnected && (
        <div className="mt-2 text-xs text-gray-500 border-t border-red-200 pt-2">
          💡 Per collegare Odoo, modifica le variabili in <code className="bg-red-100 px-1 rounded">.env.local</code>
        </div>
      )}
    </div>
  );
}
