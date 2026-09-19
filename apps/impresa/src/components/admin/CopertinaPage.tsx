"use client";
import { useEffect, useState } from "react";
import { Loader2, ArrowRight, Target, Users, Building2, User, Phone, BarChart3, ArrowLeft } from "lucide-react";
import KpiDashboard from "@/components/admin/kpi/KpiDashboard";
import AcquisitionKanban from "@/components/admin/AcquisitionKanban";

interface Partner {
  id: number; name: string; partnerName: string | null; partnerId: number | null;
  contattoName?: string | null; funzione_progetto?: string | null; ruolo?: string | null;
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
  onOpenOperativa, onBack,
}: {
  projectId: number; projectName: string; projectParentId?: number | null;
  onOpenOperativa: (ctx: OperativaContext) => void;
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

  // raggruppa partners per funzione
  const gruppi: Record<string, Partner[]> = {};
  for (const p of partners) {
    const k = p.funzione_progetto || 'altro';
    if (!gruppi[k]) gruppi[k] = [];
    gruppi[k].push(p);
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
          <button
            onClick={() => onOpenOperativa({ type: 'project' })}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0f172a] text-white text-xs font-semibold hover:bg-[#1e293b]"
          >
            Apri operativa <ArrowRight size={12} />
          </button>
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

        {/* 3 colonne: persone / target / azioni */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">

          {/* COL 1: PERSONE */}
          <div className="bg-white rounded-2xl border border-gray-100 p-3">
            <div className="flex items-center gap-2 mb-2 px-1">
              <Users size={13} className="text-indigo-600" />
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                Persone & Parti
              </h2>
              <span className="text-[10px] text-gray-400">({partners.length})</span>
            </div>
            {loading ? (
              <div className="flex justify-center py-3"><Loader2 className="animate-spin text-gray-300" size={16} /></div>
            ) : partners.length === 0 ? (
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
                          <button key={p.id}
                            onClick={() => onOpenOperativa({ type: 'person', id: p.id, label: p.partnerName || p.name, partnerId: p.partnerId })}
                            className="w-full text-left px-2 py-1 rounded hover:bg-gray-50 text-xs group flex items-center gap-1.5">
                            <User size={11} className="text-gray-400 shrink-0" />
                            <span className="font-medium text-[#0f172a] truncate">{p.partnerName || p.name}</span>
                            <ArrowRight size={10} className="ml-auto text-gray-300 group-hover:text-indigo-500" />
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

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

          {/* COL 3: AZIONI */}
          <div className="space-y-3">
            {/* SCOUTING CTA */}
            <button
              onClick={() => onOpenOperativa({ type: 'project' })}
              className="w-full bg-white rounded-2xl border border-gray-100 p-3 hover:border-indigo-300 transition-colors text-left group">
              <div className="flex items-center gap-2 mb-1">
                <Target size={13} className="text-indigo-600" />
                <h2 className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                  Scouting Relazione
                </h2>
                <ArrowRight size={11} className="ml-auto text-gray-300 group-hover:text-indigo-500" />
              </div>
              <p className="text-[10px] text-gray-500">Apri il profilo target del progetto</p>
            </button>

            {/* QUICK CALL */}
            <button
              onClick={() => onOpenOperativa({ type: 'project' })}
              className="w-full bg-gradient-to-r from-red-50 to-white rounded-2xl border border-red-100 p-3 hover:border-red-300 transition-colors text-left group">
              <div className="flex items-center gap-2 mb-1">
                <Phone size={13} className="text-red-600" />
                <h2 className="text-[11px] font-bold uppercase tracking-wider text-red-700">
                  Avvia call
                </h2>
                <ArrowRight size={11} className="ml-auto text-red-300 group-hover:text-red-500" />
              </div>
              <p className="text-[10px] text-gray-500">Scegli destinatario in Operativa</p>
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
