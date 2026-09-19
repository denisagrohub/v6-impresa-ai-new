"use client";

export default function KpiProgressBar({
  value, max, segments,
}: {
  value: number;
  max: number;
  segments?: { stage: string; count: number; is_won: boolean; is_lost: boolean }[];
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="py-2">
      <div className="flex items-baseline justify-between mb-2">
        <span className="font-mono tabular-nums text-2xl font-bold text-[#0f172a]">{value}</span>
        <span className="text-xs text-gray-400">/ {max} · {pct}%</span>
      </div>
      <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden mb-3">
        <div
          className="h-full bg-gradient-to-r from-[#1a7fa8] to-[#0f3460] rounded-full transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
      {segments && segments.length > 0 && (
        <div className="space-y-1">
          {segments.map((s) => (
            <div key={s.stage} className="flex items-center justify-between text-[11px]">
              <span className="flex items-center gap-1.5 text-gray-600">
                <span className={`w-1.5 h-1.5 rounded-full ${s.is_won ? "bg-emerald-500" : s.is_lost ? "bg-red-400" : "bg-gray-300"}`} />
                {s.stage}
              </span>
              <span className="font-medium text-gray-800 tabular-nums">{s.count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
