'use client';

export type SplitLine = {
  partner_name: string;
  tier: string;
  share_pct: number;
  base_monthly: number;
};

type Props = {
  version: number;
  lines: SplitLine[];
  totalBase: number;
  frozen?: boolean;
};

const eur = (n: number) =>
  n.toLocaleString('it-IT', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  });

export function SplitVersionCard({ version, lines, totalBase, frozen }: Props) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm">Split v{version}</h3>
        {frozen && (
          <span className="text-xs rounded-full bg-amber-50 border border-amber-300 px-2 py-0.5 text-amber-800">
            Congelato
          </span>
        )}
      </div>

      <table className="w-full text-xs">
        <thead className="text-gray-500 border-b">
          <tr>
            <th className="text-left py-1">Partner</th>
            <th className="text-left py-1">Tier</th>
            <th className="text-right py-1">%</th>
            <th className="text-right py-1">BASE/mese</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i} className="border-b last:border-0">
              <td className="py-1 truncate">{l.partner_name}</td>
              <td className="py-1 text-gray-500">{l.tier}</td>
              <td className="py-1 text-right font-mono">
                {l.share_pct.toFixed(2)}%
              </td>
              <td className="py-1 text-right font-mono">
                {eur(l.base_monthly)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="font-semibold border-t">
            <td colSpan={3} className="py-1 text-right">
              Totale
            </td>
            <td className="py-1 text-right font-mono">{eur(totalBase)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
