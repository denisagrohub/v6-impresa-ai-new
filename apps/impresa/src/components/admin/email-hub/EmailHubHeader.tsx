'use client';
// ═══════════════════════════════════════════════════════════════════
// 13/10/2026 (C-email-hub-2): header Email Hub.
// ═══════════════════════════════════════════════════════════════════
import { RefreshCw, Search, SlidersHorizontal } from 'lucide-react';

type Props = {
  onRefresh?: () => void;
  search: string;
  onSearchChange: (v: string) => void;
  totalLabel?: string;
};

export default function EmailHubHeader({ onRefresh, search, onSearchChange, totalLabel }: Props) {
  return (
    <header className="h-16 px-6 flex items-center justify-between gap-4 border-b border-brand-border bg-brand-card shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <h1 className="text-lg font-bold text-brand-navy truncate">Email Hub</h1>
        {totalLabel && (
          <span className="text-xs px-2 py-0.5 rounded-md bg-brand-sand text-brand-muted font-medium">
            {totalLabel}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 flex-1 max-w-md">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Cerca oggetto, mittente, destinatario…"
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-brand-border bg-brand-sand focus:outline-none focus:ring-2 focus:ring-brand-terracotta/20 focus:border-brand-terracotta transition-colors"
          />
        </div>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={onRefresh}
          className="p-2 rounded-lg hover:bg-brand-sand transition-colors"
          title="Aggiorna"
        >
          <RefreshCw size={16} className="text-brand-muted" />
        </button>
        <button
          className="p-2 rounded-lg hover:bg-brand-sand transition-colors"
          title="Filtri"
        >
          <SlidersHorizontal size={16} className="text-brand-muted" />
        </button>
      </div>
    </header>
  );
}
