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
            <span className="text-xs font-mono text-gray-400">#{p.id}</span>
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
