'use client';

// ═══════════════════════════════════════════════════════════════════
// SuggestionsToday — sezione "Suggerimenti AI" (C1b-2).
//
// Mostra solo se ci sono suggerimenti. Sono generati dal motore C1b
// (regole + AI), non fatti: separazione visiva marcata (bordo
// tratteggiato + sfondo leggermente diverso).
//
// Azioni: Accetta / Ignora → POST + rimozione dalla lista.
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Sparkles, X, Check, Loader2, AlertCircle, ArrowRight } from 'lucide-react';

type Suggestion = {
  id: number;
  rule_code: string;
  title: string;
  body: string;
  priority: 'low' | 'normal' | 'high';
  state: string;
  relation_id: number | null;
  relation_name: string | null;
  deal_id: number | null;
  deal_name: string | null;
  created_date: string | null;
};

function authHeaders(): Record<string, string> {
  try {
    const raw = localStorage.getItem('pi_session');
    const s = raw ? JSON.parse(raw) : null;
    return s?.token ? { Authorization: `JWT ${s.token}` } : {};
  } catch { return {}; }
}

const PRIORITY_DOT: Record<string, string> = {
  high: 'bg-red-500',
  normal: 'bg-amber-400',
  low: 'bg-gray-300',
};

export default function SuggestionsToday() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyIds, setBusyIds] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  // 03/10/2026 (C1b-bot-2): feedback "TODO creato" dopo accept
  const [todoFeedback, setTodoFeedback] = useState<{ id: number; due_date: string | null } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/suggestions?scope=mine&state=new,shown', {
        headers: authHeaders(),
      });
      if (!r.ok) return;
      const d = await r.json();
      const data = d.data || d;
      setSuggestions(data.suggestions || []);
      // 02/10/2026: marca shown le new visibili (fire-and-forget)
      fetch('/api/admin/suggestions/show', {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: '{}',
      }).catch(() => {});
    } catch {
      // silenzioso
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const decide = async (s: Suggestion, action: 'accept' | 'ignore') => {
    setBusyIds((prev) => new Set(prev).add(s.id));
    const prevList = suggestions;
    setSuggestions((list) => list.filter((x) => x.id !== s.id));
    try {
      const r = await fetch(`/api/admin/suggestions/${s.id}?action=${action}`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: '{}',
      });
      if (!r.ok) throw new Error('Errore');
      // 03/10/2026 (C1b-bot-2): se accept ha creato un TODO, mostra feedback
      const resp = await r.json();
      const data = resp.data || resp;
      if (action === 'accept' && data?.todo_created) {
        setTodoFeedback({ id: data.todo_created.id, due_date: data.todo_created.due_date });
        setTimeout(() => setTodoFeedback(null), 5000);
      }
    } catch (e: any) {
      setSuggestions(prevList);
      setError(e.message || 'Errore');
    } finally {
      setBusyIds((prev) => {
        const n = new Set(prev);
        n.delete(s.id);
        return n;
      });
    }
  };

  // Se 0 suggerimenti (o caricamento iniziale vuoto): non mostrare la sezione
  if (loading && suggestions.length === 0) return null;
  if (!loading && suggestions.length === 0) return null;

  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles size={13} className="text-violet-600" />
        <h2 className="text-xs uppercase tracking-wider text-violet-600 font-semibold">
          Suggerimenti AI
        </h2>
        <span className="text-[11px] text-gray-400">
          ({suggestions.length})
        </span>
      </div>

      {todoFeedback && (
        <div className="mb-2 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 flex items-center gap-2">
          ✅ TODO #{todoFeedback.id} creato{todoFeedback.due_date && ` (scadenza ${todoFeedback.due_date})`}.
          <Link href="/admin/todo" className="ml-auto underline font-semibold">
            Vedi in /admin/todo →
          </Link>
        </div>
      )}

      {error && (
        <div className="mb-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 flex items-center gap-2">
          <AlertCircle size={12} /> {error}
        </div>
      )}

      <div className="space-y-2">
        {suggestions.map((s) => {
          const busy = busyIds.has(s.id);
          return (
            <div
              key={s.id}
              className="rounded-xl border border-dashed border-violet-200 bg-violet-50/30 p-3"
            >
              <div className="flex items-start gap-2 mb-1.5">
                <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${PRIORITY_DOT[s.priority] || PRIORITY_DOT.normal}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-[#0F1E3C]">
                    {s.title}
                  </div>
                  {(s.relation_name || s.deal_name) && (
                    <div className="text-[11px] text-gray-500 mt-0.5 truncate">
                      {s.relation_name && <span>· {s.relation_name}</span>}
                      {s.deal_name && <span> · {s.deal_name}</span>}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => decide(s, 'ignore')}
                  disabled={busy}
                  className="p-1 rounded hover:bg-white text-gray-400 hover:text-gray-700 disabled:opacity-50 shrink-0"
                  title="Ignora"
                >
                  <X size={14} />
                </button>
              </div>

              {s.body && (
                <p className="text-xs text-gray-600 leading-relaxed mb-2.5 pl-3.5">
                  {s.body}
                </p>
              )}

              <div className="flex items-center gap-2 pl-3.5">
                <button
                  onClick={() => decide(s, 'accept')}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded border border-violet-300 bg-white text-violet-700 hover:bg-violet-100 disabled:opacity-50"
                >
                  {busy ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                  Accetta
                </button>
                <button
                  onClick={() => decide(s, 'ignore')}
                  disabled={busy}
                  className="text-[11px] px-2.5 py-1 rounded text-gray-500 hover:text-gray-700 disabled:opacity-50"
                >
                  Ignora
                </button>
                {s.relation_id && (
                  <Link
                    href={`/admin/partner-projects/${s.relation_id}`}
                    className="ml-auto inline-flex items-center gap-1 text-[11px] text-gray-500 hover:text-[#0F1E3C]"
                  >
                    Apri <ArrowRight size={10} />
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
