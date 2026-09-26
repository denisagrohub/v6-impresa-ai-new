import { redirect } from 'next/navigation';

// 26/09/2026: unificazione pagine "contratti".
// Il vecchio /admin/contracts (placeholder storico) è stato sostituito
// da /admin/contratti (composer documenti + firme, in sidebar).
// Redirect automatico per non rompere link esistenti.
export default function LegacyContractsRedirect() {
    redirect('/admin/contratti');
}
