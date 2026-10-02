'use client';

import Link from 'next/link';
import { DealCard, type DealCollegato } from '@/components/deals/DealCard';

export type ChildProject = {
  id: number;
  name: string;
  state: string;
  partnerName: string | null;
  deals: DealCollegato[];
};

// ═══════════════════════════════════════════════════════════════════
// 02/10/2026 (C4): badge di progresso del figlio.
// Prende lo stato del deal "più avanzato" e lo mostra come pill.
// Se più deal, mostra lo stato dominante + conteggio.
// ═══════════════════════════════════════════════════════════════════

type DealState = 'forecasting' | 'negotiating' | 'frozen' | 'signing'
               | 'active' | 'closed' | 'cancelled';

const STATE_PRIORITY: Record<string, number> = {
  active: 6,
  signing: 5,
  negotiating: 4,
  forecasting: 3,
  frozen: 2,
  closed: 1,
  cancelled: 0,
};

const STATE_STYLE: Record<string, { label: string; cls: string }> = {
  active:      { label: 'Attivo',       cls: 'bg-emerald-50 text-emerald-700 border-emerald-300' },
  signing:     { label: 'In firma',     cls: 'bg-blue-50 text-blue-700 border-blue-300' },
  negotiating: { label: 'In trattativa',cls: 'bg-amber-50 text-amber-800 border-amber-300' },
  forecasting: { label: 'Previsione',   cls: 'bg-amber-50 text-amber-800 border-amber-300' },
  frozen:      { label: 'Congelato',    cls: 'bg-slate-100 text-slate-600 border-slate-300' },
  closed:      { label: 'Chiuso',       cls: 'bg-slate-200 text-slate-700 border-slate-400' },
  cancelled:   { label: 'Annullato',    cls: 'bg-red-50 text-red-700 border-red-300' },
};

function ChildProgressBadge({ deals }: { deals: DealCollegato[] }) {
  if (!deals || deals.length === 0) {
    return (
      <span className="inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium bg-gray-50 text-gray-500 border-gray-200 italic">
        Nessun deal
      </span>
    );
  }

  // Stato dominante
  const dominant = deals.reduce((best, d) => {
    const bp = STATE_PRIORITY[best] ?? -1;
    const dp = STATE_PRIORITY[d.state] ?? -1;
    return dp > bp ? d.state : best;
  }, deals[0].state as string);

  const style = STATE_STYLE[dominant] || { label: dominant, cls: 'bg-gray-50 text-gray-600 border-gray-300' };

  return (
    <span className="inline-flex items-center gap-1">
      <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${style.cls}`}>
        {style.label}
      </span>
      {deals.length > 1 && (
        <span className="text-[10px] text-gray-400 tabular-nums">
          {deals.length} deal
        </span>
      )}
    </span>
  );
}

type Props = {
  projects: ChildProject[];
  emptyLabel?: string;
};

export function ChildProjectsList({
  projects,
  emptyLabel = 'Nessun progetto operativo',
}: Props) {
  if (projects.length === 0) {
    return <p className="text-sm text-gray-500 italic py-3">{emptyLabel}</p>;
  }

  return (
    <ul className="space-y-3">
      {projects.map((p) => (
        <li key={p.id} className="rounded-lg border border-gray-200 bg-white p-3">
          <div className="flex items-center justify-between gap-2">
            <Link
              href={`/admin/partner-projects/${p.id}`}
              className="font-medium text-sm hover:underline truncate"
            >
              {p.name}
            </Link>
            <div className="flex items-center gap-2 shrink-0">
              <ChildProgressBadge deals={p.deals} />
              <span className="text-xs font-mono text-gray-400">#{p.id}</span>
            </div>
          </div>

          {p.partnerName && (
            <p className="text-xs text-gray-500 mt-0.5">{p.partnerName}</p>
          )}

          {p.deals && p.deals.length > 0 ? (
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {p.deals.map((d) => (
                <DealCard key={d.id} deal={d} />
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-400 italic mt-2">
              Nessun deal collegato
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
