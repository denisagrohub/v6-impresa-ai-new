'use client';

export type SplitLine = {
  participantId: number;
  partnerName: string | null;
  sharePct: number;
  monthlyBase: number;
  tier: string;
};

const eur = (n: number) =>
  new Intl.NumberFormat('it-IT', {
    style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
  }).format(n);

const TIER_STYLE: Record<string, string> = {
  founder: 'bg-amber-50 text-amber-800 border-amber-300',
  associate: 'bg-blue-50 text-blue-700 border-blue-300',
  v6_entity: 'bg-indigo-50 text-indigo-700 border-indigo-300',
  consultant: 'bg-gray-50 text-gray-700 border-gray-300',
  referral: 'bg-purple-50 text-purple-700 border-purple-300',
};

export function SplitSquadraCard({ lines }: { lines: SplitLine[] }) {
  if (!lines || lines.length === 0) return null;

  const totalShare = lines.reduce((s, l) => s + l.sharePct, 0);
  const totalMonthly = lines.reduce((s, l) => s + l.monthlyBase, 0);
  const isBalanced = Math.abs(totalShare - 100) < 0.02;

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-900">
          Split squadra
        </h2>
        <span className={`text-xs font-semibold ${isBalanced ? 'text-emerald-600' : 'text-red-500'}`}>
          {totalShare.toFixed(2)}%
          {isBalanced && ' ✓'}
        </span>
      </div>

      <div className="space-y-2">
        {lines.map(line => {
          const tierStyle = TIER_STYLE[line.tier] || TIER_STYLE.consultant;
          return (
            <div
              key={line.participantId}
              className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-gray-900 truncate">
                    {line.partnerName || '—'}
                  </span>
                  {line.tier && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border font-semibold ${tierStyle}`}>
                      {line.tier}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-sm font-mono font-semibold text-gray-900">
                  {line.sharePct.toFixed(2)}%
                </div>
                <div className="text-xs text-gray-500 font-mono">
                  {eur(line.monthlyBase)}/mese
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 pt-3 border-t border-gray-200 flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
          Totale
        </span>
        <div className="text-right">
          <div className="text-sm font-bold text-gray-900">
            {totalShare.toFixed(2)}%
          </div>
          <div className="text-xs font-mono font-semibold text-gray-700">
            {eur(totalMonthly)}/mese
          </div>
        </div>
      </div>
    </section>
  );
}
