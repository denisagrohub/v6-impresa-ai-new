'use client';

// 07/10/2026 (C-telegram-otp-bot-1): modale installazione bot V6 Auth.
// Genera deep link t.me/V6AuthBot?start=TOKEN, mostra QR + bottone
// "Apri Telegram", polla /status ogni 2s. Quando linked=true chiude.

import { useEffect, useState } from 'react';
import { X, Loader2, AlertCircle, CheckCircle2, ExternalLink, RefreshCw } from 'lucide-react';

type Props = {
  onLinked: () => void;
  onClose: () => void;
};

function authHeaders(): Record<string, string> {
  try {
    const raw = localStorage.getItem('pi_session');
    const s = raw ? JSON.parse(raw) : null;
    return s?.token ? { Authorization: `JWT ${s.token}` } : {};
  } catch { return {}; }
}

export default function OtpBotInstallModal({ onLinked, onClose }: Props) {
  const [link, setLink] = useState<{ deep_link: string; qr_data: string; expires_at: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linked, setLinked] = useState(false);
  const [pollCount, setPollCount] = useState(0);

  async function generateLink() {
    setLoading(true); setError(null);
    try {
      const r = await fetch('/api/users/telegram-otp/generate-link', {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const j = await r.json();
      const payload = j.data || j;
      if (!r.ok || payload.error) throw new Error(payload.error || `HTTP ${r.status}`);
      setLink(payload);
      setPollCount(0);
    } catch (e: any) {
      setError(e.message || 'Errore generazione link');
    } finally {
      setLoading(false);
    }
  }

  // Polling status ogni 2 secondi dopo generazione link
  useEffect(() => {
    if (!link) return;
    const timer = setInterval(async () => {
      try {
        const r = await fetch('/api/users/telegram-otp/status', { headers: authHeaders() });
        const j = await r.json();
        const payload = j.data || j;
        if (payload.linked) {
          setLinked(true);
          clearInterval(timer);
          setTimeout(() => { onLinked(); }, 1200);
        }
      } catch {}
      setPollCount((c) => c + 1);
    }, 2000);
    return () => clearInterval(timer);
  }, [link, onLinked]);

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Installa bot V6 Auth</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-slate-600">
            Per accedere alla Knowledge Base serve certificare questa chat.
            Il bot <strong>V6 Auth</strong> invierà qui i codici di accesso.
          </p>

          {!link && !linked && (
            <button
              onClick={generateLink}
              disabled={loading}
              className="w-full px-4 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {loading ? 'Generazione…' : 'Genera link di installazione'}
            </button>
          )}

          {link && !linked && (
            <>
              <div className="text-center space-y-3">
                <p className="text-xs text-slate-500">
                  Scansiona il QR o clicca "Apri Telegram":
                </p>
                {link.qr_data && (
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(link.qr_data)}`}
                    alt="QR V6 Auth"
                    className="mx-auto border border-slate-200 rounded"
                  />
                )}
                <a
                  href={link.deep_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 text-sm"
                >
                  <ExternalLink className="w-4 h-4" /> Apri Telegram
                </a>
              </div>
              <ol className="text-xs text-slate-500 list-decimal list-inside space-y-1 pt-3 border-t border-slate-100">
                <li>Clicca "Apri Telegram"</li>
                <li>Premi <strong>START</strong> nel bot</li>
                <li>Torna qui: la modale si chiuderà da sola</li>
              </ol>
              <div className="flex items-center justify-center gap-2 text-xs text-slate-400 pt-2">
                <Loader2 className="w-3 h-3 animate-spin" />
                In attesa… ({pollCount * 2}s)
              </div>
              <button
                onClick={generateLink}
                disabled={loading}
                className="w-full text-xs text-slate-500 hover:text-slate-700 flex items-center justify-center gap-1"
              >
                <RefreshCw className="w-3 h-3" /> Link non funziona? Rigenera
              </button>
            </>
          )}

          {linked && (
            <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded text-emerald-800 text-sm">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
              <div>Chat certificata! Accesso in corso…</div>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded text-red-800 text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>{error}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
