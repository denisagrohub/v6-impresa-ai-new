'use client';

// ═══════════════════════════════════════════════════════════════════
// TodoPage — pagina /admin/todo (C1a-2c).
//
// Lista completa TODO con filtri (scope, state, ricerca).
// Modifica inline, elimina (solo admin).
// Layout: ereditato da admin/layout.tsx (sidebar globale). Nessun
// AdminLayout interno — /admin/todo NON è in SKIP_PREFIXES.
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Check, Plus, Loader2, AlertCircle, Pencil, Trash2, X,
  ArrowLeft, Search,
} from 'lucide-react';

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
  return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });
}

function isToday(iso: string | null): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  const t = new Date();
  return d.getFullYear() === t.getFullYear()
    && d.getMonth() === t.getMonth()
    && d.getDate() === t.getDate();
}

const STATE_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Tutti gli stati' },
  { value: 'open', label: 'Aperti' },
  { value: 'done', label: 'Fatti' },
  { value: 'cancelled', label: 'Annullati' },
];

export default function TodoPage() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const [scope, setScope] = useState<'mine' | 'all'>('mine');
  const [stateFilter, setStateFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  // 02/10/2026 (C1a-6): filtri progetto/deal
  const [projectFilter, setProjectFilter] = useState<string>('');
  const [dealFilter, setDealFilter] = useState<string>('');
  const [projectsList, setProjectsList] = useState<Array<{ id: number; name: string }>>([]);
  const [dealsList, setDealsList] = useState<Array<{ id: number; name: string }>>([]);

  const [newName, setNewName] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [newUserId, setNewUserId] = useState<string>('');
  // 02/10/2026 (C1a-BIS-2): associazioni progetto/deal nel form
  const [newProjectId, setNewProjectId] = useState<string>('');
  const [newDealId, setNewDealId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  // 02/10/2026 (C1a-3): lista utenti per assegnazione (solo admin)
  const [users, setUsers] = useState<Array<{ id: number; name: string }>>([]);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editUserId, setEditUserId] = useState<string>('');
  const [editProjectId, setEditProjectId] = useState<string>('');
  const [editDealId, setEditDealId] = useState<string>('');
  const [savingEdit, setSavingEdit] = useState(false);

  const [busyIds, setBusyIds] = useState<Set<number>>(new Set());

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('scope', scope);
      params.set('limit', '200');
      if (stateFilter) params.set('state', stateFilter);
      if (projectFilter) params.set('project_id', projectFilter);
      if (dealFilter) params.set('deal_id', dealFilter);
      const r = await fetch(`/api/admin/todos?${params.toString()}`, {
        headers: authHeaders(),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || 'Errore nel caricamento');
      setTodos(d.todos || []);
      setIsAdmin(!!d.is_admin);
    } catch (e: any) {
      setError(e.message || 'Errore');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, stateFilter, projectFilter, dealFilter]);

  // 02/10/2026 (C1a-3): lista utenti per il select di assegnazione.
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/admin/users', { headers: authHeaders() });
        if (!r.ok) return;
        const d = await r.json();
        if (Array.isArray(d.users)) {
          setUsers(d.users.map((u: any) => ({ id: u.id, name: u.name })));
        }
      } catch {
        // silenzioso
      }
    })();
  }, []);

  // 02/10/2026 (C1a-6): lista progetti + deals per i filtri
  useEffect(() => {
    (async () => {
      try {
        const [pRes, dRes] = await Promise.all([
          fetch('/api/admin/partner-projects', { headers: authHeaders() }),
          fetch('/api/admin/deals', { headers: authHeaders() }),
        ]);
        if (pRes.ok) {
          const pd = await pRes.json();
          const list = pd?.projects || pd?.data?.projects || [];
          if (Array.isArray(list)) {
            setProjectsList(list.map((p: any) => ({ id: p.id, name: p.name })));
          }
        }
        if (dRes.ok) {
          const dd = await dRes.json();
          // deals sono raggruppati per progetto: flatten
          const groups = dd?.groups || dd?.data?.groups || [];
          const flat: Array<{ id: number; name: string }> = [];
          for (const g of groups) {
            for (const deal of (g.deals || [])) {
              flat.push({ id: deal.id, name: deal.name });
            }
          }
          setDealsList(flat);
        }
      } catch {
        // silenzioso
      }
    })();
  }, []);

  // Filtro client-side sulla ricerca
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return todos;
    return todos.filter((t) => t.name.toLowerCase().includes(q));
  }, [todos, search]);

  // Raggruppamento: in ritardo / oggi / questa settimana / più avanti / senza data / fatti / annullati
  const grouped = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const tomorrowStart = todayStart + 86400000;
    const weekEnd = todayStart + 7 * 86400000;

    const groups: { label: string; items: Todo[] }[] = [];
    const pushGroup = (label: string, items: Todo[]) => {
      if (items.length > 0) groups.push({ label, items });
    };

    const openItems = filtered.filter((t) => t.state === 'open');
    const doneItems = filtered.filter((t) => t.state === 'done');
    const cancelledItems = filtered.filter((t) => t.state === 'cancelled');

    // Ordina gli open: due_date asc (null in coda), poi create_date desc
    const sortedOpen = [...openItems].sort((a, b) => {
      const ad = a.due_date ? new Date(a.due_date).getTime() : Infinity;
      const bd = b.due_date ? new Date(b.due_date).getTime() : Infinity;
      if (ad !== bd) return ad - bd;
      const ac = a.create_date ? new Date(a.create_date).getTime() : 0;
      const bc = b.create_date ? new Date(b.create_date).getTime() : 0;
      return bc - ac;
    });

    pushGroup('In ritardo', sortedOpen.filter((t) => t.is_overdue));
    pushGroup('Oggi', sortedOpen.filter((t) => {
      if (t.is_overdue || !t.due_date) return false;
      const d = new Date(t.due_date).getTime();
      return d >= todayStart && d < tomorrowStart;
    }));
    pushGroup('Questa settimana', sortedOpen.filter((t) => {
      if (t.is_overdue || !t.due_date) return false;
      const d = new Date(t.due_date).getTime();
      return d >= tomorrowStart && d < weekEnd;
    }));
    pushGroup('Più avanti', sortedOpen.filter((t) => {
      if (t.is_overdue || !t.due_date) return false;
      const d = new Date(t.due_date).getTime();
      return d >= weekEnd;
    }));
    pushGroup('Senza data', sortedOpen.filter((t) => !t.due_date));
    pushGroup('Fatti', doneItems);
    pushGroup('Annullati', cancelledItems);

    return groups;
  }, [filtered]);

  const openCount = todos.filter((t) => t.state === 'open').length;
  const overdueCount = todos.filter((t) => t.state === 'open' && t.is_overdue).length;
  const doneTodayCount = todos.filter((t) => t.state === 'done' && isToday(t.done_at)).length;

  const create = async () => {
    const name = newName.trim();
    if (!name || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const payload: any = { name };
      if (newDueDate) payload.due_date = newDueDate;
      if (newUserId) payload.user_id = parseInt(newUserId, 10);
      if (newProjectId) payload.project_id = parseInt(newProjectId, 10);
      if (newDealId) payload.deal_id = parseInt(newDealId, 10);
      const r = await fetch('/api/admin/todos', {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || 'Errore creazione');
      setNewName('');
      setNewDueDate('');
      setNewUserId('');
      setNewProjectId('');
      setNewDealId('');
      setTodos((prev) => [d.todo, ...prev]);
    } catch (e: any) {
      setError(e.message || 'Errore');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleDone = async (t: Todo) => {
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
      setTodos(prevTodos);
      setError(e.message || 'Errore');
    } finally {
      setBusyIds((s) => {
        const n = new Set(s);
        n.delete(t.id);
        return n;
      });
    }
  };

  const startEdit = (t: Todo) => {
    setEditingId(t.id);
    setEditName(t.name);
    setEditDescription(t.description || '');
    setEditDueDate(t.due_date || '');
    setEditUserId(t.user_id ? String(t.user_id) : '');
    setEditProjectId(t.project_id ? String(t.project_id) : '');
    setEditDealId(t.deal_id ? String(t.deal_id) : '');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditDescription('');
    setEditDueDate('');
    setEditUserId('');
    setEditProjectId('');
    setEditDealId('');
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const name = editName.trim();
    if (!name) {
      setError('Il nome non può essere vuoto');
      return;
    }
    setSavingEdit(true);
    setError(null);
    try {
      const payload: any = {
        name,
        description: editDescription,
        due_date: editDueDate || null,
        project_id: editProjectId ? parseInt(editProjectId, 10) : null,
        deal_id: editDealId ? parseInt(editDealId, 10) : null,
      };
      if (isAdmin && editUserId) {
        payload.user_id = parseInt(editUserId, 10);
      }
      const r = await fetch(`/api/admin/todos/${editingId}`, {
        method: 'PATCH',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || 'Errore salvataggio');
      setTodos((prev) => prev.map((x) => (x.id === editingId ? d.todo : x)));
      cancelEdit();
    } catch (e: any) {
      setError(e.message || 'Errore');
    } finally {
      setSavingEdit(false);
    }
  };

  const remove = async (t: Todo) => {
    if (!isAdmin) return;
    if (!window.confirm(`Eliminare "${t.name}"?`)) return;
    const prevTodos = todos;
    setTodos((prev) => prev.filter((x) => x.id !== t.id));
    try {
      const r = await fetch(`/api/admin/todos/${t.id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || 'Errore eliminazione');
    } catch (e: any) {
      setTodos(prevTodos);
      setError(e.message || 'Errore');
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/admin/dashboard"
          className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-[#0F1E3C]"
        >
          <ArrowLeft size={12} /> Dashboard
        </Link>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#0F1E3C] mb-1">TODO</h1>
        <p className="text-xs text-gray-500 tabular-nums">
          <span className="font-semibold text-[#0F1E3C]">{openCount}</span> aperti
          {overdueCount > 0 && <> · <span className="text-amber-600 font-semibold">{overdueCount} in ritardo</span></>}
          {doneTodayCount > 0 && <> · {doneTodayCount} fatti oggi</>}
        </p>
      </div>

      {/* Filtri */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {isAdmin && (
          <div className="inline-flex rounded-lg border border-gray-200 bg-white overflow-hidden">
            <button
              onClick={() => setScope('mine')}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                scope === 'mine' ? 'bg-[#0F1E3C] text-white' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              I miei
            </button>
            <button
              onClick={() => setScope('all')}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                scope === 'all' ? 'bg-[#0F1E3C] text-white' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              Tutti
            </button>
          </div>
        )}

        <select
          value={stateFilter}
          onChange={(e) => setStateFilter(e.target.value)}
          className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-xs text-[#0F1E3C] outline-none focus:border-[#0F1E3C]"
        >
          {STATE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {/* 02/10/2026 (C1a-6): filtri progetto + deal */}
        {projectsList.length > 0 && (
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-xs text-[#0F1E3C] outline-none focus:border-[#0F1E3C] max-w-[200px]"
          >
            <option value="">Tutti i progetti</option>
            {projectsList.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        )}

        {dealsList.length > 0 && (
          <select
            value={dealFilter}
            onChange={(e) => setDealFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-xs text-[#0F1E3C] outline-none focus:border-[#0F1E3C] max-w-[200px]"
          >
            <option value="">Tutti i deal</option>
            {dealsList.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        )}

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 bg-white focus-within:border-[#0F1E3C] flex-1 min-w-[200px]">
          <Search size={12} className="text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cerca nel nome..."
            className="flex-1 text-xs text-[#0F1E3C] bg-transparent outline-none placeholder:text-gray-400"
          />
        </div>
      </div>

      {/* Input rapido — 02/10/2026 (C1a-3): nome + data + assegnatario */}
      <div className="mb-4 rounded-xl border border-gray-100 bg-white px-3 py-2 focus-within:border-[#0F1E3C] transition-colors">
        <div className="flex items-center gap-2">
          <Plus size={14} className="text-gray-400 shrink-0" />
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') create(); }}
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
        <div className="mt-1.5 pl-6 flex items-center gap-2 flex-wrap">
          <input
            type="date"
            value={newDueDate}
            onChange={(e) => setNewDueDate(e.target.value)}
            disabled={submitting}
            className="text-[11px] text-gray-600 bg-transparent outline-none border border-gray-100 rounded px-1.5 py-0.5 hover:border-gray-200"
            title="Scadenza"
          />
          {isAdmin && users.length > 0 && (
            <select
              value={newUserId}
              onChange={(e) => setNewUserId(e.target.value)}
              disabled={submitting}
              className="text-[11px] text-gray-600 bg-transparent outline-none border border-gray-100 rounded px-1.5 py-0.5 hover:border-gray-200 max-w-[180px]"
              title="Assegna a (default: te stesso)"
            >
              <option value="">Assegna a… (io)</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          )}
          {projectsList.length > 0 && (
            <select
              value={newProjectId}
              onChange={(e) => setNewProjectId(e.target.value)}
              disabled={submitting}
              className="text-[11px] text-gray-600 bg-transparent outline-none border border-gray-100 rounded px-1.5 py-0.5 hover:border-gray-200 max-w-[180px]"
              title="Progetto"
            >
              <option value="">Nessun progetto</option>
              {projectsList.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}
          {dealsList.length > 0 && (
            <select
              value={newDealId}
              onChange={(e) => setNewDealId(e.target.value)}
              disabled={submitting}
              className="text-[11px] text-gray-600 bg-transparent outline-none border border-gray-100 rounded px-1.5 py-0.5 hover:border-gray-200 max-w-[180px]"
              title="Deal"
            >
              <option value="">Nessun deal</option>
              {dealsList.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 flex items-center gap-2">
          <AlertCircle size={12} /> {error}
          <button onClick={() => setError(null)} className="ml-auto text-amber-700 hover:text-amber-900">
            <X size={12} />
          </button>
        </div>
      )}

      {loading && todos.length === 0 && (
        <div className="rounded-xl border border-gray-100 bg-white px-4 py-3 text-xs text-gray-500 flex items-center gap-2">
          <Loader2 size={12} className="animate-spin" /> Caricamento...
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="rounded-xl border border-gray-100 bg-white px-4 py-6 text-sm text-gray-500 text-center">
          Nessun TODO da mostrare.
        </div>
      )}

      {/* Gruppi */}
      <div className="space-y-5">
        {grouped.map((g) => (
          <div key={g.label}>
            <div className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-1.5 px-1">
              {g.label} ({g.items.length})
            </div>
            <div className="rounded-xl border border-gray-100 bg-white divide-y divide-gray-50">
              {g.items.map((t) => {
                const busy = busyIds.has(t.id);
                const isEditing = editingId === t.id;

                if (isEditing) {
                  return (
                    <div key={t.id} className="px-3 py-3 space-y-2 bg-gray-50/50">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full px-2 py-1.5 rounded border border-gray-200 bg-white text-sm text-[#0F1E3C] outline-none focus:border-[#0F1E3C]"
                        placeholder="Nome"
                      />
                      <textarea
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        className="w-full px-2 py-1.5 rounded border border-gray-200 bg-white text-xs text-[#0F1E3C] outline-none focus:border-[#0F1E3C] resize-none"
                        rows={2}
                        placeholder="Note (opzionale)"
                      />
                      <div className="flex items-center gap-2 flex-wrap">
                        <input
                          type="date"
                          value={editDueDate}
                          onChange={(e) => setEditDueDate(e.target.value)}
                          className="px-2 py-1.5 rounded border border-gray-200 bg-white text-xs text-[#0F1E3C] outline-none focus:border-[#0F1E3C]"
                        />
                        {isAdmin && users.length > 0 && (
                          <select
                            value={editUserId}
                            onChange={(e) => setEditUserId(e.target.value)}
                            className="px-2 py-1.5 rounded border border-gray-200 bg-white text-xs text-[#0F1E3C] outline-none focus:border-[#0F1E3C] max-w-[200px]"
                            title="Assegna a"
                          >
                            <option value="">Assegna a…</option>
                            {users.map((u) => (
                              <option key={u.id} value={u.id}>{u.name}</option>
                            ))}
                          </select>
                        )}
                        {projectsList.length > 0 && (
                          <select
                            value={editProjectId}
                            onChange={(e) => setEditProjectId(e.target.value)}
                            className="px-2 py-1.5 rounded border border-gray-200 bg-white text-xs text-[#0F1E3C] outline-none focus:border-[#0F1E3C] max-w-[200px]"
                            title="Progetto"
                          >
                            <option value="">Nessun progetto</option>
                            {projectsList.map((p) => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                          </select>
                        )}
                        {dealsList.length > 0 && (
                          <select
                            value={editDealId}
                            onChange={(e) => setEditDealId(e.target.value)}
                            className="px-2 py-1.5 rounded border border-gray-200 bg-white text-xs text-[#0F1E3C] outline-none focus:border-[#0F1E3C] max-w-[200px]"
                            title="Deal"
                          >
                            <option value="">Nessun deal</option>
                            {dealsList.map((d) => (
                              <option key={d.id} value={d.id}>{d.name}</option>
                            ))}
                          </select>
                        )}
                        <div className="flex-1" />
                        <button
                          onClick={cancelEdit}
                          disabled={savingEdit}
                          className="text-[11px] px-3 py-1.5 rounded border border-gray-200 text-gray-600 hover:bg-white disabled:opacity-50"
                        >
                          Annulla
                        </button>
                        <button
                          onClick={saveEdit}
                          disabled={savingEdit || !editName.trim()}
                          className="text-[11px] px-3 py-1.5 rounded bg-[#0F1E3C] text-white hover:bg-[#1a2744] disabled:opacity-50 inline-flex items-center gap-1"
                        >
                          {savingEdit ? <Loader2 size={11} className="animate-spin" /> : 'Salva'}
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={t.id} className="group flex items-start gap-3 px-3 py-2.5 hover:bg-gray-50/50 transition-colors">
                    <button
                      onClick={() => toggleDone(t)}
                      disabled={busy}
                      className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 disabled:opacity-50 ${
                        t.state === 'done'
                          ? 'border-[#0F1E3C] bg-[#0F1E3C]'
                          : 'border-gray-300 hover:border-[#0F1E3C]'
                      }`}
                      aria-label={t.state === 'done' ? 'Riapri' : 'Segna fatto'}
                    >
                      {busy ? (
                        <Loader2 size={10} className="animate-spin text-gray-400" />
                      ) : t.state === 'done' ? (
                        <Check size={10} className="text-white" />
                      ) : (
                        <Check size={10} className="text-transparent hover:text-[#0F1E3C]" />
                      )}
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className={`text-sm truncate ${t.state === 'done' ? 'text-gray-400 line-through' : 'text-[#0F1E3C]'}`}>
                        {t.name}
                      </div>
                      {(t.project_name || t.deal_name || t.description) && (
                        <div className="text-[11px] text-gray-500 truncate mt-0.5">
                          {t.project_name && <span>· {t.project_name}</span>}
                          {t.deal_name && <span> · {t.deal_name}</span>}
                          {t.description && <span> · {t.description}</span>}
                        </div>
                      )}
                      {scope === 'all' && t.user_name && (
                        <div className="text-[10px] text-gray-400 mt-0.5">assegnato a {t.user_name}</div>
                      )}
                    </div>

                    {t.due_date && (
                      <span className={`text-[11px] tabular-nums shrink-0 mt-0.5 ${
                        t.is_overdue && t.state === 'open' ? 'text-amber-600 font-semibold' : 'text-gray-400'
                      }`}>
                        {t.is_overdue && t.state === 'open' ? 'in ritardo' : formatDueDate(t.due_date)}
                      </span>
                    )}

                    <div className="flex items-center gap-1 opacity-40 group-hover:opacity-100 transition-opacity shrink-0">
                      <button
                        onClick={() => startEdit(t)}
                        className="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-[#0F1E3C]"
                        title="Modifica"
                      >
                        <Pencil size={12} />
                      </button>
                      {isAdmin && (
                        <button
                          onClick={() => remove(t)}
                          className="p-1 rounded hover:bg-red-50 text-gray-500 hover:text-red-600"
                          title="Elimina"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
