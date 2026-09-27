"use client";
import { usePathname } from "next/navigation";
import AdminSidebar from "@/components/admin/layout/AdminSidebar";

// 27/09/2026: layout admin globale. Un'unica fonte di verità per la
// sidebar. Tutte le pagine /admin/* la ereditano automaticamente.
//
// Esclusioni:
// - /admin/login: non deve avere sidebar
// - /admin/mia-email: ha layout 3 colonne custom (sidebar admin + caselle)
// - /admin/contracts: redirect, nessuna UI propria
// - /admin/firme, documenti, template, contratti, dashboard: hanno
//   AdminLayout interno (migrate prima del layout globale) — skip per
//   evitare doppia sidebar.
const SKIP_PREFIXES = [
  '/admin/login',
  '/admin/mia-email',
  '/admin/contracts',
  '/admin/firme',
  '/admin/documenti',
  '/admin/template',
  '/admin/contratti',
  '/admin/dashboard',
  '/admin/deals',
];

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const skip = SKIP_PREFIXES.some((p) => pathname === p || pathname?.startsWith(p + '/'));

  if (skip) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] flex">
      <AdminSidebar />
      <div className="flex-1 overflow-auto">
        {children}
      </div>
    </div>
  );
}
