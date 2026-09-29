// ═══════════════════════════════════════════════════════════════════
// format.ts — utility di formattazione per i pannelli deal.
// Estratto il 29/09/2026 (Refactor C, step C1.b).
// Unica fonte di verita' per fmt EUR e label ruolo.
// ═══════════════════════════════════════════════════════════════════

/** Formatta un numero come valuta EUR senza decimali (stile IT). */
export const fmtEur = (n: number): string =>
  new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(n);

/** Label leggibile dei ruoli partecipante deal. */
export const roleLabel: Record<string, string> = {
  v6_entity: 'V6 entità',
  consultant: 'Consulente',
  referral: 'Referral',
  other: 'Altro',
};
