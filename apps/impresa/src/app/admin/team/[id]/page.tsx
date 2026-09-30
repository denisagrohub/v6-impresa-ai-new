// ═══════════════════════════════════════════════════════════════════
// /admin/team/[id] — dettaglio utente con checkbox ruoli.
//
// Step 6 (30/09/2026): assegnazione ruoli senza shell Odoo.
// - Lista ruoli editabili: chief_*, consultant
// - admin è hardcoded (id=2, non modificabile da UI)
// - Salva → PUT /api/admin/users/[id]/roles
// ═══════════════════════════════════════════════════════════════════
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2, Save, AlertTriangle, Shield } from 'lucide-react';

type UserRole = 'admin' | 'chief_projects' | 'chief_accounting'
  | 'chief_bandi' | 'chief_marketing' | 'chief_kb'
  | 'consultant' | 'referral' | 'client' | 'external';

type UserData = {
  id: number;
  name: string;
  email: string;
  login: string;
  active: boolean;
  emailSlug: string | null;
  roles: UserRole[];
  isHardcodedAdmin: boolean;
};

const ROLE_LABELS: Record<UserRole, { label: string; desc: string; color: string }> = {
  admin:              { label: 'Admin',              desc: 'Accesso totale al sistema', color: 'bg-red-50 text-red-700 border-red-300' },
  chief_projects:     { label: 'Chief Projects',     desc: 'Gestione progetti, deal, firme, contratti', color: 'bg-purple-50 text-purple-700 border-purple-300' },
  chief_accounting:   { label: 'Chief Accounting',   desc: 'Contabilità, pagamenti, commissioni', color: 'bg-emerald-50 text-emerald-700 border-emerald-300' },
  chief_bandi:        { label: 'Chief Bandi',        desc: 'Bandi, candidature, match', color: 'bg-amber-50 text-amber-700 border-amber-300' },
  chief_marketing:    { label: 'Chief Marketing',    desc: 'Blog, marketing, brand', color: 'bg-pink-50 text-pink-700 border-pink-300' },
  chief_kb:           { label: 'Chief Knowledge Base', desc: 'KB, libreria, methodology', color: 'bg-cyan-50 text-cyan-700 border-cyan-300' },
  consultant:         { label: 'Consulente',         desc: 'Area personale consulente', color: 'bg-blue-50 text-blue-700 border-blue-300' },
  referral:           { label: 'Referral',           desc: 'Solo dashboard referral', color: 'bg-gray-50 text-gray-700 border-gray-300' },
  client:             { label: 'Cliente',            desc: 'Portale cliente esterno', color: 'bg-gray-50 text-gray-700 border-gray-300' },
  external:           { label: 'Esterno',            desc: 'Avvocato/commercialista (lettura contratti + firma)', color: 'bg-orange-50 text-orange-700 border-orange-300' },
};

// Ruoli editabili da UI (admin escluso)
const EDITABLE_ROLES: UserRole[] = [
  'chief_projects', 'chief_accounting', 'chief_bandi', 'chief_marketing', 'chief_kb',
  'consultant', 'referral', 'client', 'external',
];

export default function UserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params?.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [user, setUser] = useState<UserData | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<UserRole[]>([]);

  const authHeaders = (): Record<string, string> => {
    try {
      const raw = localStorage.getItem('pi_session');
      const s = raw ? JSON.parse(raw) : null;
      return s?.token ? { Authorization: `JWT ${s.token}` } : {};
    } catch { return {}; }
  };

  useEffect(() => {
    if (!userId) return;
    (async () => {
      try {
        const r = await fetch(`/api/admin/users/${userId}/roles`, { headers: authHeaders() });
        const d = await r.json();
        if (!d.success) { setError(d.error || 'Errore'); return; }
        setUser(d.user);
        setSelectedRoles(d.user.roles || []);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  const toggleRole = (role: UserRole) => {
    setSelectedRoles(prev =>
      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
    );
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    setMsg(null);
    try {
      const r = await fetch(`/api/admin/users/${user.id}/roles`, {
        method: 'PUT',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ roles: selectedRoles }),
      });
      const d = await r.json();
      if (!d.success) {
        setMsg({ type: 'err', text: d.error || 'Errore salvataggio' });
      } else {
        setMsg({ type: 'ok', text: 'Ruoli aggiornati' });
        // ricarica
        const r2 = await fetch(`/api/admin/users/${user.id}/roles`, { headers: authHeaders() });
        const d2 = await r2.json();
        if (d2.success) {
          setUser(d2.user);
          setSelectedRoles(d2.user.roles || []);
        }
      }
    } catch (e: any) {
      setMsg({ type: 'err', text: e.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="p-6 flex items-center gap-2 text-gray-500">
      <Loader2 className="w-4 h-4 animate-spin" /> Caricamento…
    </div>
  );

  if (error || !user) return (
    <div className="p-6 max-w-3xl mx-auto">
      <Link href="/admin/team" className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline mb-4">
        <ArrowLeft className="w-4 h-4" /> Torna al team
      </Link>
      <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md">
        {error || 'Utente non trovato'}
      </div>
    </div>
  );

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Link href="/admin/team" className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline mb-4">
        <ArrowLeft className="w-4 h-4" /> Torna al team
      </Link>

      <header className="mb-6">
        <h1 className="text-2xl font-bold text-[#1a2744] flex items-center gap-2">
          {user.name}
          {user.isHardcodedAdmin && (
            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
              <Shield size={12} /> Admin hardcoded
            </span>
          )}
        </h1>
        <p className="text-sm text-gray-500 mt-1">{user.email}</p>
        {user.emailSlug && (
          <p className="text-xs text-gray-400 font-mono mt-0.5">{user.emailSlug}@v6impresa.it</p>
        )}
      </header>

      {user.isHardcodedAdmin && (
        <div className="mb-4 p-3 rounded border border-amber-200 bg-amber-50 text-sm text-amber-800 flex gap-2">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <span>
            Il ruolo <strong>admin</strong> è hardcoded e non può essere modificato da qui.
            Assegnato al solo account amministratore principale.
          </span>
        </div>
      )}

      {msg && (
        <div className={`mb-4 p-3 rounded border text-sm ${
          msg.type === 'ok'
            ? 'bg-green-50 border-green-200 text-green-700'
            : 'bg-red-50 border-red-200 text-red-700'
        }`}>
          {msg.text}
        </div>
      )}

      <section className="bg-white border border-gray-200 rounded-lg p-5 mb-4">
        <h2 className="font-semibold mb-3 text-sm text-gray-700">Ruoli assegnati</h2>
        <p className="text-xs text-gray-500 mb-4">
          Un utente può avere più ruoli. I permessi effettivi sono l'unione di tutti i ruoli.
        </p>

        <div className="space-y-2">
          {/* Admin (read-only) */}
          {user.isHardcodedAdmin && (
            <label className="flex items-start gap-3 p-3 rounded border border-gray-200 bg-gray-50 cursor-not-allowed opacity-75">
              <input type="checkbox" checked readOnly disabled className="mt-0.5 accent-red-600" />
              <div className="flex-1">
                <div className="font-medium text-sm">{ROLE_LABELS.admin.label}</div>
                <div className="text-xs text-gray-500">{ROLE_LABELS.admin.desc}</div>
              </div>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${ROLE_LABELS.admin.color}`}>
                hardcoded
              </span>
            </label>
          )}

          {/* Ruoli editabili */}
          {EDITABLE_ROLES.map(role => {
            const info = ROLE_LABELS[role];
            const checked = selectedRoles.includes(role);
            return (
              <label
                key={role}
                className={`flex items-start gap-3 p-3 rounded border cursor-pointer transition-colors ${
                  checked ? 'border-indigo-300 bg-indigo-50/50' : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleRole(role)}
                  className="mt-0.5 accent-indigo-600"
                />
                <div className="flex-1">
                  <div className="font-medium text-sm">{info.label}</div>
                  <div className="text-xs text-gray-500">{info.desc}</div>
                </div>
              </label>
            );
          })}
        </div>
      </section>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 rounded bg-[#0f172a] text-white text-sm font-semibold hover:bg-[#1e293b] disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Salvo…' : 'Salva ruoli'}
        </button>
      </div>
    </div>
  );
}
