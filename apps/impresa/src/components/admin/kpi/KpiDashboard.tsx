"use client";
import { useEffect, useState } from "react";
import { Loader2, TrendingUp, TrendingDown, Mail, Phone } from "lucide-react";
import KpiGauge from "./KpiGauge";
import KpiSparkline from "./KpiSparkline";

interface KpiData {
  targets: { active: number; total: number; target: number; currentMonthCreated: number; media3m: number; trendPct: number | null; semaforo: string };
  partners: { count: number; target: number; semaforo: string };
  pipeline: { total: number; breakdown: { stage: string; count: number; is_won: boolean; is_lost: boolean }[] };
  emails: { last30: number; target: number; daily: number; trend: number[]; semaforo: string };
  calls: { last30: number; target: number; avgDuration: number; trend: number[]; semaforo: string };
  performance: { currentMonthCreated: number; media3m: number; delta: number; trendPct: number | null; semaforo: string };
}

const SEM_DOT: Record<string, string> = {
  green: "bg-emerald-500", yellow: "bg-amber-400", red: "bg-red-500", gray: "bg-gray-300",
};

function Cell({ label, value, sub, sem, accent = "#0f172a", spark, sparkColor }: {
  label: string; value: React.ReactNode; sub?: string; sem?: string; accent?: string;
  spark?: number[]; sparkColor?: string;
}) {
  return (
    <div className="flex-1 min-w-0 px-3 py-2 border-r border-gray-100 last:border-r-0">
      <div className="flex items-center gap-1.5 mb-0.5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 truncate">{label}</span>
        {sem && <span className={`w-1.5 h-1.5 rounded-full ${SEM_DOT[sem] || SEM_DOT.gray}`} />}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="font-mono tabular-nums text-3xl font-bold leading-none" style={{ color: accent }}>{value}</span>
        {sub && <span className="text-xs text-gray-500 truncate">{sub}</span>}
      </div>
      {spark && (
        <div className="h-8 mt-1">
          <KpiSparkline values={spark} color={sparkColor || "#1a7fa8"} height={28} />
        </div>
      )}
    </div>
  );
}

export default function KpiDashboard({
  projectId,
  apiBase = '/api/admin/partner-projects',
}: {
  projectId: number;
  apiBase?: string;
}) {
  const [data, setData] = useState<KpiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${apiBase}/${projectId}/kpi`);
        const d = await r.json();
        if (!d.success) { setError(d.error); return; }
        setData(d.kpi);
      } catch (e: any) { setError(e.message); }
      finally { setLoading(false); }
    })();
  }, [projectId, apiBase]);

  if (loading) return <div className="flex justify-center py-2"><Loader2 className="animate-spin text-gray-400" size={14} /></div>;
  if (error) return <div className="text-xs text-red-600 py-1">KPI: {error}</div>;
  if (!data) return null;

  const pct = data.targets.target > 0 ? Math.round((data.targets.active / data.targets.target) * 100) : 0;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 mb-4">
      <div className="flex items-stretch">
        {/* Target: mini gauge */}
        <div className="flex items-center gap-2 px-3 py-2 border-r border-gray-100">
          <div className="w-24 shrink-0">
            <KpiGauge
              value={data.targets.active}
              max={data.targets.target}
              color={data.targets.semaforo === 'red' ? '#ef4444' : data.targets.semaforo === 'green' ? '#10b981' : '#1a7fa8'}
            />
          </div>
          <div>
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Target</span>
              <span className={`w-1.5 h-1.5 rounded-full ${SEM_DOT[data.targets.semaforo]}`} />
            </div>
            <div className="font-mono tabular-nums text-3xl font-bold text-[#0f172a] leading-none">
              {data.targets.active}<span className="text-gray-300">/</span>{data.targets.target}
            </div>
            <div className="text-[11px] text-gray-500 mt-1">{pct}% · {data.targets.total} tot</div>
          </div>
        </div>

        <Cell
          label="Partner"
          value={data.partners.count}
          sub={`/ ${data.partners.target}`}
          sem={data.partners.semaforo}
          accent={data.partners.semaforo === 'green' ? '#10b981' : '#0f172a'}
        />

        <div className="flex-1 min-w-0 px-3 py-2 border-r border-gray-100">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Pipeline</span>
          </div>
          <div className="flex items-center gap-2 h-5 flex-wrap">
            {data.pipeline.breakdown.slice(0, 4).map((s) => (
              <div key={s.stage} className="flex items-center gap-1">
                <span className={`w-1.5 h-1.5 rounded-full ${s.is_won ? "bg-emerald-500" : s.is_lost ? "bg-red-400" : "bg-indigo-400"}`} />
                <span className="text-xs text-gray-700 font-semibold">{s.count}</span>
                <span className="text-[10px] text-gray-500 truncate max-w-[70px]">{s.stage}</span>
              </div>
            ))}
            {data.pipeline.breakdown.length === 0 && (
              <span className="text-[10px] text-gray-400 italic">—</span>
            )}
          </div>
          <div className="text-[11px] text-gray-500 mt-1">{data.pipeline.total} in corso</div>
        </div>

        <Cell
          label="Email 30g"
          value={data.emails.last30}
          sub={`${data.emails.daily}/gg`}
          sem={data.emails.semaforo}
          spark={data.emails.trend}
          sparkColor="#1a7fa8"
        />

        <Cell
          label="Call 30g"
          value={data.calls.last30}
          sub={data.calls.avgDuration > 0 ? `${data.calls.avgDuration}min` : undefined}
          sem={data.calls.semaforo}
          spark={data.calls.trend}
          sparkColor="#10b981"
        />

        <div className="flex-1 min-w-0 px-4 py-4">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Rendimento</span>
            <span className={`w-1.5 h-1.5 rounded-full ${SEM_DOT[data.performance.semaforo]}`} />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="font-mono tabular-nums text-3xl font-bold text-[#0f172a] leading-none">
              {data.performance.currentMonthCreated}
            </span>
            <span className="text-[10px] text-gray-400">mese</span>
          </div>
          <div className="flex items-center gap-1 text-[10px] mt-0.5">
            {data.performance.trendPct == null ? (
              <span className="text-gray-400">primo mese</span>
            ) : data.performance.trendPct >= 0 ? (
              <><TrendingUp size={9} className="text-emerald-600" /><span className="text-emerald-700 font-semibold">+{data.performance.trendPct}%</span></>
            ) : (
              <><TrendingDown size={9} className="text-red-500" /><span className="text-red-600 font-semibold">{data.performance.trendPct}%</span></>
            )}
            <span className="text-gray-400 truncate">vs media 3m</span>
          </div>
        </div>
      </div>
    </div>
  );
}
