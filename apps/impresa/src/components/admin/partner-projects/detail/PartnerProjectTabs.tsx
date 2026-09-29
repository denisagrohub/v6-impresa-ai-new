// ═══════════════════════════════════════════════════════════════════
// PartnerProjectTabs — barra tab della dashboard partner-projects/[id].
// Estratto il 29/09/2026 (Refactor C, step C3).
//
// Due tab:
//   - Copertina: cruscotto KPI + kanban target + parti (CopertinaPage)
//   - Operativa: workbench + sidebar + pipeline deal (vista custom)
//
// Il tab e' controllato dal parent (value/onChange). Visuale puro.
// ═══════════════════════════════════════════════════════════════════

'use client';

import { LayoutDashboard, Workflow } from 'lucide-react';

export type PartnerProjectTab = 'copertina' | 'operativa';

type Props = {
  value: PartnerProjectTab;
  onChange: (v: PartnerProjectTab) => void;
};

const TABS: { key: PartnerProjectTab; label: string; Icon: typeof LayoutDashboard }[] = [
  { key: 'copertina', label: 'Copertina',  Icon: LayoutDashboard },
  { key: 'operativa', label: 'Operativa',  Icon: Workflow },
];

export function PartnerProjectTabs({ value, onChange }: Props) {
  return (
    <div className="bg-white border-b border-[#e2e8f0] px-5 flex items-center gap-1 shrink-0">
      {TABS.map(({ key, label, Icon }) => {
        const active = value === key;
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            className={`flex items-center gap-1.5 px-4 py-2 text-[12px] font-semibold border-b-2 transition-colors cursor-pointer ${
              active
                ? 'border-[#1a7fa8] text-[#1a7fa8]'
                : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300'
            }`}
          >
            <Icon size={13} />
            {label}
          </button>
        );
      })}
    </div>
  );
}
