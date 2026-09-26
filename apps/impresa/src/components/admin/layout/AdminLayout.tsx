"use client";
import { ReactNode } from "react";
import AdminSidebar from "./AdminSidebar";
import { AdminMenuBadge } from "./menuItems";

interface Props {
  title: string;
  subtitle?: string;
  children: ReactNode;
  badges?: AdminMenuBadge[];
  user?: { name?: string; email?: string } | null;
  actions?: ReactNode; // pulsanti a destra nell'header (Refresh, Nuovo, ecc.)
  fullWidth?: boolean; // true per pagine con layout custom (es. mia-email)
}

export default function AdminLayout({
  title,
  subtitle,
  children,
  badges,
  user,
  actions,
  fullWidth = false,
}: Props) {
  return (
    <div className="min-h-screen bg-[#f8fafc] flex">
      <AdminSidebar badges={badges} user={user} />
      <div className="flex-1 flex flex-col overflow-hidden">
        {!fullWidth && (
          <header className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between sticky top-0 z-10">
            <div>
              <h1 className="text-2xl font-bold text-[#1a2744]">{title}</h1>
              {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
            </div>
            <div className="flex items-center gap-4">
              {actions}
              {user && (
                <>
                  <div className="text-right hidden sm:block">
                    <div className="text-sm font-semibold text-[#1a2744]">
                      {user.name || "Admin"}
                    </div>
                    <div className="text-xs text-gray-500">{user.email || ""}</div>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-bold shadow-md">
                    A
                  </div>
                </>
              )}
            </div>
          </header>
        )}
        <div className={fullWidth ? "flex-1 overflow-hidden" : "flex-1 overflow-auto"}>
          {children}
        </div>
      </div>
    </div>
  );
}
