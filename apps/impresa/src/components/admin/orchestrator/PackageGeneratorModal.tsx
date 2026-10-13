'use client';
import { useEffect, useState } from 'react';
import { Loader2, X, FileText, AlertCircle, CheckCircle2 } from 'lucide-react';

type ProjectNode = {
  id: number;
  name: string;
  partner_id: number | null;
  descendants: Array<{
    id: number;
    name: string;
    partner_id: number | null;
    partner_name: string | null;
    depth: number;
  }>;
};

export type GeneratorContext = {
  project_id?: number | null;
  parte_id?: number | null;
  doc_type?: string | null;
  source_message_id?: number | null;
};

type Props = {
  open: boolean;
  context: GeneratorContext;
  authHeaders: () => Record<string, string>;
  onClose: () => void;
};

const DOC_TYPES = [
  { key: 'nda', label: 'NDA' },
  { key: 'ncnd', label: 'NCND' },
];

export default function PackageGeneratorModal({ open, context, authHeaders, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState<ProjectNode[]>([]);
  const [projectId, setProjectId] = useState<number | null>(null);
  const [parteId, setParteId] = useState<number | null>(null);
  const [docType, setDocType] = useState<string>('nda');

  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<{ documentId: number; hasPdf: boolean; templateMissing: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setResult(null);
    setProjectId(context.project_id ?? null);
    setParteId(context.parte_id ?? null);
    setDocType(context.doc_type || 'nda');

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
  }, [open, context.project_id, context.parte_id, context.doc_type]);

  if (!open) return null;

  const activeProject = projects.find((p) => p.id === projectId);
  const partes = activeProject
    ? activeProject.descendants.filter((d) => d.partner_id)
    : [];
  const lockedProject = !!context.project_id;
  const lockedParte = !!context.parte_id;

  const activeParteName = (() => {
    if (!parteId) return null;
    for (const p of projects) {
      const f = p.descendants.find((d) => d.id === parteId);
      if (f) return `${f.name} — ${f.partner_name || ''}`;
    }
    return `Parte #${parteId}`;
  })();

  const generate = async () => {
    if (!parteId || !docType) return;
    setGenerating(true); setError(null); setResult(null);
    try {
      const r = await fetch(`/api/admin/relations/${parteId}/documents`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ docType }),
      });
      const d = await r.json();
      if (!d.success) {
        setError(d.error || 'Errore');
        return;
      }
      setResult({
        documentId: d.documentId,
        hasPdf: !!d.hasPdf,
        templateMissing: !!d.templateMissing,
      });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-hub-panel w-full max-w-lg">
        <div className="flex items-center justify-between px-5 py-4 border-b border-brand-border">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-brand-navy" />
            <h3 className="text-base font-bold text-brand-navy">Genera documento</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-brand-sand transition-colors">
            <X size={16} className="text-brand-muted" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {loading && (
            <div className="flex items-center justify-center py-6">
              <Loader2 size={20} className="animate-spin text-brand-muted" />
            </div>
          )}

          {!loading && (
            <>
              <div>
                <label className="block text-xs font-semibold text-brand-muted uppercase tracking-wider mb-1.5">Progetto</label>
                {lockedProject ? (
                  <input type="text" value={activeProject?.name || `Progetto #${projectId}`} readOnly className="w-full px-3 py-2 text-sm rounded-lg border border-brand-border bg-brand-sand" />
                ) : (
                  <select
                    value={projectId ?? ''}
                    onChange={(e) => { const v = e.target.value ? Number(e.target.value) : null; setProjectId(v); setParteId(null); }}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-brand-border bg-white focus:outline-none focus:ring-2 focus:ring-brand-terracotta/20 focus:border-brand-terracotta"
                  >
                    <option value="">— Scegli —</option>
                    {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-brand-muted uppercase tracking-wider mb-1.5">Parte firmataria</label>
                {lockedParte ? (
                  <input type="text" value={activeParteName || `Parte #${parteId}`} readOnly className="w-full px-3 py-2 text-sm rounded-lg border border-brand-border bg-brand-sand" />
                ) : (
                  <select
                    value={parteId ?? ''}
                    onChange={(e) => setParteId(e.target.value ? Number(e.target.value) : null)}
                    disabled={!projectId}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-brand-border bg-white focus:outline-none focus:ring-2 focus:ring-brand-terracotta/20 focus:border-brand-terracotta disabled:opacity-50"
                  >
                    <option value="">— Scegli —</option>
                    {partes.map((d) => <option key={d.id} value={d.id}>{d.name} — {d.partner_name}</option>)}
                  </select>
                )}
                {projectId && partes.length === 0 && !lockedParte && (
                  <p className="text-xs text-amber-600 mt-1.5">Nessuna parte con partner. Creala prima in /admin/partner-projects.</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-brand-muted uppercase tracking-wider mb-1.5">Tipo documento</label>
                <div className="flex gap-2">
                  {DOC_TYPES.map((dt) => (
                    <button
                      key={dt.key}
                      onClick={() => setDocType(dt.key)}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${
                        docType === dt.key
                          ? 'bg-brand-navy text-white border-brand-navy'
                          : 'bg-white text-brand-text border-brand-border hover:border-brand-navy/40'
                      }`}
                    >
                      {dt.label}
                    </button>
                  ))}
                </div>
              </div>

              {result && (
                <div className={`flex items-start gap-2 text-xs rounded-lg p-3 border ${
                  result.hasPdf ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-amber-50 border-amber-200 text-amber-800'
                }`}>
                  {result.hasPdf ? <CheckCircle2 size={14} className="shrink-0 mt-0.5" /> : <AlertCircle size={14} className="shrink-0 mt-0.5" />}
                  <div className="flex-1">
                    {result.hasPdf ? 'PDF generato.' : 'Documento creato, senza template Typst.'}
                    {result.documentId && (
                      <a href={`/api/admin/contract-documents/${result.documentId}/download`} target="_blank" rel="noopener noreferrer" className="ml-2 underline font-semibold">
                        Apri PDF
                      </a>
                    )}
                  </div>
                </div>
              )}

              {error && (
                <div className="flex items-start gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2.5">
                  <AlertCircle size={14} className="shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-brand-border bg-brand-sand/50">
          <button onClick={onClose} disabled={generating} className="px-3 py-1.5 text-xs rounded-lg text-brand-muted hover:bg-brand-card transition-colors">
            Chiudi
          </button>
          <button
            onClick={generate}
            disabled={generating || !parteId || !docType || !!result?.hasPdf}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-terracotta text-white text-xs font-semibold hover:bg-brand-terracotta/90 transition-colors disabled:opacity-50"
          >
            {generating ? <Loader2 size={12} className="animate-spin" /> : <FileText size={12} />}
            Genera PDF
          </button>
        </div>
      </div>
    </div>
  );
}
