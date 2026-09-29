// ═══════════════════════════════════════════════════════════════════
// format.ts — utility di formattazione per i pannelli deal.
// Estratto il 29/09/2026 (Refactor C, step C1.b).
// Unica fonte di verita' per fmt EUR e label ruolo.
// ═══════════════════════════════════════════════════════════════════

/** Formatta un numero come valuta EUR senza decimali (stile IT). */
import { LOCALE, CURRENCY, CURRENCY_DIGITS, ROLE_LABELS } from './constants';

/** Formatta un numero come valuta (config in ./constants). */
export const fmtEur = (n: number): string =>
  new Intl.NumberFormat(LOCALE, {
    style: 'currency',
    currency: CURRENCY,
    maximumFractionDigits: CURRENCY_DIGITS,
  }).format(n);

/** Rialias per compatibilita' coi consumer esistenti. */
export const roleLabel = ROLE_LABELS;
