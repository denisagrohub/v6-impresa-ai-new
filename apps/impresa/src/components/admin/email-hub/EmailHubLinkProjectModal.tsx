'use client';
import { useEffect, useState } from 'react';
import { Loader2, X, Link2, AlertCircle } from 'lucide-react';

type ProjectNode = {
  id: number;
  name: string;
  partner_id: number | null;
  partner_name: string | null;
  descendants: Array<{
    id: number;
    name: string;
    partner_id: number | null;
    partner_name: string | null;
    depth: number;
  }>;
};

type Props = {
  open: boolean;
  messageId: number | null;
  currentProjectId: number | null;
  currentParteId: number | null;
  authHeaders: () => Record<string, string>;
  onClose: () => void;
  onSaved: () => void;
};

export default function EmailHubLinkProjectModal({
  open, messageId, currentProjectId, currentParteId,
  authHeaders, onClose, onSaved,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState<ProjectNode[]>([]);
  const [projectId, setProjectId] = useState<number | null>(null);
  const [parteId, setParteId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setProjectId(currentProjectId);
    setParteId(currentParteId);
    (async () => {
      setLoading(true);
      try {
        const r = await fetch('/api/admin/relations/tree', { headers: authHeaders() });
        const d = await r.json();
        const data = d.data || d;
        setProjects(data.projects || []);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [open, currentProjectId, currentParteId]);

  if (!open) return null;

  const activeProject = projects.find((p) => p.id === projectId);
  const partes = activeProject
    ? activeProject.descendants.filter((d) => d.partner_id)
    : [];

  const save = async () => {
    if (!messageId || !projectId) return;
    setSaving(true); setError(null);
    try {
      const r = await fetch(`/api/admin/emails/${messageId}/link-project`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          parte_id: parteId || undefined,
        }),
      });
      const d = await r.json();
      const data = d.data || d;
      if (!data.ok) {
        setError(data.error || 'Errore');
        return;
      }
      onSaved();
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-hub-panel w-full max-w-lg">
        <div className="flex items-center justify-between px-5 py-4 border-b border-brand-border">
          <div className="flex items-center gap-2">
            <Link2 size={16} className="text-brand-navy" />
            <h3 className="text-base font-bold text-brand-navy">
              Collega a progetto
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-brand-sand transition-colors"
          >
            <X size={16} className="text-brand-muted" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={20} className="animate-spin text-brand-muted" />
            </div>
          )}

          {!loading && (
            <>
              <div>
                <label className="block text-xs font-semibold text-brand-muted uppercase tracking-wider mb-1.5">
                  Progetto {currentProjectId ? '(bloccato)' : ''}
                </label>
                {currentProjectId ? (
                  <input
                    type="text"
                    value={activeProject?.name || `Progetto #${currentProjectId}`}
                    readOnly
                    className="w-full px-3 py-2 text-sm rounded-lg border border-brand-border bg-brand-sand"
                  />
                ) : (
                  <select
                    value={projectId || ''}
                    onChange={(e) => {
                      const v = e.target.value ? Number(e.target.value) : null;
                      setProjectId(v);
                      setParteId(null);
                    }}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-brand-border bg-white focus:outline-none focus:ring-2 focus:ring-brand-terracotta/20 focus:border-brand-terracotta"
                  >
                    <option value="">— Scegli —</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-brand-muted uppercase tracking-wider mb-1.5">
                  Parte (opzionale)
                </label>
                <select
                  value={parteId || ''}
                  onChange={(e) => setParteId(e.target.value ? Number(e.target.value) : null)}
                  disabled={!projectId}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-brand-border bg-white focus:outline-none focus:ring-2 focus:ring-brand-terracotta/20 focus:border-brand-terracotta disabled:opacity-50"
                >
                  <option value="">— Nessuna —</option>
                  {partes.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} — {d.partner_name}
                    </option>
                  ))}
                </select>
                {projectId && partes.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1.5">
                    Nessuna parte con partner su questo progetto. Creala in /admin/partner-projects.
                  </p>
                )}
              </div>
            </>
          )}

          {error && (
            <div className="flex items-start gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2.5">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-brand-border bg-brand-sand/50">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-3 py-1.5 text-xs rounded-lg text-brand-muted hover:bg-brand-card transition-colors"
          >
            Annulla
          </button>
          <button
            onClick={save}
            disabled={saving || !projectId}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-navy text-white text-xs font-semibold hover:bg-brand-navy/90 transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Link2 size={12} />}
            Collega
          </button>
        </div>
      </div>
    </div>
  );
}
