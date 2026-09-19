"use client";
import { useEffect, useState } from "react";
import { Loader2, TrendingUp, TrendingDown, Target, CheckCircle2, BarChart3, Mail, Phone } from "lucide-react";
import KpiGauge from "./KpiGauge";
import KpiOdometer from "./KpiOdometer";
import KpiProgressBar from "./KpiProgressBar";
import KpiSparkline from "./KpiSparkline";

interface KpiData {
  targets: { active: number; total: number; target: number; currentMonthCreated: number; media3m: number; trendPct: number | null; semaforo: string };
  partners: { count: number; target: number; semaforo: string };
  pipeline: { total: number; breakdown: { stage: string; count: number; is_won: boolean; is_lost: boolean }[] };
  emails: { last30: number; target: number; daily: number; trend: number[]; semaforo: string };
  calls: { last30: number; target: number; avgDuration: number; trend: number[]; semaforo: string };
  performance: { currentMonthCreated: number; media3m: number; delta: number; trendPct: number | null; semaforo: string };
}

const SEMAFORO_DOT: Record<string, string> = {
  green: "bg-emerald-500", yellow: "bg-amber-400", red: "bg-red-500", gray: "bg-gray-300",
};
const SEMAFORO_LABEL: Record<string, string> = {
  green: "sopra target", yellow: "in linea", red: "sotto target", gray: "nessun target",
};

function KpiCard({ title, icon, semaforo, children }: {
  title: string; icon: React.ReactNode; semaforo?: string; children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-gray-500">
          {icon} {title}
        </div>
        {semaforo && (
          <span className="flex items-center gap-1 text-[10px] text-gray-500">
            <span className={`w-2 h-2 rounded-full ${SEMAFORO_DOT[semaforo] || SEMAFORO_DOT.gray}`} />
            {SEMAFORO_LABEL[semaforo] || ""}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

export default function KpiDashboard({ projectId }: { projectId: number }) {
  const [data, setData] = useState<KpiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`/api/admin/partner-projects/${projectId}/kpi`);
        const d = await r.json();
        if (!d.success) { setError(d.error); return; }
        setData(d.kpi);
      } catch (e: any) { setError(e.message); }
      finally { setLoading(false); }
    })();
  }, [projectId]);

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="animate-spin text-gray-400" size={20} /></div>;
  if (error) return <div className="text-xs text-red-600 py-3">KPI non disponibili: {error}</div>;
  if (!data) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
      {/* 1. TARGET ATTIVI - Tachigrafo */}
      <KpiCard title="Target attivi" icon={<Target size={12} />} semaforo={data.targets.semaforo}>
        <KpiGauge
          value={data.targets.active}
          max={data.targets.target}
          label={`${data.targets.total} totali`}
          sublabel={data.targets.media3m > 0 ? `media 3m: ${data.targets.media3m}/mese` : "primo mese"}
        />
      </KpiCard>

      {/* 2. PARTNER - Contachilometri */}
      <KpiCard title="Partner chiusi" icon={<CheckCircle2 size={12} />} semaforo={data.partners.semaforo}>
        <KpiOdometer
          value={data.partners.count}
          label={`target anno: ${data.partners.target}`}
          sublabel={`${Math.round((data.partners.count / (data.partners.target || 1)) * 100)}% obiettivo`}
          color={data.partners.semaforo === "green" ? "#10b981" : "#0f172a"}
        />
      </KpiCard>

      {/* 3. PIPELINE - Barra + breakdown */}
      <KpiCard title="In pipeline" icon={<BarChart3 size={12} />}>
        <KpiProgressBar
          value={data.pipeline.total}
          max={data.targets.target}
          segments={data.pipeline.breakdown}
        />
      </KpiCard>

      {/* 4. EMAIL - Sparkline */}
      <KpiCard title="Email (30gg)" icon={<Mail size={12} />} semaforo={data.emails.semaforo}>
        <div className="flex items-baseline justify-between mb-1">
          <span className="font-mono tabular-nums text-3xl font-bold text-[#0f172a]">{data.emails.last30}</span>
          <span className="text-[10px] text-gray-400">{data.emails.daily}/giorno · target {data.emails.target}</span>
        </div>
        <KpiSparkline values={data.emails.trend} color="#1a7fa8" height={45} />
      </KpiCard>

      {/* 5. CALL - Sparkline */}
      <KpiCard title="Call (30gg)" icon={<Phone size={12} />} semaforo={data.calls.semaforo}>
        <div className="flex items-baseline justify-between mb-1">
          <span className="font-mono tabular-nums text-3xl font-bold text-[#0f172a]">{data.calls.last30}</span>
          <span className="text-[10px] text-gray-400">
            {data.calls.avgDuration ? `durata media: ${data.calls.avgDuration}min` : `target: ${data.calls.target}`}
          </span>
        </div>
        <KpiSparkline values={data.calls.trend} color="#10b981" height={45} />
      </KpiCard>

      {/* 6. RENDIMENTO - Delta mese vs media */}
      <KpiCard title="Rendimento" icon={<TrendingUp size={12} />} semaforo={data.performance.semaforo}>
        <div className="py-2">
          <div className="flex items-baseline justify-between mb-1">
            <span className="font-mono tabular-nums text-2xl font-bold text-[#0f172a]">
              {data.performance.currentMonthCreated}
            </span>
            <span className="text-[10px] text-gray-400">target nuovi/mese</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs mt-2">
            {data.performance.trendPct == null ? (
              <span className="text-gray-400">primo mese di dati</span>
            ) : data.performance.trendPct >= 0 ? (
              <><TrendingUp size={13} className="text-emerald-600" /><span className="text-emerald-700 font-semibold">
                +{data.performance.trendPct}% vs media 3m
              </span></>
            ) : (
              <><TrendingDown size={13} className="text-red-500" /><span className="text-red-600 font-semibold">
                {data.performance.trendPct}% vs media 3m
              </span></>
            )}
          </div>
          <div className="text-[10px] text-gray-400 mt-1">media 3m: {data.performance.media3m}/mese</div>
        </div>
      </KpiCard>
    </div>
  );
}
