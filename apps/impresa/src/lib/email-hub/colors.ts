// ═══════════════════════════════════════════════════════════════════
// 13/10/2026 (C-email-hub-2): palette colori progetti + fallback hash.
// ═══════════════════════════════════════════════════════════════════

export type ProjectColor = {
  name: string;
  color: string;
  bg: string;
  border: string;
};

export const PROJECT_COLORS: Record<number, ProjectColor> = {
  89: { name: 'Acquisizione certificati', color: '#3B82F6', bg: '#EFF6FF', border: '#BFDBFE' },
  88: { name: 'Certificati intermediazione', color: '#F97316', bg: '#FFF7ED', border: '#FED7AA' },
  5:  { name: 'Progetto TEE', color: '#10B981', bg: '#ECFDF5', border: '#A7F3D0' },
  38: { name: 'Deal alpha-omega', color: '#8B5CF6', bg: '#F5F3FF', border: '#DDD6FE' },
  26: { name: 'GO certificati', color: '#92400E', bg: '#FEF3C7', border: '#FDE68A' },
  6:  { name: 'TEE cliente', color: '#06B6D4', bg: '#ECFEFF', border: '#A5F3FC' },
  10: { name: 'TEE trader', color: '#EC4899', bg: '#FDF2F8', border: '#FBCFE8' },
  15: { name: 'TEE referral', color: '#F59E0B', bg: '#FFFBEB', border: '#FDE68A' },
  19: { name: 'Fotovoltaico', color: '#84CC16', bg: '#F7FEE7', border: '#D9F99D' },
  21: { name: 'AV illuminazione', color: '#A855F7', bg: '#FAF5FF', border: '#E9D5FF' },
  90: { name: 'Enzo Furlanetto', color: '#14B8A6', bg: '#F0FDFA', border: '#99F6E4' },
};

const FALLBACK = ['#3B82F6', '#F97316', '#10B981', '#8B5CF6', '#EC4899', '#06B6D4'];

export function projectColor(id: number | null | undefined): ProjectColor {
  if (!id) {
    return { name: 'Nessun progetto', color: '#94a3b8', bg: '#f8fafc', border: '#e2e8f0' };
  }
  if (PROJECT_COLORS[id]) return PROJECT_COLORS[id];
  const c = FALLBACK[id % FALLBACK.length];
  return { name: `Progetto #${id}`, color: c, bg: '#f8fafc', border: '#e2e8f0' };
}

// ─── State palette (badge) ──────────────────────────────────────────
export type EmailState = 'unread' | 'replied' | 'overdue' | 'muted';

export const STATE_STYLES: Record<EmailState, { label: string; color: string; bg: string; border: string }> = {
  unread:  { label: 'Non letta', color: '#3b82f6', bg: '#eff6ff', border: '#bfdbfe' },
  replied: { label: 'Risposta',  color: '#10b981', bg: '#ecfdf5', border: '#a7f3d0' },
  overdue: { label: 'In ritardo',color: '#ef4444', bg: '#fef2f2', border: '#fecaca' },
  muted:   { label: 'Silenziata',color: '#94a3b8', bg: '#f1f5f9', border: '#cbd5e1' },
};
