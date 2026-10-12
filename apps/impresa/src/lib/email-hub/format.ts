// ═══════════════════════════════════════════════════════════════════
// 13/10/2026 (C-email-hub-2): helper formattazione email hub.
// ═══════════════════════════════════════════════════════════════════

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'ora';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}g`;
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
}

export function formatDateFull(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('it-IT', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function truncate(s: string | null | undefined, max = 60): string {
  if (!s) return '';
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

export function formatSize(bytes: number | null | undefined): string {
  if (!bytes || bytes < 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function extractEmail(s: string | null | undefined): string {
  if (!s) return '';
  const m = s.match(/<([^>]+)>/);
  return m ? m[1] : s.trim();
}

export function extractName(s: string | null | undefined): string {
  if (!s) return '';
  const m = s.match(/^([^<]+)</);
  return m ? m[1].trim().replace(/^"|"$/g, '') : extractEmail(s);
}

export function initials(name: string | null | undefined): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
