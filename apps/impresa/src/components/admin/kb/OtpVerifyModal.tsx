'use client';

// 07/10/2026 (C-kb-3b): modale OTP accesso KB.
// 1) Click "Invia codice" -> POST /api/kb/otp/request
// 2) Ricevi otp_id, input 6 cifre
// 3) POST /api/kb/otp/verify -> salva session_token
// 4) Bypass admin (user_id=2) con doppia conferma

import { useEffect, useRef, useState } from 'react';
import { X, Loader2, AlertCircle, CheckCircle2, Shield, Send } from 'lucide-react';
// 07/10/2026 (C-kb-3b-fix2): salva token direttamente. No delega
// a onVerified (setTimeout -> smontaggio -> perdita token).
import { saveKbSession } from '@/lib/kb-session';

type Props = {
  onVerified: (sessionToken: string) => void;
  onClose: () => void;
  initialMessage?: string | null;
};

function authHeaders(): Record<string, string> {
  try {
    const raw = localStorage.getItem('pi_session');
    const s = raw ? JSON.parse(raw) : null;
    return s?.token ? { Authorization: `JWT ${s.token}` } : {};
  } catch { return {}; }
}

function isAdmin(): boolean {
  try {
    const raw = localStorage.getItem('pi_session');
    const s = raw ? JSON.parse(raw) : null;
    return !!s?.is_admin || !!s?.isAdmin || s?.user_id === 2;
  } catch { return false; }
}

export default function OtpVerifyModal({ onVerified, onClose, initialMessage }: Props) {
  const [phase, setPhase] = useState<'idle' | 'sent' | 'verifying' | 'done'>('idle');
  const [otpId, setOtpId] = useState<number | null>(null);
  const [code, setCode] = useState('');
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(initialMessage || null);
  const [loading, setLoading] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [bypassOpen, setBypassOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const admin = isAdmin();

  // Countdown resend
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn(resendIn - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  async function requestOtp() {
    setLoading(true); setError(null);
    try {
      const r = await fetch('/api/kb/otp/request', {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const j = await r.json();
      const payload = j.data || j;
      if (!r.ok || payload.error) {
        if (r.status === 428 && payload.error === 'kb_telegram_not_certified') {
          throw new Error('Chat Telegram non certificata. Ricarica la pagina per installare il bot.');
        }
        throw new Error(payload.error || `HTTP ${r.status}`);
      }
      setOtpId(payload.otp_id);
      setExpiresAt(payload.expires_at);
      setPhase('sent');
      setResendIn(30);
      setTimeout(() => inputRef.current?.focus(), 100);
    } catch (e: any) {
      setError(e.message || 'Errore invio OTP');
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp() {
    if (!otpId || code.length !== 6) {
      setError('Inserisci 6 cifre.');
      return;
    }
    setLoading(true); setError(null);
    try {
      const r = await fetch('/api/kb/otp/verify', {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ otp_id: otpId, code }),
      });
      const j = await r.json();
      const payload = j.data || j;
      if (!r.ok || payload.error) throw new Error(payload.error || `HTTP ${r.status}`);
      if (!payload.session_token) {
        throw new Error('Nessun token ricevuto dal server');
      }
      // 07/10/2026 (C-kb-3b-fix2): salva ORA, sincrono. Non delegare.
      saveKbSession(payload.session_token, payload.expires_at || null);
      setPhase('done');
      setInfo('Accesso autorizzato.');
      onVerified(payload.session_token);
    } catch (e: any) {
      setError(e.message || 'Codice errato');
      setCode('');
      inputRef.current?.focus();
    } finally {
      setLoading(false);
    }
  }

  async function requestBypass(confirm: boolean) {
    setLoading(true); setError(null);
    try {
      const r = await fetch('/api/kb/otp/bypass', {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm }),
      });
      const j = await r.json();
      const payload = j.data || j;
      if (!r.ok || payload.error) throw new Error(payload.error || `HTTP ${r.status}`);
      if (payload.confirm_required) {
        setBypassOpen(true);
        setInfo('Bypass registrato nel log. Confermi?');
        setLoading(false);
        return;
      }
      if (payload.ok && payload.session_token) {
        saveKbSession(payload.session_token, payload.expires_at || null);
        setPhase('done');
        setInfo('Bypass concesso (registrato nel log).');
        onVerified(payload.session_token);
      }
    } catch (e: any) {
      setError(e.message || 'Errore bypass');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-slate-700" />
            <h2 className="text-lg font-semibold text-slate-900">Accesso KB protetto</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {phase === 'idle' && (
            <>
              <p className="text-sm text-slate-600">
                Per accedere alla Knowledge Base serve un codice OTP a 6 cifre.
                Lo invieremo al tuo bot Telegram <strong>V6 Auth</strong>.
              </p>
              <button
                onClick={requestOtp}
                disabled={loading}
                className="w-full px-4 py-2.5 rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2 font-medium"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {loading ? 'Invio…' : 'Invia codice'}
              </button>
              {admin && (
                <button
                  onClick={() => requestBypass(false)}
                  disabled={loading}
                  className="w-full text-xs text-slate-500 hover:text-slate-700 underline"
                >
                  Problemi? Bypass admin
                </button>
              )}
            </>
          )}

          {phase === 'sent' && (
            <>
              <p className="text-sm text-slate-600">
                Ti abbiamo inviato un codice via Telegram.
                {expiresAt && (
                  <span className="block text-xs text-slate-400 mt-1">
                    Scade alle {new Date(expiresAt).toLocaleTimeString('it-IT')}
                  </span>
                )}
              </p>
              <input
                ref={inputRef}
                type="text"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                onKeyDown={(e) => { if (e.key === 'Enter') verifyOtp(); }}
                placeholder="000000"
                className="w-full text-center text-2xl font-mono tracking-widest border border-slate-300 rounded px-3 py-3"
              />
              <button
                onClick={verifyOtp}
                disabled={loading || code.length !== 6}
                className="w-full px-4 py-2.5 rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2 font-medium"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                {loading ? 'Verifica…' : 'Verifica'}
              </button>
              <div className="flex items-center justify-between text-xs">
                <button
                  onClick={requestOtp}
                  disabled={resendIn > 0 || loading}
                  className="text-slate-500 hover:text-slate-700 disabled:opacity-50"
                >
                  {resendIn > 0 ? `Reinvia tra ${resendIn}s` : 'Reinvia codice'}
                </button>
                {admin && (
                  <button
                    onClick={() => requestBypass(true)}
                    disabled={loading}
                    className="text-slate-500 hover:text-slate-700 underline"
                  >
                    Bypass admin
                  </button>
                )}
              </div>
            </>
          )}

          {phase === 'done' && (
            <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded text-emerald-800 text-sm">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
              <div>{info || 'Accesso autorizzato.'}</div>
            </div>
          )}

          {bypassOpen && phase !== 'done' && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded text-amber-900 text-sm space-y-2">
              <p>Confermi il bypass OTP? Sarà registrato nel log.</p>
              <div className="flex justify-end gap-2">
                <button onClick={() => setBypassOpen(false)} className="px-3 py-1 text-xs rounded border border-amber-300">
                  Annulla
                </button>
                <button onClick={() => requestBypass(true)} className="px-3 py-1 text-xs rounded bg-amber-600 text-white">
                  Confermo
                </button>
              </div>
            </div>
          )}

          {info && phase !== 'done' && !bypassOpen && (
            <div className="text-xs text-slate-500 bg-slate-50 p-2 rounded">{info}</div>
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
