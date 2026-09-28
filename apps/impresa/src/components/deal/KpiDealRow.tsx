'use client';

import { TrendingUp, Coins, Activity, PiggyBank } from 'lucide-react';

export type KpiDeal = {
  dealAttivi: number;
  feeMonthly: number;
  pipelineTotale: number;
  raccoltaIncassi: number;
};

const eur = (n: number) =>
  new Intl.NumberFormat('it-IT', {
    style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
  }).format(n);

const eurCompact = (n: number) => {
  if (n >= 1_000_000) return `€${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `€${(n / 1_000).toFixed(0)}k`;
  return eur(n);
};

export function KpiDealRow({ kpi }: { kpi: KpiDeal }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <KpiCard
        icon={TrendingUp}
        label="Deal attivi"
        value={String(kpi.dealAttivi)}
        accent="text-emerald-600"
      />
      <KpiCard
        icon={Coins}
        label="Fee / mese"
        value={eurCompact(kpi.feeMonthly)}
        accent="text-indigo-600"
      />
      <KpiCard
        icon={Activity}
        label="Pipeline"
        value={eurCompact(kpi.pipelineTotale)}
        accent="text-amber-600"
      />
      <KpiCard
        icon={PiggyBank}
        label="Incassi"
        value={`${kpi.raccoltaIncassi}%`}
        accent={kpi.raccoltaIncassi >= 100 ? 'text-emerald-600' : 'text-red-500'}
      />
    </div>
  );
}

function KpiCard({
  icon: Icon, label, value, accent,
}: {
  icon: typeof TrendingUp;
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
          {label}
        </span>
        <Icon size={14} className={accent} />
      </div>
      <div className={`text-2xl font-bold tabular-nums ${accent}`}>
        {value}
      </div>
    </div>
  );
}
