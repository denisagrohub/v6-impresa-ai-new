// ═══════════════════════════════════════════════════════════════════
// DealInfoCard — card riassuntiva deal: venditore, compratore, congelato,
// contatori leg/partecipanti, note. Estratto il 29/09/2026 (C1.b) da:
//   app/admin/deals/[id]/page.tsx
// Props piatte (no Deal) per disaccoppiare il componente dal tipo
// monolitico del page. Zero cambio UX.
// ═══════════════════════════════════════════════════════════════════

type Props = {
  sellerIsPlaceholder: boolean;
  sellerPlaceholderCode: string;
  sellerName: string;
  // 29/09/2026 (C5.2): alias email anti-aggiramento del nodo deal
  relationEmailAlias?: string | null;
  buyerIsPlaceholder: boolean;
  buyerPlaceholderCode: string;
  buyerName: string;
  frozenAt: string | null;
  legsCount: number;
  participantsCount: number;
  notes: string;
};

export function DealInfoCard({
  sellerIsPlaceholder, sellerPlaceholderCode, sellerName,
  buyerIsPlaceholder, buyerPlaceholderCode, buyerName,
  frozenAt, legsCount, participantsCount, notes,
  relationEmailAlias,
}: Props) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div>
          <div className="text-xs text-gray-500 uppercase">Venditore</div>
          <div className="font-medium">
            {sellerIsPlaceholder
              ? `${sellerPlaceholderCode} (placeholder)`
              : sellerName}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500 uppercase">Compratore</div>
          <div className="font-medium">
            {buyerIsPlaceholder
              ? `${buyerPlaceholderCode} (placeholder)`
              : buyerName}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500 uppercase">Congelato</div>
          <div className="font-medium">
            {frozenAt ? new Date(frozenAt).toLocaleString('it-IT') : '—'}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500 uppercase">Leg / Partecipanti</div>
          <div className="font-medium">{legsCount} / {participantsCount}</div>
        </div>
      </div>
      {relationEmailAlias && (
        <div className="mt-3 pt-3 border-t border-gray-100 text-xs">
          <span className="text-gray-500 uppercase tracking-wide">Comunicazioni ufficiali</span>
          <div className="mt-0.5 font-mono text-[#0f172a]">
            {relationEmailAlias}@v6sviluppoimpresa.it
          </div>
          <p className="text-[10px] text-gray-400 mt-0.5">
            Alias tracciato del deal. Le email su questo indirizzo vengono
            registrate sul deal (log immutabile).
          </p>
        </div>
      )}
      {notes && (
        <div className="mt-3 pt-3 border-t border-gray-100 text-sm text-gray-600">
          {notes}
        </div>
      )}
    </div>
  );
}
