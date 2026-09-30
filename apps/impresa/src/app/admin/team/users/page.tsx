// ═══════════════════════════════════════════════════════════════════
// /admin/team/users — lista utenti con ruoli + link al dettaglio.
// Step 6 (30/09/2026): gestione ruoli senza shell Odoo.
// ═══════════════════════════════════════════════════════════════════
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, Users, ChevronRight } from 'lucide-react';

type UserRole = 'admin' | 'chief_projects' | 'chief_accounting'
  | 'chief_bandi' | 'chief_marketing' | 'chief_kb'
  | 'consultant' | 'referral' | 'client' | 'external';

type UserRow = {
  id: number;
  name: string;
  email: string;
  login: string;
  active: boolean;
  roles: UserRole[];
};

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  chief_projects: 'Chief Projects',
  chief_accounting: 'Chief Accounting',
  chief_bandi: 'Chief Bandi',
  chief_marketing: 'Chief Marketing',
  chief_kb: 'Chief KB',
  consultant: 'Consulente',
  referral: 'Referral',
  client: 'Cliente',
  external: 'Esterno',
};

const ROLE_COLORS: Record<UserRole, string> = {
  admin: 'bg-red-100 text-red-700',
  chief_projects: 'bg-purple-100 text-purple-700',
  chief_accounting: 'bg-emerald-100 text-emerald-700',
  chief_bandi: 'bg-amber-100 text-amber-700',
  chief_marketing: 'bg-pink-100 text-pink-700',
  chief_kb: 'bg-cyan-100 text-cyan-700',
  consultant: 'bg-blue-100 text-blue-700',
  referral: 'bg-gray-100 text-gray-700',
  client: 'bg-gray-100 text-gray-600',
  external: 'bg-orange-100 text-orange-700',
};

export default function UsersListPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);

  const authHeaders = (): Record<string, string> => {
    try {
      const raw = localStorage.getItem('pi_session');
      const s = raw ? JSON.parse(raw) : null;
      return s?.token ? { Authorization: `JWT ${s.token}` } : {};
    } catch { return {}; }
  };

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/admin/users', { headers: authHeaders() });
        const d = await r.json();
        if (!d.success) { setError(d.error || 'Errore'); return; }
        setUsers(d.users || []);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <Link href="/admin/team" className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline mb-4">
        <ArrowLeft className="w-4 h-4" /> Torna al team
      </Link>

      <header className="mb-6">
        <h1 className="text-2xl font-bold text-[#1a2744] flex items-center gap-2">
          <Users size={22} /> Utenti e ruoli
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Gestisci i ruoli applicativi di ogni utente. Un utente può avere più ruoli.
        </p>
      </header>

      {error && (
        <div className="mb-4 p-3 rounded border border-red-200 bg-red-50 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" /> Caricamento…
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="px-4 py-3">Utente</th>
                <th className="px-4 py-3">Ruoli</th>
                <th className="px-4 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-sm text-[#0f172a]">{u.name}</div>
                    <div className="text-xs text-gray-500">{u.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {u.roles.length === 0 ? (
                        <span className="text-xs text-gray-400 italic">nessun ruolo</span>
                      ) : u.roles.map(r => (
                        <span
                          key={r}
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded ${ROLE_COLORS[r] || 'bg-gray-100 text-gray-700'}`}
                        >
                          {ROLE_LABELS[r] || r}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/team/${u.id}`}
                      className="inline-flex items-center text-gray-400 hover:text-indigo-600"
                    >
                      <ChevronRight size={18} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
