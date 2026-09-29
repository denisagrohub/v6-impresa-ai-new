// ═══════════════════════════════════════════════════════════════════
// auth.ts — helper autenticazione lato client per le pagine deal.
// Estratto il 29/09/2026 (Refactor C, step C1.a) da:
//   app/admin/deals/[id]/page.tsx  (3 copie identiche inline)
// Motivo: eliminare duplicazione del blocco localStorage + token.
// Unica fonte di verita' per il recupero del JWT di sessione admin.
// ═══════════════════════════════════════════════════════════════════

/**
 * Legge il token JWT della sessione admin da localStorage.
 * Ritorna null se la sessione manca, e' corrotta o il parse fallisce.
 */
export function getAuthToken(): string | null {
  try {
    const raw = localStorage.getItem('pi_session');
    const session = raw ? JSON.parse(raw) : null;
    return session?.token || null;
  } catch {
    return null;
  }
}
