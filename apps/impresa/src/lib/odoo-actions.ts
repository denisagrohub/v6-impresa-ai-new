// 05/10/2026 (C-attribution-1d): helper per aprire un'action Odoo
// (soprattutto wizard target=new) da UI Next in una nuova tab.
//
// Odoo 17+ supporta il router /odoo/action-<xmlid>?context=... che
// apre direttamente l'action richiesta. Uso quello (piu' pulito del
// vecchio #action=<id>).

const ODOO_URL =
  process.env.NEXT_PUBLIC_ODOO_URL || 'https://erp.v6sviluppoimpresa.it';

export function openOdooAction(
  actionXmlid: string,
  context: Record<string, unknown> = {},
): void {
  const base = ODOO_URL.replace(/\/$/, '');
  const ctx = encodeURIComponent(JSON.stringify(context));
  const url = `${base}/odoo/action-${actionXmlid}?context=${ctx}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}
