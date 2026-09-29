// ═══════════════════════════════════════════════════════════════════
// DealProspettoPanel — tabella prospetto congelato (riga per partecipante).
// Estratto il 29/09/2026 (C1.b) da:
//   app/admin/deals/[id]/page.tsx
// Mostra MIN/BASE/MAX mensile per ogni linea. Usa fmtEur e roleLabel
// da ./format.
// ═══════════════════════════════════════════════════════════════════

import { fmtEur, roleLabel } from './format';

type ProspettoLine = {
  id: number;
  partnerName: string;
  role: string;
  monthlyMin: number;
  monthlyBase: number;
  monthlyMax: number;
};

type Prospetto = {
  id: number;
  version: number;
  state: string;
  computedAt: string;
  lines: ProspettoLine[];
};

type Props = { prospetto: Prospetto | null };

export function DealProspettoPanel({ prospetto }: Props) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <span className="font-semibold text-sm">
          Prospetto {prospetto ? `v${prospetto.version}` : '—'}
        </span>
        {prospetto && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-700">
            {prospetto.state}
          </span>
        )}
      </div>
      {!prospetto ? (
        <div className="p-4 text-sm text-gray-500">Nessun prospetto generato.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-gray-600 uppercase">
              <tr>
                <th className="px-3 py-2 text-left">Partecipante</th>
                <th className="px-3 py-2 text-right">MIN/mese</th>
                <th className="px-3 py-2 text-right">BASE/mese</th>
                <th className="px-3 py-2 text-right">MAX/mese</th>
              </tr>
            </thead>
            <tbody>
              {prospetto.lines.map(line => (
                <tr key={line.id} className="border-t border-gray-100">
                  <td className="px-3 py-2">
                    <div className="font-medium">{line.partnerName}</div>
                    <div className="text-gray-500">{roleLabel[line.role] || line.role}</div>
                  </td>
                  <td className="px-3 py-2 text-right font-mono">{fmtEur(line.monthlyMin)}</td>
                  <td className="px-3 py-2 text-right font-mono">{fmtEur(line.monthlyBase)}</td>
                  <td className="px-3 py-2 text-right font-mono">{fmtEur(line.monthlyMax)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
