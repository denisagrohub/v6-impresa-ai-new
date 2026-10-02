// ═══════════════════════════════════════════════════════════════════
// PartnerProjectStatusBar — barra di stato sotto l'header.
// Mostra: stato attivo + KPI (parti/email/atti) + toggle Workbench/
// Lavagna + bottone "torna copertina" (solo se pipeline target).
// Estratto il 29/09/2026 (Refactor C, step C1.d).
// ═══════════════════════════════════════════════════════════════════

'use client';

import { Table, LayoutGrid } from 'lucide-react';

export type ViewMode = 'workbench' | 'lavagna';

type Props = {
  partnersCount: number;
  emailsCount: number;
  // 02/10/2026 (C2-rd-prog): conteggio email non lette per-utente
  unreadCount?: number;
  documentsCount: number;
  isKanbanBoard: boolean;
  viewMode: ViewMode;
  onBackToCover: () => void;
  onChangeViewMode: (mode: ViewMode) => void;
};

export function PartnerProjectStatusBar({
  partnersCount, emailsCount, unreadCount = 0, documentsCount,
  isKanbanBoard, viewMode, onBackToCover, onChangeViewMode,
}: Props) {
  const toggleBase = 'flex items-center gap-1.5 px-3 py-1 rounded cursor-pointer transition-all';
  const activeCls = 'bg-white text-[#0f172a] shadow-sm font-semibold';
  const idleCls = 'text-gray-500 hover:text-gray-900';

  return (
    <div className="flex items-center justify-between text-[11.5px] border-t border-[#f1f5f9] pt-2">
      <div className="flex items-center gap-4 text-gray-500 font-medium">
        <span className="flex items-center gap-1 text-emerald-600 font-semibold">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Attivo
        </span>
        <span className="flex items-center gap-1">👥 {partnersCount} parti</span>
        <span className={`flex items-center gap-1 ${unreadCount > 0 ? 'text-amber-600 font-semibold' : ''}`}>
          ✉ {emailsCount} email{unreadCount > 0 && ` · ${unreadCount} da leggere`}
        </span>
        <span className="flex items-center gap-1">📎 {documentsCount} atti</span>
      </div>

      {/* 19/09/2026: torna alla Copertina */}
      {isKanbanBoard && (
        <button
          onClick={onBackToCover}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 text-[11px] font-semibold border border-indigo-100 hover:bg-indigo-100 cursor-pointer transition-colors"
          title="Torna alla copertina"
        >
          ← Copertina
        </button>
      )}

      {/* Toggle vista: Workbench (operativo) / Lavagna (strategica) */}
      <div className="flex bg-[#f1f5f9] p-0.5 rounded text-[11px] font-medium">
        <button
          onClick={() => onChangeViewMode('workbench')}
          className={`${toggleBase} ${viewMode === 'workbench' ? activeCls : idleCls}`}
        >
          <Table size={12} />
          <span>WORKBENCH</span>
        </button>
        <button
          onClick={() => onChangeViewMode('lavagna')}
          className={`${toggleBase} ${viewMode === 'lavagna' ? activeCls : idleCls}`}
        >
          <LayoutGrid size={12} />
          <span>LAVAGNA STRATEGICA</span>
        </button>
      </div>
    </div>
  );
}
