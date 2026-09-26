"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { ADMIN_MENU_ITEMS, AdminMenuBadge } from "./menuItems";

interface Props {
  badges?: AdminMenuBadge[];
  onLogout?: () => void;
  user?: { name?: string; email?: string } | null;
}

export default function AdminSidebar({ badges = [], onLogout, user }: Props) {
  const pathname = usePathname();

  const handleLogout = () => {
    if (onLogout) return onLogout();
    // Default: pulizia + redirect
    localStorage.removeItem("pi_session");
    document.cookie = "pi_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    document.cookie = "token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    window.location.href = "/login";
  };

  const getBadge = (href: string) => {
    const b = badges.find((x) => x.href === href);
    return b && b.count > 0 ? b : null;
  };

  return (
    <aside className="w-56 bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#1a2744] to-[#0f3460] flex items-center justify-center text-white font-bold">
            PI
          </div>
          <div>
            <div className="font-bold text-[#1a2744] text-sm">V6 Impresa AI</div>
            <div className="text-xs text-gray-500">Admin Panel</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {ADMIN_MENU_ITEMS.map((item, i) => {
          const isActive = pathname === item.href;
          const badge = getBadge(item.href);
          return (
            <Link
              key={i}
              href={item.href}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? "bg-[#1a2744] text-white shadow-lg shadow-blue-900/20"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <item.icon size={14} /> {item.label}
              {badge && (
                <span
                  className={`ml-auto min-w-[18px] h-4 px-1 rounded-full text-white text-[10px] font-bold flex items-center justify-center ${
                    badge.color || "bg-red-500"
                  }`}
                >
                  {badge.count}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-gray-100">
        {user && (
          <div className="px-3 py-2 mb-2 text-xs text-gray-500 truncate">
            <div className="font-medium text-[#1a2744]">{user.name || "Admin"}</div>
            <div className="truncate">{user.email || ""}</div>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-gray-600 hover:bg-red-50 hover:text-red-600 w-full"
        >
          <LogOut size={14} /> Esci
        </button>
      </div>
    </aside>
  );
}
