'use client';
import { Paperclip, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { projectColor } from '@/lib/email-hub/colors';
import { formatDate, extractEmail, extractName, truncate } from '@/lib/email-hub/format';

export type Message = {
  id: number;
  subject: string;
  email_from: string;
  email_to: string;
  author_name: string;
  date: string | null;
  direction: string;
  message_type: string;
  has_attachments: boolean;
  attachment_count: number;
  model: string;
  res_id: number;
  project: { id: number; name: string; color: string } | null;
  log_id: number | null;
  log_model: string | null;
  thread_id: number;
  x_v6_project_id: number | null;
  x_v6_project: { id: number; name: string; partner_id: number | null } | null;
  x_v6_parte_id: number | null;
  x_v6_parte: { id: number; name: string; partner_id: number | null; partner_name: string | null } | null;
};

type Props = {
  message: Message;
  active: boolean;
  onClick: () => void;
};

export default function EmailHubListItem({ message, active, onClick }: Props) {
  const m = message;
  const pc = m.project ? projectColor(m.project.id) : null;
  const dirIn = m.direction !== 'out' && m.direction !== 'inviata';
  const sender = dirIn ? extractName(m.email_from) || extractEmail(m.email_from) : `→ ${extractEmail(m.email_to || '')}`;
  const initial = (sender || '?').slice(0, 1).toUpperCase();

  return (
    <button
      onClick={onClick}
      className={`w-full text-left bg-brand-card rounded-xl border p-3.5 transition-all duration-200 ${
        active
          ? 'border-brand-terracotta/40 shadow-hub-hover'
          : 'border-brand-border shadow-hub-card hover:shadow-hub-hover hover:-translate-y-[1px]'
      }`}
      style={{ borderLeft: pc ? `3px solid ${pc.color}` : undefined }}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-white text-xs font-bold"
          style={{ backgroundColor: pc ? pc.color : '#94a3b8' }}
        >
          {initial}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-0.5">
            <div className="text-sm font-semibold text-brand-navy truncate">
              {truncate(m.subject || '(nessun oggetto)', 70)}
            </div>
            <div className="text-[11px] text-brand-muted whitespace-nowrap shrink-0">
              {formatDate(m.date)}
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-brand-muted mb-1">
            {dirIn ? (
              <ArrowDownLeft size={12} className="text-blue-500" />
            ) : (
              <ArrowUpRight size={12} className="text-emerald-500" />
            )}
            <span className="truncate">{sender}</span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {m.project && pc && (
              <span
                className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                style={{ color: pc.color, backgroundColor: pc.bg, border: `1px solid ${pc.border}` }}
              >
                {pc.name || m.project.name}
              </span>
            )}
            {!m.project && (
              <span className="text-[10px] px-1.5 py-0.5 rounded font-medium text-brand-muted bg-brand-sand border border-brand-border">
                senza progetto
              </span>
            )}
            {m.has_attachments && (
              <span className="inline-flex items-center gap-0.5 text-[10px] text-brand-muted">
                <Paperclip size={10} /> {m.attachment_count}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}
