// ═══════════════════════════════════════════════════════════════════
// constants.ts — label e costanti UI dei deal.
// Estratto il 29/09/2026 (Refactor C, step C1.b.2).
//
// REGOLA: nessun valore "magico" sparso nei componenti. Se un
// valore e' business (soglie, giorni, fee, formati valuta) va qui
// e, quando serve, migrato in Odoo via /api/admin/settings/labels.
//
// TODO (backlog V6, non urgente): esporre queste mappe come campo
// editabile in erpv6.settings / ir.config_parameter, cosi' il
// sistema e' generalizzabile senza deploy.
// ═══════════════════════════════════════════════════════════════════

/** Label leggibile degli stati deal (allineato a deal.state Odoo). */
export const STATE_LABELS: Record<string, string> = {
  forecasting: 'Previsione',
  negotiating: 'In trattativa',
  frozen: 'Congelato',
  signing: 'In firma',
  active: 'Attivo',
  closed: 'Chiuso',
  cancelled: 'Annullato',
};

/** Label leggibile dei ruoli partecipante deal. */
export const ROLE_LABELS: Record<string, string> = {
  v6_entity: 'V6 entità',
  consultant: 'Consulente',
  referral: 'Referral',
  other: 'Altro',
};

/** Label + colore dei source delle variabili deal. */
export const SOURCE_LABELS: Record<string, { label: string; color: string }> = {
  manual:   { label: 'manuale',    color: 'bg-gray-100 text-gray-600' },
  contract: { label: 'contratto',  color: 'bg-blue-100 text-blue-700' },
  catcher:  { label: 'progetto',   color: 'bg-purple-100 text-purple-700' },
  formula:  { label: 'formula',    color: 'bg-cyan-100 text-cyan-700' },
  actual:   { label: 'consuntivo', color: 'bg-green-100 text-green-700' },
};

/** Ruolo speciale: quota mostrata come 'fisso' e non come % (backend). */
export const REFERRAL_ROLE = 'referral';

/** Locale + valuta dei formati UI. Migrabile in settings. */
export const LOCALE = 'it-IT';
export const CURRENCY = 'EUR';
export const CURRENCY_DIGITS = 0;
