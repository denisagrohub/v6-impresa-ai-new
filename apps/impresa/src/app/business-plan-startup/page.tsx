import { redirect } from "next/navigation";

// Ritirata (09/09/2026, valutazione richiesta da Denis): stesso motivo di
// business-plan-pmi/page.tsx - dati inventati (200+ startup, garanzia
// rimborso, testimonianze fittizie), form mai collegato a Odoo, prezzo
// fisso (€1.500, "offerta lancio primi 50 clienti") senza corrispondenza
// reale nel backend. Redirect permanente, non una cancellazione secca.
export default function BusinessPlanStartupRedirect() {
  redirect("/business-plan");
}
