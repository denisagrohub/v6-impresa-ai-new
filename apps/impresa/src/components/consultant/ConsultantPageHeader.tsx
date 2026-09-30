// ═══════════════════════════════════════════════════════════════════
// ConsultantPageHeader — header sticky per pagine standalone consultant.
//
// Usato in: /consultant/mia-email, /consultant/playbook, futuri.
// Fornisce:
// - Bottone "← Dashboard" per tornare all'area consulente
// - Titolo + sottotitolo (nome utente + slug o email)
// - Slot opzionale per elementi a destra (badge, azioni)
//
// Motivo: le pagine standalone (no sidebar dashboard) perdono il
// contesto di navigazione. Questo header dà un'ancora chiara.
// Lean: 1 componente, N consumer. Zero duplicazione.
// ═══════════════════════════════════════════════════════════════════

'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';

type Props = {
  title: string;
  subtitle?: ReactNode;
  rightSlot?: ReactNode;
};

export function ConsultantPageHeader({ title, subtitle, rightSlot }: Props) {
  return (
    <header className="sticky top-0 z-30 bg-white border-b border-gray-200 px-5 py-3 flex items-center gap-3 shadow-sm">
      <Link
        href="/consultant/dashboard"
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-all"
      >
        <ArrowLeft size={16} /> Dashboard
      </Link>
      <div className="flex-1 min-w-0">
        <h1 className="text-base font-bold text-[#1a2744] truncate">{title}</h1>
        {subtitle && <div className="text-[11px] text-gray-500 truncate">{subtitle}</div>}
      </div>
      {rightSlot}
    </header>
  );
}
