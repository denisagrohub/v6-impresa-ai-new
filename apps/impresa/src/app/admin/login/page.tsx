"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

// 10/09/2026: pagina di login finta e ormai orfana (credenziali
// hardcoded "admin"/"admin", mai collegata a Odoo - risalente a prima
// della migrazione al login reale del 25/08/2026). Era ancora il target
// di redirect di 12 pagine admin che controllavano una chiave di sessione
// sbagliata ("odoo_session", mai scritta dal login vero) - corrette per
// puntare tutte a /login (login reale, unificato). Questa pagina resta
// solo come redirect: dopo il fix di sicurezza di oggi sul middleware,
// /admin/* richiede gia' una sessione admin verificata per essere
// raggiunta, quindi chi arriva qui e' gia' autenticato.
export default function AdminLoginRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/admin/dashboard");
  }, [router]);
  return null;
}
