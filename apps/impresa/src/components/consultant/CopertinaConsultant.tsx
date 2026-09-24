"use client";
import { useEffect, useState } from "react";
import { Loader2, ArrowRight, Target, Users, Building2, User } from "lucide-react";
import KpiDashboard from "@/components/admin/kpi/KpiDashboard";

interface Partner {
  id: number; name: string; partnerName: string | null; partnerId: number | null;
  contattoName?: string | null; funzione_progetto?: string | null; ruolo?: string | null;
  fromTargetId?: number | null; fromTargetName?: string | null; fromTargetPartnerName?: string | null;
}
interface TargetNode {
  id: number; name: string; partnerName: string | null;
  contattoName: string | null; stageId: number | null; state: string;
}

const FUNZIONE_LABEL: Record<string, { label: string; emoji: string; color: string }> = {
  committente:          { label: "Committente",         emoji: "��", color: "text-rose-700 bg-rose-50" },
  partner_finanziario:  { label: "Partner finanziario", emoji: "💰", color: "text-emerald-700 bg-emerald-50" },
  intermediario:        { label: "Intermediario",       emoji: "🤝", color: "text-amber-700 bg-amber-50" },
  consulente_operativo: { label: "Consulente",          emoji: "🛠️", color: "text-indigo-700 bg-indigo-50" },
  referente_tecnico:    { label: "Referente tecnico",   emoji: "⚙️", color: "text-sky-700 bg-sky-50" },
  fornitore:            { label: "Fornitore",           emoji: "📦", color: "text-orange-700 bg-orange-50" },
  osservatore:          { label: "Osservatore",         emoji: "👁️", color: "text-gray-600 bg-gray-100" },
  altro:                { label: "Altro",               emoji: "•",  color: "text-gray-600 bg-gray-100" },
};

interface Props {
  projectId: number;
  projectName: string;
  userToken?: string | null;
  onOpenTarget?: (id: number, name: string) => void;
}

export default function CopertinaConsultant({ projectId, projectName, userToken, onOpenTarget }: Props) {
  const [loading, setLoading] = useState(true);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [targets, setTargets] = useState<TargetNode[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        if (!userToken) { setError('Sessione mancante'); return; }
        const r = await fetch(`/api/consultant/partner-projects/${projectId}`, {
          headers: { Authorization: `JWT ${userToken}` },
        });
        const d = await r.json();
        if (!r.ok || d.error) { setError(d.error); return; }
        setPartners(d.partners || []);
        setTargets(d.targets || []);
      } catch (e: any) { setError(e.message); }
      finally { setLoading(false); }
    })();
  }, [projectId, userToken]);

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="animate-spin text-gray-300" size={24} /></div>;
  }
  if (error) {
    return <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>;
  }

  const isReferente = (p: Partner) => !!p.fromTargetId || p.funzione_progetto === 'referente_tecnico';
  const personeDirette = partners.filter((p) => !isReferente(p));
  const referentiTarget = partners.filter((p) => isReferente(p));

  const gruppi: Record<string, Partner[]> = {};
  for (const p of personeDirette) {
    const k = p.funzione_progetto || 'altro';
    if (!gruppi[k]) gruppi[k] = [];
    gruppi[k].push(p);
  }

  const referentiPerTarget: Record<string, { targetId: number; targetName: string; list: Partner[] }> = {};
  for (const r of referentiTarget) {
    const key = String(r.fromTargetId || 'unknown');
    if (!referentiPerTarget[key]) {
      referentiPerTarget[key] = {
        targetId: r.fromTargetId || 0,
        targetName: r.fromTargetPartnerName || r.fromTargetName || 'Target',
        list: [],
      };
    }
    referentiPerTarget[key].list.push(r);
  }

  return (
    <div className="space-y-3">
      <KpiDashboard projectId={projectId} apiBase="/api/consultant/partner-projects" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl border border-gray-100 p-3">
          <div className="flex items-center gap-2 mb-2 px-1">
            <Users size={13} className="text-indigo-600" />
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Persone & Parti</h2>
            <span className="text-[10px] text-gray-400">({personeDirette.length})</span>
          </div>
          {personeDirette.length === 0 ? (
            <p className="text-[11px] text-gray-400 italic px-1 py-2">Nessuna persona collegata.</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(gruppi).map(([fun, list]) => {
                const meta = FUNZIONE_LABEL[fun] || FUNZIONE_LABEL.altro;
                return (
                  <div key={fun}>
                    <div className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded ${meta.color}`}>
                      {meta.emoji} {meta.label} ({list.length})
                    </div>
                    <div className="mt-1 space-y-0.5">
                      {list.map((p) => (
                        <div key={p.id} className="text-left px-2 py-1 rounded text-xs flex items-center gap-1.5 min-w-0">
                          <User size={11} className="text-gray-400 shrink-0" />
                          <span className="font-medium text-[#0f172a] truncate">{p.partnerName || p.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {referentiTarget.length > 0 && (
          <div className="bg-white rounded-2xl border border-sky-100 p-3">
            <div className="flex items-center gap-2 mb-2 px-1">
              <Users size={13} className="text-sky-600" />
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-sky-700">Referenti target</h2>
              <span className="text-[10px] text-gray-400">({referentiTarget.length})</span>
            </div>
            <div className="space-y-2">
              {Object.entries(referentiPerTarget).map(([key, group]) => (
                <div key={key}>
                  <div className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-sky-100 text-sky-800">
                    🏢 {group.targetName}
                  </div>
                  <div className="mt-1 space-y-0.5">
                    {group.list.map((r) => (
                      <div key={`ref-${r.id}-${key}`} className="text-left px-2 py-1 rounded text-xs flex items-center gap-1.5 min-w-0">
                        <User size={11} className="text-sky-400 shrink-0" />
                        <span className="font-medium text-sky-900 truncate">{r.partnerName || r.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-gray-100 p-3">
          <div className="flex items-center gap-2 mb-2 px-1">
            <Target size={13} className="text-indigo-600" />
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Target attivi</h2>
            <span className="text-[10px] text-gray-400">({targets.length})</span>
          </div>
          {targets.length === 0 ? (
            <p className="text-[11px] text-gray-400 italic px-1 py-2">Nessun target in pipeline.</p>
          ) : (
            <div className="space-y-0.5">
              {targets.map((t) => (
                <button key={t.id}
                  onClick={() => onOpenTarget?.(t.id, t.partnerName || t.name)}
                  className="w-full text-left px-2 py-1.5 rounded hover:bg-indigo-50/50 text-xs group">
                  <div className="flex items-center gap-1.5">
                    <Building2 size={11} className="text-gray-400 shrink-0" />
                    <span className="font-medium text-[#0f172a] truncate">{t.partnerName || t.name}</span>
                    {onOpenTarget && <ArrowRight size={10} className="ml-auto text-gray-300 group-hover:text-indigo-500" />}
                  </div>
                  {t.contattoName && (
                    <div className="text-[10px] text-gray-500 mt-0.5 ml-4 flex items-center gap-1">
                      <User size={9} /> {t.contattoName}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
