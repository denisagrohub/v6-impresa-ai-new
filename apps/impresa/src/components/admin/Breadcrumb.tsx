'use client';

import Link from 'next/link';
import { ChevronRight, Home } from 'lucide-react';

export type BreadcrumbItem = {
  id?: number;
  name: string;
  url?: string;
};

export function Breadcrumb({
  items,
  current,
}: {
  items: BreadcrumbItem[];
  current?: string;
}) {
  return (
    <nav className="flex items-center gap-1.5 text-xs text-gray-500 mb-3">
      <Link
        href="/admin/partner-projects"
        className="text-gray-400 hover:text-gray-800 transition-colors flex items-center gap-1"
        title="Tutti i progetti"
      >
        <Home size={12} />
      </Link>

      {items.map((item, i) => (
        <span key={`${item.id ?? i}-${item.name}`} className="flex items-center gap-1.5">
          <ChevronRight size={12} className="text-gray-300" />
          {item.url ? (
            <Link
              href={item.url}
              className="hover:text-gray-900 transition-colors truncate max-w-[180px]"
              title={item.name}
            >
              {item.name}
            </Link>
          ) : (
            <span className="text-gray-700 truncate max-w-[180px]" title={item.name}>
              {item.name}
            </span>
          )}
        </span>
      ))}

      {current && (
        <span className="flex items-center gap-1.5">
          <ChevronRight size={12} className="text-gray-300" />
          <span className="text-gray-900 font-semibold truncate max-w-[220px]" title={current}>
            {current}
          </span>
        </span>
      )}
    </nav>
  );
}
