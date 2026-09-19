"use client";
import { useEffect, useState } from "react";
import { Loader2, ArrowRight, Target, Users, Building2, User, Phone, BarChart3, ArrowLeft, Info } from "lucide-react";
import KpiDashboard from "@/components/admin/kpi/KpiDashboard";
import AcquisitionKanban from "@/components/admin/AcquisitionKanban";

interface Partner {
  id: number; name: string; partnerName: string | null; partnerId: number | null;
  contattoName?: string | null; funzione_progetto?: string | null; ruolo?: string | null;
  partnerEmail?: string | null; ruoloContatto?: string | null;
  fromTargetId?: number | null; fromTargetName?: string | null; fromTargetPartnerName?: string | null;
}
interface TargetNode {
  id: number; name: string; partnerName: string | null;
  contattoName: string | null; stageId: number | null; state: string;
}

const FUNZIONE_LABEL: Record<string, { label: string; emoji: string; color: string }> = {
  committente:          { label: "Committente",         emoji: "🎯", color: "text-rose-700 bg-rose-50" },
  partner_finanziario:  { label: "Partner finanziario", emoji: "💰", color: "text-emerald-700 bg-emerald-50" },
  intermediario:        { label: "Intermediario",       emoji: "🤝", color: "text-amber-700 bg-amber-50" },
  consulente_operativo: { label: "Consulente",          emoji: "🛠️", color: "text-indigo-700 bg-indigo-50" },
  referente_tecnico:    { label: "Referente tecnico",   emoji: "⚙️", color: "text-sky-700 bg-sky-50" },
  fornitore:            { label: "Fornitore",           emoji: "📦", color: "text-orange-700 bg-orange-50" },
  osservatore:          { label: "Osservatore",         emoji: "👁️", color: "text-gray-600 bg-gray-100" },
  altro:                { label: "Altro",               emoji: "•",  color: "text-gray-600 bg-gray-100" },
};

export type OperativaContext =
  | { type: 'project' }
  | { type: 'person'; id: number; label: string; partnerId?: number | null }
  | { type: 'target'; id: number; label: string; partnerId?: number | null };

export default function CopertinaPage({
  projectId, projectName, projectParentId,
  onOpenOperativa, onOpenDetail, onBack,
}: {
  projectId: number; projectName: string; projectParentId?: number | null;
  onOpenOperativa: (ctx: OperativaContext) => void;
  onOpenDetail: (person: Partner) => void;
  onBack: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [targets, setTargets] = useState<TargetNode[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`/api/admin/partner-projects/${projectId}`);
        const d = await r.json();
        console.log('[Copertina] API response:', d);
        if (!d.success) { setError(d.error); return; }
        setPartners(d.partners || []);
        setTargets(d.targets || []);
        console.log('[Copertina] partners:', d.partners?.length, 'targets:', d.targets?.length);
      } catch (e: any) { setError(e.message); }
      finally { setLoading(false); }
    })();
  }, [projectId]);

  // 19/09/2026: separo persone dirette (nodi tracking.relation del progetto)
  // dai referenti target (contatto_principale_id di un figlio con funzione=target).
  // Fallback: se fromTargetId non arriva, uso funzione=referente_tecnico.
  const isReferente = (p: Partner) => !!p.fromTargetId || p.funzione_progetto === 'referente_tecnico';
  const personeDirette = partners.filter((p) => !isReferente(p));
  const referentiTarget = partners.filter((p) => isReferente(p));

  // raggruppa persone dirette per funzione
  const gruppi: Record<string, Partner[]> = {};
  for (const p of personeDirette) {
    const k = p.funzione_progetto || 'altro';
    if (!gruppi[k]) gruppi[k] = [];
    gruppi[k].push(p);
  }

  // raggruppa referenti per target
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
    <div className="min-h-screen bg-[#f8fafc]">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-4">

        {/* HEADER COPERTINA */}
        <div className="flex items-center gap-3 mb-4">
          <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors">
            <ArrowLeft size={18} className="text-gray-600" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-[#1a2744] flex items-center gap-2">
              {projectName}
              <span className="text-[10px] font-medium text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full uppercase">
                Copertina
              </span>
            </h1>
            <p className="text-xs text-gray-500">Panoramica progetto · ogni card è cliccabile</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onOpenOperativa({ type: 'project' })}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 text-xs font-semibold hover:bg-gray-50"
            >
              <Target size={12} className="text-indigo-600" /> Scouting
            </button>
            <button
              onClick={() => onOpenOperativa({ type: 'project' })}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-100 bg-red-50 text-red-700 text-xs font-semibold hover:bg-red-100"
            >
              <Phone size={12} /> Avvia call
            </button>
            <button
              onClick={() => onOpenOperativa({ type: 'project' })}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0f172a] text-white text-xs font-semibold hover:bg-[#1e293b]"
            >
              Apri operativa <ArrowRight size={12} />
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700 mb-4">
            {error}
          </div>
        )}

        {/* KPI */}
        <KpiDashboard projectId={projectId} />

        {/* KANBAN full width */}
        <div className="bg-white rounded-2xl border border-gray-100 p-3 mb-4">
          <div className="flex items-center gap-2 mb-2 px-1">
            <BarChart3 size={13} className="text-indigo-600" />
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
              Pipeline target
            </h2>
          </div>
          <div className="overflow-x-auto">
            <AcquisitionKanban relationId={projectId} relationName={projectName} />
          </div>
        </div>

        {/* 2 colonne: persone / target */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

          {/* COL 1: PERSONE */}
          <div className="bg-white rounded-2xl border border-gray-100 p-3">
            <div className="flex items-center gap-2 mb-2 px-1">
              <Users size={13} className="text-indigo-600" />
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                Persone & Parti
              </h2>
              <span className="text-[10px] text-gray-400">({personeDirette.length})</span>
            </div>
            {loading ? (
              <div className="flex justify-center py-3"><Loader2 className="animate-spin text-gray-300" size={16} /></div>
            ) : personeDirette.length === 0 ? (
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
                          <div key={p.id} className="flex items-center gap-1 group">
                            <button
                              onClick={() => onOpenOperativa({ type: 'person', id: p.id, label: p.partnerName || p.name, partnerId: p.partnerId })}
                              className="flex-1 text-left px-2 py-1 rounded hover:bg-gray-50 text-xs flex items-center gap-1.5 min-w-0">
                              <User size={11} className="text-gray-400 shrink-0" />
                              <span className="font-medium text-[#0f172a] truncate">{p.partnerName || p.name}</span>
                              <ArrowRight size={10} className="ml-auto text-gray-300 group-hover:text-indigo-500" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); onOpenDetail(p); }}
                              className="shrink-0 text-indigo-500 hover:text-indigo-700 p-1 rounded hover:bg-indigo-50 transition-colors"
                              title="Dettagli">
                              <Info size={13} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* COL 1-bis: REFERENTI TARGET */}
          {referentiTarget.length > 0 && (
            <div className="bg-white rounded-2xl border border-sky-100 p-3">
              <div className="flex items-center gap-2 mb-2 px-1">
                <Users size={13} className="text-sky-600" />
                <h2 className="text-[11px] font-bold uppercase tracking-wider text-sky-700">
                  Referenti target
                </h2>
                <span className="text-[10px] text-gray-400">({referentiTarget.length})</span>
              </div>
              <div className="space-y-2">
                {Object.entries(referentiPerTarget).map(([key, group]) => (
                  <div key={key}>
                    <button
                      onClick={() => onOpenOperativa({ type: 'target', id: group.targetId, label: group.targetName })}
                      className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-sky-100 text-sky-800 hover:bg-sky-200 transition-colors cursor-pointer">
                      🏢 {group.targetName} <ArrowRight size={9} />
                    </button>
                    <div className="mt-1 space-y-0.5">
                      {group.list.map((r) => (
                        <div key={`ref-${r.id}-${key}`} className="flex items-center gap-1 group">
                          <button
                            onClick={() => onOpenOperativa({ type: 'target', id: group.targetId, label: group.targetName })}
                            className="flex-1 text-left px-2 py-1 rounded hover:bg-sky-50 text-xs flex items-center gap-1.5 min-w-0">
                            <User size={11} className="text-sky-400 shrink-0" />
                            <span className="font-medium text-sky-900 truncate">{r.partnerName || r.name}</span>
                            {r.ruoloContatto && <span className="text-[10px] text-sky-600 italic truncate">· {r.ruoloContatto}</span>}
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); onOpenDetail(r); }}
                            className="shrink-0 text-sky-500 hover:text-sky-700 p-1 rounded hover:bg-sky-50 transition-colors"
                            title="Dettagli">
                            <Info size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* COL 2: TARGET */}
          <div className="bg-white rounded-2xl border border-gray-100 p-3">
            <div className="flex items-center gap-2 mb-2 px-1">
              <Target size={13} className="text-indigo-600" />
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                Target attivi
              </h2>
              <span className="text-[10px] text-gray-400">({targets.length})</span>
            </div>
            {targets.length === 0 ? (
              <p className="text-[11px] text-gray-400 italic px-1 py-2">Nessun target in pipeline.</p>
            ) : (
              <div className="space-y-0.5">
                {targets.map((t) => (
                  <button key={t.id}
                    onClick={() => onOpenOperativa({ type: 'target', id: t.id, label: t.partnerName || t.name })}
                    className="w-full text-left px-2 py-1.5 rounded hover:bg-indigo-50/50 text-xs group">
                    <div className="flex items-center gap-1.5">
                      <Building2 size={11} className="text-gray-400 shrink-0" />
                      <span className="font-medium text-[#0f172a] truncate">{t.partnerName || t.name}</span>
                      <ArrowRight size={10} className="ml-auto text-gray-300 group-hover:text-indigo-500" />
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
    </div>
  );
}
