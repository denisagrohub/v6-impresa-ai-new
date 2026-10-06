'use client';

// 07/10/2026 (C-telegram-otp-bot-2): modale installazione bot V6 Auth.
// 3 canali di installazione senza attrito:
//   - QR (tg://) → apre app mobile direttamente
//   - "Apri Telegram" (tg://) → apre app desktop
//   - "Apri in Telegram Web" (https://t.me/) → desktop senza app
//   - Fallback manuale: copia /start TOKEN

import { useEffect, useRef, useState } from 'react';
import {
  X, Loader2, AlertCircle, CheckCircle2, ExternalLink, RefreshCw,
  Smartphone, Monitor, Copy, Check,
} from 'lucide-react';

type GenerateLinkResponse = {
  tg_link: string;
  tg_desktop_link: string;
  web_link: string;
  manual_command: string;
  bot_username: string;
  qr_data: string;
  expires_at: string | null;
};

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

const POLL_TIMEOUT_SEC = 90;

export default function OtpBotInstallModal({ onLinked, onClose }: Props) {
  const [link, setLink] = useState<GenerateLinkResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linked, setLinked] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  async function generateLink() {
    setLoading(true); setError(null); setElapsed(0); setCopied(false);
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
    } catch (e: any) {
      setError(e.message || 'Errore generazione link');
    } finally {
      setLoading(false);
    }
  }

  // Polling ogni 2s + timeout 90s
  useEffect(() => {
    if (!link) return;
    const start = Date.now();
    const timer = setInterval(async () => {
      const secs = Math.floor((Date.now() - start) / 1000);
      setElapsed(secs);
      if (secs >= POLL_TIMEOUT_SEC) {
        clearInterval(timer);
        return;
      }
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
    }, 2000);
    timerRef.current = timer;
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [link, onLinked]);

  async function copyCommand() {
    if (!link?.manual_command) return;
    try {
      await navigator.clipboard.writeText(link.manual_command);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e: any) {
      setError('Copia fallita: ' + (e.message || ''));
    }
  }

  const timedOut = elapsed >= POLL_TIMEOUT_SEC && !linked;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full my-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Installa bot V6 Auth</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <p className="text-sm text-slate-600">
            Per accedere alla Knowledge Base serve certificare una chat Telegram con il bot
            <strong> @v6auth_bot</strong>. Il bot invierà qui i codici di accesso.
          </p>

          {!link && !linked && (
            <button
              onClick={generateLink}
              disabled={loading}
              className="w-full px-4 py-2.5 rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2 font-medium"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {loading ? 'Generazione…' : 'Genera link di installazione'}
            </button>
          )}

          {link && !linked && (
            <>
              {/* OPZIONE 1 — QR mobile */}
              <div className="border border-slate-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Smartphone className="w-4 h-4 text-slate-600" />
                  <h3 className="text-sm font-semibold text-slate-800">Da telefono</h3>
                </div>
                <div className="flex items-start gap-4">
                  {link.web_link && (
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(link.web_link)}`}
                      alt="QR V6 Auth"
                      className="border border-slate-200 rounded flex-shrink-0"
                      width={160}
                      height={160}
                    />
                  )}
                  <div className="text-xs text-slate-600 space-y-1">
                    <p>Inquadra il QR con la fotocamera del telefono.</p>
                    <p className="text-slate-400">Inquadrando il QR, il telefono apre l&apos;app Telegram direttamente. Se compare &quot;Apri in app&quot;, conferma.</p>
                    <p className="pt-1">Poi premi <strong>START</strong> nel bot.</p>
                  </div>
                </div>
              </div>

              {/* OPZIONE 2 — Desktop */}
              <div className="border border-slate-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Monitor className="w-4 h-4 text-slate-600" />
                  <h3 className="text-sm font-semibold text-slate-800">Da computer</h3>
                </div>
                <div className="space-y-2">
                  <a
                    href={link.tg_desktop_link}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 text-sm font-medium"
                  >
                    <ExternalLink className="w-4 h-4" /> Apri Telegram
                  </a>
                  <p className="text-xs text-slate-400 text-center">
                    Apre l&apos;app Telegram se installata. Se non si apre, usa l&apos;opzione qui sotto.
                  </p>
                  <a
                    href={link.web_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm"
                  >
                    <ExternalLink className="w-4 h-4" /> Apri in Telegram Web
                  </a>
                </div>
              </div>

              {/* OPZIONE 3 — Manuale */}
              <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                <h3 className="text-sm font-semibold text-slate-800 mb-2">Manuale (funziona sempre)</h3>
                <ol className="text-xs text-slate-600 list-decimal list-inside space-y-1 mb-3">
                  <li>Apri Telegram (qualsiasi dispositivo)</li>
                  <li>Cerca <strong>@{link.bot_username}</strong></li>
                  <li>Incolla questo comando e invia:</li>
                </ol>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-white border border-slate-200 rounded px-3 py-2 text-xs font-mono truncate">
                    {link.manual_command}
                  </code>
                  <button
                    onClick={copyCommand}
                    className="flex-shrink-0 px-3 py-2 rounded border border-slate-300 hover:bg-white text-xs flex items-center gap-1.5"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copiato' : 'Copia'}
                  </button>
                </div>
              </div>

              {/* Stato polling */}
              <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
                {!timedOut ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    In attesa… ({elapsed}s di {POLL_TIMEOUT_SEC}s)
                  </div>
                ) : (
                  <div className="text-amber-700">Timeout. Il mapping non è stato rilevato.</div>
                )}
                <button
                  onClick={generateLink}
                  disabled={loading}
                  className="text-slate-500 hover:text-slate-700 flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" /> {timedOut ? 'Riprova' : 'Rigenera link'}
                </button>
              </div>
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
