'use client';

// ═══════════════════════════════════════════════════════════════════
// ActionToday — sezione "Azioni di oggi" per dashboard admin.
//
// Consuma nextActions[] da /api/admin/dashboard-overview.
// Ogni blocco (type) è collassato di default e mostra fino a 5 record
// azionabili quando espanso.
//
// Design: tokens-impresa.md. No terracotta (riservato CTA/linea-metodo).
// No lib date nuova: formatRelative custom.
// ═══════════════════════════════════════════════════════════════════

import { useState } from 'react';
import Link from 'next/link';
import {
  FileSignature, Mail, Euro, TrendingDown, Send, UserPlus,
  AlertCircle, ChevronRight, ArrowRight,
} from 'lucide-react';

type ActionRecord = {
  id: number | string;
  title: string;
  subtitle: string;
  timestamp: string | null;
  href: string | null;
};

type ActionBlock = {
  type: string;
  label: string;
  count: number;
  href: string;
  records: ActionRecord[];
};

type Props = {
  nextActions: ActionBlock[];
  onRefresh?: () => void;
};

const ICON_MAP: Record<string, any> = {
  sign_pending: FileSignature,
  email_unread: Mail,
  payment_due: Euro,
  deal_stale: TrendingDown,
  access_request: Send,
  candidacy_new: UserPlus,
};

function formatRelative(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso.replace(' ', 'T') + (iso.includes('Z') || iso.includes('+') ? '' : 'Z'));
  const now = Date.now();
  const diffMs = now - d.getTime();
  const min = Math.floor(diffMs / 60000);

  if (min < 1) return 'adesso';
  if (min < 60) return `${min} min fa`;
  const ore = Math.floor(min / 60);
  if (ore < 24) return `${ore} h fa`;
  const gg = Math.floor(ore / 24);
  if (gg < 7) return `${gg} gg fa`;
  if (gg < 30) return `${Math.floor(gg / 7)} sett fa`;
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
}

export default function ActionToday({ nextActions, onRefresh }: Props) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [showAll, setShowAll] = useState(false);

  const toggle = (type: string) => {
    setExpanded((prev) => ({ ...prev, [type]: !prev[type] }));
  };

  if (!nextActions || nextActions.length === 0) {
    return (
      <section className="mb-8">
        <h2 className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-3">
          Azioni di oggi
        </h2>
        <div className="px-4 py-3 rounded-xl border border-gray-100 bg-white text-sm text-gray-500">
          Nessuna azione in sospeso.
        </div>
      </section>
    );
  }

  const visible = showAll ? nextActions : nextActions.slice(0, 3);
  const hidden = nextActions.length - 3;

  return (
    <section className="mb-8">
      <h2 className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-3">
        Azioni di oggi
      </h2>

      <div className="space-y-2">
        {visible.map((block) => {
          const Icon = ICON_MAP[block.type] || AlertCircle;
          const isOpen = !!expanded[block.type];

          return (
            <div
              key={block.type}
              className="rounded-xl border border-gray-100 bg-white overflow-hidden"
            >
              <button
                onClick={() => toggle(block.type)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
              >
                <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                  <Icon size={15} className="text-gray-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-[#0F1E3C]">
                    {block.label}
                  </div>
                  {block.records.length > 0 && (
                    <div className="text-[11px] text-gray-500 mt-0.5">
                      {block.records.length} di {block.count} visibili
                    </div>
                  )}
                </div>
                <span className="text-[11px] text-gray-400 tabular-nums shrink-0">
                  {block.count}
                </span>
                <ChevronRight
                  size={14}
                  className={`text-gray-400 transition-transform shrink-0 ${isOpen ? 'rotate-90' : ''}`}
                />
              </button>

              {isOpen && (
                <div className="border-t border-gray-100">
                  {block.records.length === 0 ? (
                    <div className="px-4 py-3 text-xs text-gray-500 italic">
                      Nessun record singolo da mostrare — apri la lista completa.
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-50">
                      {block.records.map((r) => (
                        <div key={`${block.type}-${r.id}`} className="px-4 py-2.5 flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium text-[#0F1E3C] truncate" title={r.title}>
                              {r.title}
                            </div>
                            <div className="text-[11px] text-gray-500 truncate mt-0.5" title={r.subtitle}>
                              {r.subtitle}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            {r.timestamp && (
                              <span className="text-[10px] text-gray-400 tabular-nums">
                                {formatRelative(r.timestamp)}
                              </span>
                            )}
                            {r.href && (
                              <Link
                                href={r.href}
                                className="text-[10px] px-2 py-1 rounded border border-gray-200 text-[#0F1E3C] hover:bg-gray-50 whitespace-nowrap"
                              >
                                Apri →
                              </Link>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="px-4 py-2 bg-gray-50/60 border-t border-gray-100">
                    <Link
                      href={block.href}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-[#0F1E3C] hover:underline"
                    >
                      Vedi tutti <ArrowRight size={11} />
                    </Link>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {hidden > 0 && !showAll && (
        <button
          onClick={() => setShowAll(true)}
          className="mt-2 text-[11px] text-gray-500 hover:text-[#0F1E3C] hover:underline"
        >
          + altre {hidden} {hidden === 1 ? 'azione' : 'azioni'}
        </button>
      )}
    </section>
  );
}
