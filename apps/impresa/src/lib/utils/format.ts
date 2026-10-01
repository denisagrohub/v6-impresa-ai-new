// ═══════════════════════════════════════════════════════════════════
// lib/utils/format.ts — utility formattazione condivise
//
// 01/10/2026 (Fase A - A3): estratto da ActionToday.tsx per riuso
// tra componenti dashboard (ActionToday, ActivityFeed).
// ═══════════════════════════════════════════════════════════════════

/**
 * Formatta un timestamp ISO/DB in stringa relativa "2 gg fa".
 * Gestisce sia ISO 8601 che formato Odoo "YYYY-MM-DD HH:MM:SS".
 */
export function formatRelative(iso: string | null): string {
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

/**
 * Formatta un timestamp in millisecondi come stringa freshness:
 * "aggiornato ora" / "aggiornato N min fa" / "aggiornato N h fa".
 * null → "—".
 * 01/10/2026 (Fase A - A4): usato dall'indicatore accanto a "Aggiorna".
 */
export function formatFreshness(ts: number | null): string {
  if (ts == null) return '—';
  const diffMs = Date.now() - ts;
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'aggiornato ora';
  if (min < 60) return `aggiornato ${min} min fa`;
  const h = Math.floor(min / 60);
  if (h < 24) return `aggiornato ${h} h fa`;
  const gg = Math.floor(h / 24);
  return `aggiornato ${gg} gg fa`;
}

/** true se il timestamp è "vecchio" (> 5 min). */
export function isFreshnessStale(ts: number | null): boolean {
  if (ts == null) return false;
  return Date.now() - ts > 5 * 60 * 1000;
}
