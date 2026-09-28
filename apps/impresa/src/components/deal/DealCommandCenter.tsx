'use client';

import Link from 'next/link';
import { ArrowRight, FileSignature, TrendingUp } from 'lucide-react';

export type DealCollegato = {
  id: number;
  name: string;
  state: string;
  revenueModel: string;
  schemaCode: string;
  sellerName: string | null;
  sellerIsPlaceholder: boolean;
  buyerName: string | null;
  buyerIsPlaceholder: boolean;
  progressDone: number;
  progressTotal: number;
  nextStepId: number | null;
  nextStepLabel: string | null;
};

const STATE_LABEL: Record<string, string> = {
  forecasting: 'In previsione',
  negotiating: 'In trattativa',
  frozen: 'Congelato',
  signing: 'In firma',
  active: 'Attivo',
  closed: 'Chiuso',
  cancelled: 'Annullato',
};

const STATE_STYLE: Record<string, string> = {
  forecasting: 'bg-slate-100 text-slate-700 border-slate-300',
  negotiating: 'bg-blue-50 text-blue-700 border-blue-300',
  frozen: 'bg-amber-50 text-amber-800 border-amber-300',
  signing: 'bg-indigo-50 text-indigo-700 border-indigo-300',
  active: 'bg-emerald-50 text-emerald-700 border-emerald-300',
  closed: 'bg-gray-100 text-gray-600 border-gray-300',
  cancelled: 'bg-red-50 text-red-700 border-red-300',
};

export function DealCommandCenter({
  deal,
  childProjectId,
}: {
  deal: DealCollegato;
  childProjectId: number;
}) {
  const st = STATE_STYLE[deal.state] || STATE_STYLE.forecasting;
  const stateLabel = STATE_LABEL[deal.state] || deal.state;
  const pct = deal.progressTotal > 0
    ? Math.round((deal.progressDone / deal.progressTotal) * 100)
    : 0;

  const seller = deal.sellerIsPlaceholder
    ? <span className="font-mono text-gray-500">{deal.sellerName || '—'}</span>
    : <span className="font-medium">{deal.sellerName || '—'}</span>;
  const buyer = deal.buyerIsPlaceholder
    ? <span className="font-mono text-gray-500">{deal.buyerName || '—'}</span>
    : <span className="font-medium">{deal.buyerName || '—'}</span>;

  return (
    <section className="mb-5 rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50/40 to-white p-5">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp size={14} className="text-indigo-600" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">
              Deal collegato
            </span>
          </div>
          <h2 className="text-xl font-bold text-gray-900 truncate">
            {deal.name}
          </h2>
          <div className="flex items-center gap-2 mt-2">
            <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${st}`}>
              {stateLabel}
            </span>
            <span className="text-xs font-mono bg-gray-100 px-2 py-0.5 rounded text-gray-600">
              {deal.revenueModel}
            </span>
            <span className="text-xs text-gray-400 font-mono">
              #{deal.id} · {deal.schemaCode}
            </span>
          </div>
        </div>

        <Link
          href={`/admin/deals/${deal.id}`}
          className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 flex items-center gap-1.5 shrink-0"
        >
          Apri dashboard deal <ArrowRight size={14} />
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-4 text-sm mb-4">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
            Venditore
          </div>
          {seller}
        </div>
        <div className="flex items-center justify-center text-gray-300">
          <ArrowRight size={16} />
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
            Compratore
          </div>
          {buyer}
        </div>
      </div>

      {deal.progressTotal > 0 && (
        <div className="border-t border-indigo-100 pt-3">
          <div className="flex items-center justify-between text-xs text-gray-600 mb-2">
            <div className="flex items-center gap-2">
              <FileSignature size={12} className="text-indigo-600" />
              <span className="font-semibold">Avanzamento wizard</span>
              <span className="text-gray-400">
                {deal.progressDone}/{deal.progressTotal} step
              </span>
            </div>
            {deal.nextStepLabel && (
              <span className="text-xs text-indigo-700 font-semibold">
                Prossimo: {deal.nextStepLabel}
              </span>
            )}
          </div>
          <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
            <div
              className="h-full bg-indigo-500 transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}
    </section>
  );
}
