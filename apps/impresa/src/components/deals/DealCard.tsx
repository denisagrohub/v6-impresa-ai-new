'use client';

import Link from 'next/link';

export type DealCollegato = {
  id: number;
  name: string;
  state: string;
  revenueModel: string;
};

type Props = {
  deal: DealCollegato;
  className?: string;
};

const STATE_LABEL: Record<string, string> = {
  draft: 'Bozza',
  frozen: 'Congelato',
  sent: 'In firma',
  signed: 'Firmato',
  active: 'Attivo',
  closed: 'Chiuso',
};

const STATE_COLOR: Record<string, string> = {
  draft: 'bg-gray-50 text-gray-700 border-gray-300',
  frozen: 'bg-amber-50 text-amber-800 border-amber-300',
  sent: 'bg-blue-50 text-blue-800 border-blue-300',
  signed: 'bg-green-50 text-green-800 border-green-300',
  active: 'bg-emerald-50 text-emerald-800 border-emerald-300',
  closed: 'bg-slate-100 text-slate-600 border-slate-300',
};

const MODEL_LABEL: Record<string, string> = {
  spread: 'Spread',
  fee: 'Fee',
  mixed: 'Misto',
};

const FALLBACK_COLOR = 'bg-gray-50 text-gray-700 border-gray-300';

export function DealCard({ deal, className = '' }: Props) {
  const label = STATE_LABEL[deal.state] ?? deal.state;
  const color = STATE_COLOR[deal.state] ?? FALLBACK_COLOR;
  const model = MODEL_LABEL[deal.revenueModel] ?? deal.revenueModel;

  return (
    <Link
      href={`/admin/deals/${deal.id}`}
      className={`block rounded-lg border p-3 transition hover:shadow-md ${color} ${className}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-sm truncate">{deal.name}</span>
        <span className="text-xs font-mono opacity-60">#{deal.id}</span>
      </div>
      <div className="mt-2 flex items-center gap-2 text-xs">
        <span className="rounded-full border px-2 py-0.5">{label}</span>
        <span className="rounded-full border px-2 py-0.5">{model}</span>
      </div>
    </Link>
  );
}
