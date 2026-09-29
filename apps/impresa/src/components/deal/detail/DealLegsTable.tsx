// ═══════════════════════════════════════════════════════════════════
// DealLegsTable — tabella dei leg/venditori del deal (multi-leg aggregazione).
// Estratto il 29/09/2026 (C1.b) da:
//   app/admin/deals/[id]/page.tsx
// ═══════════════════════════════════════════════════════════════════

type Leg = {
  id: number;
  sellerName: string;
  sellerIsPlaceholder: boolean;
  sellerPlaceholderCode: string;
  quantita: number;
  prezzoAcquisto: number;
  prezzoVendita: number;
};

type Props = { legs: Leg[] };

export function DealLegsTable({ legs }: Props) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      <div className="px-4 py-3 border-b border-gray-200 font-semibold text-sm">
        Leg / Venditori ({legs.length})
      </div>
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-xs text-gray-600 uppercase">
          <tr>
            <th className="px-4 py-2 text-left">Venditore</th>
            <th className="px-4 py-2 text-right">Q.tà</th>
            <th className="px-4 py-2 text-right">Prezzo acq.</th>
          </tr>
        </thead>
        <tbody>
          {legs.map(l => (
            <tr key={l.id} className="border-t border-gray-100">
              <td className="px-4 py-2">
                {l.sellerIsPlaceholder
                  ? <span className="font-mono text-gray-500">{l.sellerPlaceholderCode}</span>
                  : l.sellerName}
              </td>
              <td className="px-4 py-2 text-right font-mono">{l.quantita.toLocaleString('it-IT')}</td>
              <td className="px-4 py-2 text-right font-mono">{l.prezzoAcquisto || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
