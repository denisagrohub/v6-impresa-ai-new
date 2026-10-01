'use client';

// ═══════════════════════════════════════════════════════════════════
// ActivityFeed — sezione "Attività recente" per dashboard admin.
//
// Consuma recentActivity[] da /api/admin/dashboard-overview.
// Raggruppa per periodo (oggi/ieri/settimana/più vecchie).
// Riusa formatRelative da @/lib/utils/format.
// ═══════════════════════════════════════════════════════════════════

import Link from 'next/link';
import { Activity, Mail, FileSignature, UserPlus, Circle } from 'lucide-react';
import { formatRelative } from '@/lib/utils/format';

type ActivityItem = {
  type: string;
  icon: string;
  title: string;
  href: string | null;
  timestamp: string;
};

type Props = {
  activity: ActivityItem[];
  maxVisible?: number;
};

const ICON_MAP: Record<string, any> = {
  deal_event: Activity,
  email: Mail,
  sign: FileSignature,
  candidacy: UserPlus,
};

function groupLabel(timestamp: string): string {
  const d = new Date(timestamp.replace(' ', 'T') + (timestamp.includes('Z') || timestamp.includes('+') ? '' : 'Z'));
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 24 * 3600 * 1000;
  const weekAgo = todayStart - 7 * 24 * 3600 * 1000;
  const t = d.getTime();

  if (t >= todayStart) return 'Oggi';
  if (t >= yesterdayStart) return 'Ieri';
  if (t >= weekAgo) return 'Questa settimana';
  return 'Più vecchie';
}

export default function ActivityFeed({ activity, maxVisible = 10 }: Props) {
  if (!activity || activity.length === 0) {
    return (
      <section className="mb-8">
        <h2 className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-3">
          Attività recente
        </h2>
        <div className="px-4 py-3 rounded-xl border border-gray-100 bg-white text-sm text-gray-500">
          Nessuna attività recente.
        </div>
      </section>
    );
  }

  // Applico il cap
  const visible = activity.slice(0, maxVisible);

  // Raggruppo per etichetta mantenendo l'ordine
  const groups: { label: string; items: ActivityItem[] }[] = [];
  for (const item of visible) {
    const label = groupLabel(item.timestamp);
    let g = groups.find((x) => x.label === label);
    if (!g) {
      g = { label, items: [] };
      groups.push(g);
    }
    g.items.push(item);
  }

  return (
    <section className="mb-8">
      <h2 className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-3">
        Attività recente
      </h2>

      <div className="rounded-xl border border-gray-100 bg-white divide-y divide-gray-50">
        {groups.map((group) => (
          <div key={group.label}>
            <div className="px-4 py-2 text-[10px] uppercase tracking-wide text-gray-400 font-semibold bg-gray-50/40">
              {group.label}
            </div>
            <div className="divide-y divide-gray-50">
              {group.items.map((item, idx) => {
                const Icon = ICON_MAP[item.type] || Circle;
                const isClickable = !!item.href;

                const inner = (
                  <>
                    <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                      {item.icon && item.icon.length <= 4 ? (
                        <span className="text-[14px]">{item.icon}</span>
                      ) : (
                        <Icon size={14} className="text-gray-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 text-xs font-medium text-[#0F1E3C] truncate" title={item.title}>
                      {item.title}
                    </div>
                    <span className="text-[10px] text-gray-400 tabular-nums shrink-0">
                      {formatRelative(item.timestamp)}
                    </span>
                  </>
                );

                return isClickable ? (
                  <Link
                    key={`${item.type}-${idx}`}
                    href={item.href!}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors"
                  >
                    {inner}
                  </Link>
                ) : (
                  <div
                    key={`${item.type}-${idx}`}
                    className="flex items-center gap-3 px-4 py-2.5"
                  >
                    {inner}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {activity.length > maxVisible && (
        <div className="mt-2 text-[11px] text-gray-500">
          Mostrate {maxVisible} di {activity.length} attività.
        </div>
      )}
    </section>
  );
}
