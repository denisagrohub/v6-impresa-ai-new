'use client';

// 06/10/2026 (C-kb-4): lista KB read-only con filtri.
// 07/10/2026 (C-kb-3b): gate OTP Telegram + sessione X-Kb-Session.
// Enforcement access_level + OTP a valle (C-kb-3a + C-kb-3b):
// l'utente vede solo le KB che può leggere, e solo dopo aver
// verificato un OTP via bot V6 Auth.

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Loader2, AlertCircle, Search, RefreshCw, BookOpen, ChevronLeft, ChevronRight } from 'lucide-react';
import OtpBotInstallModal from './OtpBotInstallModal';
import OtpVerifyModal from './OtpVerifyModal';

type Kb = {
  id: number;
  name: string;
  description: string;
  kb_type: string;
  category_id: number | null;
  category_name: string;
  access_level: string;
  is_active: boolean;
  priority: number;
  use_count: number;
  version: number;
};

const KB_TYPE_OPTIONS = [
  { code: '', label: 'Tutti i tipi' },
  { code: 'fiscale', label: 'Fiscale' },
  { code: 'psicologico', label: 'Psicologico' },
  { code: 'normativo', label: 'Normativo' },
  { code: 'industriale', label: 'Industriale' },
  { code: 'artigianale', label: 'Artigianale' },
  { code: 'prompt', label: 'Prompt AI' },
  { code: 'metodo_v6', label: 'Metodo V6' },
  { code: 'changelog_tecnico', label: 'Changelog Tecnico' },
  { code: 'colori', label: 'Colori' },
  { code: 'disc_assessment', label: 'DISC Assessment' },
];

const ACCESS_BADGE: Record<string, { label: string; cls: string }> = {
  public:     { label: 'Pubblico',    cls: 'bg-blue-100 text-blue-800' },
  consultant: { label: 'Consulenti',  cls: 'bg-amber-100 text-amber-800' },
  ai_only:    { label: 'Solo AI',     cls: 'bg-purple-100 text-purple-800' },
  admin:      { label: 'Solo Admin',  cls: 'bg-red-100 text-red-800' },
};

const LIMIT = 30;
const KB_SESSION_KEY = 'kb_session_token';
const KB_SESSION_EXP_KEY = 'kb_session_expires';

function authHeaders(): Record<string, string> {
  try {
    const raw = localStorage.getItem('pi_session');
    const s = raw ? JSON.parse(raw) : null;
    return s?.token ? { Authorization: `JWT ${s.token}` } : {};
  } catch { return {}; }
}

function kbSessionHeader(): Record<string, string> {
  try {
    const token = localStorage.getItem(KB_SESSION_KEY);
    const exp = localStorage.getItem(KB_SESSION_EXP_KEY);
    if (!token) return {};
    if (exp && new Date(exp) < new Date()) {
      localStorage.removeItem(KB_SESSION_KEY);
      localStorage.removeItem(KB_SESSION_EXP_KEY);
      return {};
    }
    return { 'X-Kb-Session': token };
  } catch { return {}; }
}

function saveKbSession(token: string, expiresAt: string | null) {
  localStorage.setItem(KB_SESSION_KEY, token);
  if (expiresAt) localStorage.setItem(KB_SESSION_EXP_KEY, expiresAt);
}

function clearKbSession() {
  localStorage.removeItem(KB_SESSION_KEY);
  localStorage.removeItem(KB_SESSION_EXP_KEY);
}

export default function KbListPage() {
  const [items, setItems] = useState<Kb[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtri
  const [kbType, setKbType] = useState('');
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);

  // Gate: chat certificata + OTP verificato
  const [otpLinked, setOtpLinked] = useState<boolean | null>(null);
  const [showInstall, setShowInstall] = useState(false);
  const [showOtpVerify, setShowOtpVerify] = useState(false);
  const [otpMessage, setOtpMessage] = useState<string | null>(null);

  // ─── Check certificazione chat all'avvio ───
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/users/telegram-otp/status', { headers: authHeaders() });
        const j = await r.json();
        const payload = j.data || j;
        const linked = !!payload.linked;
        setOtpLinked(linked);
        if (!linked) setShowInstall(true);
      } catch {
        setOtpLinked(true); // in dubbio, non bloccare
      }
    })();
  }, []);

  // ─── load lista (solo dopo OTP gate) ───
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams();
      if (kbType) params.set('type', kbType);
      if (category) params.set('category', category);
      if (search) params.set('search', search);
      params.set('limit', String(LIMIT));
      params.set('offset', String(page * LIMIT));
      const headers = { ...authHeaders(), ...kbSessionHeader() };
      const r = await fetch(`/api/kb/list?${params.toString()}`, { headers });
      const j = await r.json();
      const payload = j.data || j;
      // 401 kb_session_* -> apri modale OTP
      if (r.status === 401 && (payload.error === 'kb_session_expired' || payload.error === 'kb_session_required')) {
        clearKbSession();
        setOtpMessage(
          payload.error === 'kb_session_expired'
            ? 'Sessione scaduta. Richiedi un nuovo codice OTP.'
            : 'Serve un codice OTP per accedere alla Knowledge Base.',
        );
        setShowOtpVerify(true);
        setItems([]);
        setTotal(0);
        setLoading(false);
        return;
      }
      if (!r.ok || payload.error) throw new Error(payload.error || `HTTP ${r.status}`);
      setItems(payload.articles || []);
      setTotal(payload.total || 0);
    } catch (e: any) {
      setError(e.message || 'Errore caricamento');
    } finally {
      setLoading(false);
    }
  }, [kbType, category, search, page]);

  // ─── Gate: se chat certificata ma nessuna sessione, apri OTP ───
  useEffect(() => {
    if (!otpLinked) return;
    const token = kbSessionHeader()['X-Kb-Session'];
    if (!token) {
      setOtpMessage('Per accedere alla Knowledge Base serve il codice OTP.');
      setShowOtpVerify(true);
      return;
    }
    load();
  }, [load, otpLinked]);

  function handleOtpVerified(sessionToken: string) {
    saveKbSession(sessionToken, null);
    setShowOtpVerify(false);
    setOtpMessage(null);
    load();
  }

  // Reset page quando cambiano i filtri
  useEffect(() => { setPage(0); }, [kbType, category, search]);

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  // ─── Gate modali ───
  if (showInstall) {
    return (
      <OtpBotInstallModal
        onLinked={() => { setShowInstall(false); setOtpLinked(true); }}
        onClose={() => setShowInstall(false)}
      />
    );
  }

  if (showOtpVerify) {
    return (
      <OtpVerifyModal
        initialMessage={otpMessage}
        onVerified={handleOtpVerified}
        onClose={() => setShowOtpVerify(false)}
      />
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <BookOpen className="w-6 h-6 text-slate-700" />
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Knowledge Base</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {total} voci visibili con i tuoi permessi
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} disabled={loading}
            className="flex items-center gap-2 px-3 py-2 text-sm rounded border border-slate-300 hover:bg-slate-50 disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Aggiorna
          </button>
          <button
            onClick={() => { clearKbSession(); window.location.reload(); }}
            className="text-xs text-slate-500 hover:text-slate-700"
          >
            Esci
          </button>
        </div>
      </div>

      {/* Filtri */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex items-center gap-2 flex-1 min-w-[240px] px-3 py-2 border border-slate-300 rounded bg-white">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Cerca nel titolo o abstract…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 text-sm outline-none bg-transparent"
          />
        </div>
        <select
          value={kbType}
          onChange={(e) => setKbType(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-300 rounded bg-white"
        >
          {KB_TYPE_OPTIONS.map((o) => (
            <option key={o.code} value={o.code}>{o.label}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Categoria (es. Principi Decisionali)"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-300 rounded bg-white w-56"
        />
        {(kbType || category || search) && (
          <button
            onClick={() => { setKbType(''); setCategory(''); setSearch(''); }}
            className="px-3 py-2 text-xs rounded border border-slate-300 hover:bg-slate-50"
          >
            Reset
          </button>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12 text-slate-500">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Caricamento…
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-200 rounded text-red-800 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>{error}</div>
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-slate-500">
          <BookOpen className="w-12 h-12 mb-3 text-slate-300" />
          <p className="text-sm">Nessuna KB trovata con questi filtri.</p>
        </div>
      )}

      {!loading && !error && items.length > 0 && (
        <>
          <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-2 w-16">ID</th>
                  <th className="text-left px-4 py-2">Titolo</th>
                  <th className="text-left px-4 py-2 w-40">Tipo</th>
                  <th className="text-left px-4 py-2 w-48">Categoria</th>
                  <th className="text-left px-4 py-2 w-32">Accesso</th>
                </tr>
              </thead>
              <tbody>
                {items.map((k) => {
                  const badge = ACCESS_BADGE[k.access_level] || { label: k.access_level, cls: 'bg-slate-100 text-slate-700' };
                  return (
                    <tr key={k.id} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-2 text-slate-500 tabular-nums">{k.id}</td>
                      <td className="px-4 py-2">
                        <Link href={`/admin/kb/${k.id}`} className="block">
                          <div className="font-medium text-slate-900 truncate max-w-xl">{k.name}</div>
                          {k.description && (
                            <div className="text-xs text-slate-500 truncate max-w-xl mt-0.5">{k.description}</div>
                          )}
                        </Link>
                      </td>
                      <td className="px-4 py-2 text-slate-700">{k.kb_type}</td>
                      <td className="px-4 py-2 text-slate-700">{k.category_name || '—'}</td>
                      <td className="px-4 py-2">
                        <span className={`inline-block px-2 py-0.5 text-xs rounded ${badge.cls}`}>{badge.label}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Paginazione */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-xs text-slate-500">
                Pagina {page + 1} di {totalPages}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="p-2 rounded border border-slate-300 hover:bg-slate-50 disabled:opacity-50"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="p-2 rounded border border-slate-300 hover:bg-slate-50 disabled:opacity-50"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
