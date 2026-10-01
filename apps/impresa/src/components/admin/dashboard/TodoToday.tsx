'use client';

// ═══════════════════════════════════════════════════════════════════
// TodoToday — sezione "I miei TODO" per dashboard admin (C1a-2b).
//
// Consuma /api/admin/todos (proxy verso il gateway Odoo).
// Solo create + toggle in questa fase. Modifica/elimina arriveranno
// con la pagina /admin/todo dedicata (C1a-2c).
//
// Design: tokens-impresa.md. Nessun terracotta, nessuna animazione
// oltre transition-colors.
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, Plus, ArrowRight, Loader2, AlertCircle } from 'lucide-react';

type Todo = {
  id: number;
  name: string;
  description: string;
  user_id: number | null;
  user_name: string | null;
  project_id: number | null;
  project_name: string | null;
  deal_id: number | null;
  deal_name: string | null;
  due_date: string | null;
  state: 'open' | 'done' | 'cancelled';
  is_auto: boolean;
  source: string | null;
  done_at: string | null;
  create_date: string | null;
  is_overdue: boolean;
};

type Props = {
  initialScope?: 'mine' | 'all';
  maxVisible?: number;
};

function authHeaders(): Record<string, string> {
  try {
    const raw = localStorage.getItem('pi_session');
    const s = raw ? JSON.parse(raw) : null;
    return s?.token ? { Authorization: `JWT ${s.token}` } : {};
  } catch {
    return {};
  }
}

function formatDueDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
}

function isToday(iso: string | null): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  const t = new Date();
  return d.getFullYear() === t.getFullYear()
    && d.getMonth() === t.getMonth()
    && d.getDate() === t.getDate();
}

export default function TodoToday({ initialScope = 'mine', maxVisible = 5 }: Props) {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [busyIds, setBusyIds] = useState<Set<number>>(new Set());

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/admin/todos?scope=${initialScope}&limit=30`, {
        headers: authHeaders(),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || 'Errore nel caricamento');
      setTodos(d.todos || []);
    } catch (e: any) {
      setError(e.message || 'Errore');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const create = async () => {
    const name = newName.trim();
    if (!name || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const r = await fetch('/api/admin/todos', {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || 'Errore creazione');
      setNewName('');
      setTodos((prev) => [d.todo, ...prev]);
    } catch (e: any) {
      setError(e.message || 'Errore');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleDone = async (t: Todo) => {
    // Ottimistico: aggiorno UI subito
    const prevTodos = todos;
    const newState: Todo['state'] = t.state === 'done' ? 'open' : 'done';
    setTodos((prev) =>
      prev.map((x) => (x.id === t.id ? { ...x, state: newState, done_at: newState === 'done' ? new Date().toISOString() : null } : x))
    );
    setBusyIds((s) => new Set(s).add(t.id));
    try {
      const r = await fetch(`/api/admin/todos/${t.id}`, {
        method: 'PATCH',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: newState }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || 'Errore aggiornamento');
      setTodos((prev) => prev.map((x) => (x.id === t.id ? d.todo : x)));
    } catch (e: any) {
      setTodos(prevTodos); // rollback
      setError(e.message || 'Errore');
    } finally {
      setBusyIds((s) => {
        const n = new Set(s);
        n.delete(t.id);
        return n;
      });
    }
  };

  const openTodos = todos.filter((t) => t.state === 'open');
  const doneToday = todos.filter((t) => t.state === 'done' && isToday(t.done_at));
  const overdueCount = openTodos.filter((t) => t.is_overdue).length;
  const visibleOpen = openTodos.slice(0, maxVisible);
  const hiddenCount = Math.max(0, openTodos.length - maxVisible);

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs uppercase tracking-wider text-gray-400 font-semibold">
          I miei TODO
        </h2>
        {!loading && (
          <span className="text-[11px] text-gray-500 tabular-nums">
            <span className="text-[#0F1E3C] font-semibold">{openTodos.length}</span> aperti
            {overdueCount > 0 && (
              <>
                {' · '}
                <span className="text-amber-600 font-semibold">{overdueCount} in ritardo</span>
              </>
            )}
          </span>
        )}
      </div>

      {/* Input rapido */}
      <div className="mb-2 flex items-center gap-2 rounded-xl border border-gray-100 bg-white px-3 py-2 focus-within:border-[#0F1E3C] transition-colors">
        <Plus size={14} className="text-gray-400 shrink-0" />
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') create();
          }}
          placeholder="Aggiungi un TODO..."
          className="flex-1 text-sm text-[#0F1E3C] bg-transparent outline-none placeholder:text-gray-400"
          disabled={submitting}
        />
        {newName.trim() && (
          <button
            onClick={create}
            disabled={submitting}
            className="text-[11px] px-2 py-1 rounded border border-gray-200 text-[#0F1E3C] hover:bg-gray-50 disabled:opacity-50 whitespace-nowrap"
          >
            {submitting ? <Loader2 size={11} className="animate-spin" /> : 'Invio ↵'}
          </button>
        )}
      </div>

      {error && (
        <div className="mb-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 flex items-center gap-2">
          <AlertCircle size={12} /> {error}
        </div>
      )}

      {loading && todos.length === 0 && (
        <div className="rounded-xl border border-gray-100 bg-white px-4 py-3 text-xs text-gray-500 flex items-center gap-2">
          <Loader2 size={12} className="animate-spin" /> Caricamento...
        </div>
      )}

      {!loading && openTodos.length === 0 && doneToday.length === 0 && (
        <div className="rounded-xl border border-gray-100 bg-white px-4 py-3 text-sm text-gray-500">
          Nessun TODO. Scrivi qui sopra per aggiungerne uno.
        </div>
      )}

      {openTodos.length > 0 && (
        <div className="rounded-xl border border-gray-100 bg-white divide-y divide-gray-50">
          {visibleOpen.map((t) => {
            const busy = busyIds.has(t.id);
            return (
              <div key={t.id} className="flex items-start gap-3 px-3 py-2.5 hover:bg-gray-50/50 transition-colors">
                <button
                  onClick={() => toggleDone(t)}
                  disabled={busy}
                  className="mt-0.5 w-4 h-4 rounded border border-gray-300 hover:border-[#0F1E3C] flex items-center justify-center shrink-0 disabled:opacity-50"
                  aria-label="Segna fatto"
                >
                  {busy ? <Loader2 size={10} className="animate-spin text-gray-400" /> : <Check size={10} className="text-transparent hover:text-[#0F1E3C]" />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-[#0F1E3C] truncate">{t.name}</div>
                  {(t.project_name || t.deal_name) && (
                    <div className="text-[11px] text-gray-500 truncate mt-0.5">
                      {t.project_name && <span>· {t.project_name}</span>}
                      {t.deal_name && <span> · {t.deal_name}</span>}
                    </div>
                  )}
                </div>
                {t.due_date && (
                  <span className={`text-[11px] tabular-nums shrink-0 ${t.is_overdue ? 'text-amber-600 font-semibold' : 'text-gray-400'}`}>
                    {t.is_overdue ? 'in ritardo' : `entro il ${formatDueDate(t.due_date)}`}
                  </span>
                )}
              </div>
            );
          })}
          {hiddenCount > 0 && (
            <Link
              href="/admin/todo"
              className="flex items-center justify-center gap-1 px-3 py-2 text-[11px] text-gray-500 hover:text-[#0F1E3C] hover:underline"
            >
              Vedi tutti ({openTodos.length}) <ArrowRight size={11} />
            </Link>
          )}
        </div>
      )}

      {doneToday.length > 0 && (
        <div className="mt-2">
          <div className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold mb-1 px-1">
            Fatti oggi ({doneToday.length})
          </div>
          <div className="rounded-xl border border-gray-100 bg-white divide-y divide-gray-50">
            {doneToday.slice(0, 3).map((t) => (
              <div key={t.id} className="flex items-center gap-3 px-3 py-2">
                <button
                  onClick={() => toggleDone(t)}
                  className="w-4 h-4 rounded border border-[#0F1E3C] bg-[#0F1E3C] flex items-center justify-center shrink-0"
                  aria-label="Riapri"
                >
                  <Check size={10} className="text-white" />
                </button>
                <div className="flex-1 min-w-0 text-sm text-gray-400 line-through truncate">
                  {t.name}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
