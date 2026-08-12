'use client';
import { useState, useEffect } from 'react';
import { AlertCircle, Clock } from 'lucide-react';

export default function OdooConnectionError({ onRetry }: { onRetry: () => void }) {
  const [countdown, setCountdown] = useState(300);
  const [notified, setNotified] = useState(false);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setInterval(() => setCountdown(c => c - 1), 1000);
      return () => clearInterval(timer);
    } else {
      onRetry();
    }
  }, [countdown, onRetry]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const notifyAdmin = async () => {
    if (notified) return;
    try {
      await fetch('/api/notifications/odoo-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Connessione Odoo fallita',
          timestamp: new Date().toISOString()
        })
      });
      setNotified(true);
    } catch (e) { console.error(e); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-orange-50 to-white p-4">
      <div className="bg-white rounded-2xl border border-red-200 p-8 max-w-md w-full text-center shadow-xl">
        <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-6">
          <AlertCircle size={40} className="text-red-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">⚠️ Connessione ERP V6 non disponibile</h2>
        <p className="text-gray-600 mb-6">
          Il sistema non riesce a comunicare con il server ERP V6.
        </p>
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-6">
          <div className="flex items-center justify-center gap-3">
            <Clock size={20} className="text-orange-600" />
            <span className="text-sm text-gray-700">
              Prossimo tentativo tra <strong className="text-orange-600">{formatTime(countdown)}</strong>
            </span>
          </div>
        </div>
        <div className="mb-6">
          <button
            onClick={notifyAdmin}
            className="text-sm text-blue-600 hover:text-blue-800 flex items-center justify-center gap-2 mx-auto"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            {notified ? '✅ Notifica inviata' : '📧 Notifica Amministratore'}
          </button>
        </div>
        <button
          onClick={onRetry}
          className="w-full py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors"
        >
          🔄 Riprova Ora
        </button>
        <p className="text-xs text-gray-400 mt-4">
          Il sistema tenterà automaticamente la riconnessione ogni 5 minuti.
        </p>
      </div>
    </div>
  );
}
