'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Plus, Loader2, ChevronDown } from 'lucide-react';
import { CreateDealModal } from './CreateDealModal';

export type KanbanDeal = {
  id: number;
  name: string;
  state: string;
  revenueModel: string;
  schemaCode: string;
  relationId: number;
  relationName: string | null;
  sellerName: string | null;
  sellerIsPlaceholder: boolean;
  sellerPlaceholderCode: string | null;
  buyerName: string | null;
  buyerIsPlaceholder: boolean;
  buyerPlaceholderCode: string | null;
  progressDone: number;
  progressTotal: number;
  feeMonthlyBase: number;
};

const COLUMNS: { key: string; label: string; states: string[]; accent: string }[] = [
  { key: 'scouting', label: 'Scouting', states: ['forecasting'], accent: 'border-slate-300 bg-slate-50' },
  { key: 'negotiating', label: 'Negoziazione', states: ['negotiating'], accent: 'border-blue-300 bg-blue-50/50' },
  { key: 'signing', label: 'In firma', states: ['frozen', 'signing'], accent: 'border-amber-300 bg-amber-50/50' },
  { key: 'active', label: 'Attivo', states: ['active'], accent: 'border-emerald-300 bg-emerald-50/50' },
  { key: 'closed', label: 'Chiuso', states: ['closed', 'cancelled'], accent: 'border-gray-300 bg-gray-50' },
];

const eur = (n: number) =>
  new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);

function DealCard({ deal }: { deal: KanbanDeal }) {
  const pct = deal.progressTotal > 0
    ? Math.round((deal.progressDone / deal.progressTotal) * 100)
    : 0;
  const seller = deal.sellerIsPlaceholder ? deal.sellerPlaceholderCode || '—' : (deal.sellerName || '—');
  const buyer = deal.buyerIsPlaceholder ? deal.buyerPlaceholderCode || '—' : (deal.buyerName || '—');

  return (
    <Link
      href={`/admin/deals/${deal.id}`}
      className="block rounded-lg border border-gray-200 bg-white p-3 hover:shadow-md hover:border-indigo-300 transition-all"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-gray-900 truncate">{deal.name}</div>
          <div className="text-[10px] text-gray-400 font-mono mt-0.5">
            #{deal.id} · {deal.schemaCode}
          </div>
        </div>
        <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-100 font-mono text-gray-600 shrink-0">
          {deal.revenueModel}
        </span>
      </div>

      <div className="text-xs text-gray-600 mb-2">
        <span className={deal.sellerIsPlaceholder ? 'font-mono text-gray-400' : ''}>
          {seller}
        </span>
        <span className="mx-1 text-gray-300">→</span>
        <span className={deal.buyerIsPlaceholder ? 'font-mono text-gray-400' : ''}>
          {buyer}
        </span>
      </div>

      {deal.progressTotal > 0 && (
        <div className="mb-2">
          <div className="flex items-center justify-between text-[10px] text-gray-500 mb-1">
            <span>Wizard</span>
            <span className="font-semibold">{deal.progressDone}/{deal.progressTotal}</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-1">
            <div
              className="h-full bg-indigo-500 rounded-full transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {deal.feeMonthlyBase > 0 && (
        <div className="text-[10px] text-gray-500">
          Fee base/mese: <span className="font-semibold text-gray-700">{eur(deal.feeMonthlyBase)}</span>
        </div>
      )}
    </Link>
  );
}

export function DealsKanban({
  deals,
  parentProjectId,
  authToken,
  onDealCreated,
}: {
  deals: KanbanDeal[];
  parentProjectId?: number;
  authToken?: string;
  onDealCreated?: () => void;
}) {
  const [showCreate, setShowCreate] = useState(false);
  // 02/10/2026 (C4b-3): blocco "Pipeline deal" collassabile (default aperto).
  const [pipelineOpen, setPipelineOpen] = useState(true);
  const canCreate = parentProjectId != null && authToken != null && onDealCreated != null;

  if (!deals || deals.length === 0) {
    if (!canCreate) return null;
  }

  const byColumn = COLUMNS.map(col => ({
    ...col,
    deals: deals.filter(d => col.states.includes(d.state)),
  }));

  return (
    <section className="mt-6">
      <button
        onClick={() => setPipelineOpen((v) => !v)}
        className="w-full flex items-center gap-2 mb-3 hover:bg-gray-50 transition-colors text-left rounded"
      >
        <ChevronDown
          size={14}
          className={`text-gray-400 transition-transform shrink-0 ${pipelineOpen ? '' : '-rotate-90'}`}
        />
        <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
          Pipeline deal
          <span className="text-xs font-normal text-gray-400">
            ({deals.length} {deals.length === 1 ? 'deal' : 'deal'})
          </span>
        </h2>
      </button>

      {pipelineOpen && (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
        {byColumn.map(col => (
          <div key={col.key} className={`rounded-xl border-2 ${col.accent} p-2.5`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-700">
                {col.label}
              </span>
              <div className="flex items-center gap-1">
                {col.key === 'scouting' && canCreate && (
                  <button
                    onClick={() => setShowCreate(true)}
                    className="w-5 h-5 rounded-full bg-indigo-600 text-white hover:bg-indigo-700 flex items-center justify-center"
                    title="Nuovo deal"
                  >
                    <Plus size={12} />
                  </button>
                )}
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white font-semibold text-gray-600">
                  {col.deals.length}
                </span>
              </div>
            </div>
            <div className="space-y-2 min-h-[40px]">
              {col.deals.length === 0 ? (
                <div className="text-[10px] text-gray-400 italic text-center py-3">
                  Vuoto
                </div>
              ) : (
                col.deals.map(d => <DealCard key={d.id} deal={d} />)
              )}
            </div>
          </div>
        ))}
      </div>
      )}

      {showCreate && canCreate && (
        <CreateDealModal
          parentId={parentProjectId!}
          authToken={authToken!}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            onDealCreated?.();
          }}
        />
      )}
    </section>
  );
}
