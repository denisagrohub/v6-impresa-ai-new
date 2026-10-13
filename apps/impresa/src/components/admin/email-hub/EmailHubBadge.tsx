'use client';
import { EmailState, STATE_STYLES } from '@/lib/email-hub/colors';

type Props = {
  variant?: 'state' | 'soft' | 'count';
  state?: EmailState;
  label: string;
  color?: string;
  bg?: string;
  border?: string;
  size?: 'xs' | 'sm';
};

export default function EmailHubBadge({
  variant = 'soft', state, label, color, bg, border, size = 'xs',
}: Props) {
  let c = color, b = bg, bd = border;
  if (variant === 'state' && state) {
    const s = STATE_STYLES[state];
    c = s.color; b = s.bg; bd = s.border;
  }
  const cls = size === 'sm'
    ? 'text-xs px-2.5 py-1'
    : 'text-[11px] px-2 py-0.5';
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md font-medium whitespace-nowrap ${cls}`}
      style={{
        color: c || '#64748b',
        backgroundColor: b || '#f1f5f9',
        border: `1px solid ${bd || '#e2e8f0'}`,
      }}
    >
      {label}
    </span>
  );
}
