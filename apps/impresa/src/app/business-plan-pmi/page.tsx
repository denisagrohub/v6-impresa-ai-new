import { redirect } from "next/navigation";

// Ritirata (09/09/2026, valutazione richiesta da Denis): landing standalone
// vecchia con dati inventati (200+ startup, 50+ banche, testimonianze
// fittizie) e form mai collegato a Odoo (commento "Qui invieremo i dati
// a Odoo" mai realizzato) - contraddice il posizionamento reale
// (consulenza-con-call, mai output automatico) e il prezzo fisso non
// corrisponde a nessun prodotto/wizard reale nel backend. Redirect
// permanente invece di una cancellazione secca: chi ha un link vecchio
// salvato arriva comunque alla pagina di prodotto corretta, niente 404.
export default function BusinessPlanPmiRedirect() {
  redirect("/business-plan");
}
