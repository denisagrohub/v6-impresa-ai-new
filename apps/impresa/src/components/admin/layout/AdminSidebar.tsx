"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { ADMIN_MENU_ITEMS, AdminMenuBadge } from "./menuItems";

interface Props {
  badges?: AdminMenuBadge[];
  onLogout?: () => void;
  user?: { name?: string; email?: string; token?: string } | null;
}

export default function AdminSidebar({ badges = [], onLogout, user: userProp }: Props) {
  const pathname = usePathname();
  const [user, setUser] = useState<any>(userProp || null);
  const [badges2, setBadges2] = useState<AdminMenuBadge[]>(badges);

  // 27/09/2026: autonomia — se non passato dall'esterno, leggi user da
  // localStorage + fetcha badge dinamici (unread email) da solo.
  useEffect(() => {
    if (!userProp) {
      try {
        const s = localStorage.getItem("pi_session");
        if (s) setUser(JSON.parse(s));
      } catch {}
    }
  }, [userProp]);

  // 27/09/2026: fetch autonomo dei 2 badge SEMPRE (firme + email),
  // indipendentemente da quale pagina sono. Aggiorna ogni 60s.
  useEffect(() => {
    const u = userProp || user;
    if (!u?.token) return;

    const fetchBadges = () => {
      Promise.all([
        fetch('/api/admin/sign-requests?limit=1', {
          headers: { Authorization: `JWT ${u.token}` },
        }).then(r => r.json()).catch(() => null),
        fetch('/api/admin/emails/mailboxes', {
          headers: { Authorization: `JWT ${u.token}` },
        }).then(r => r.json()).catch(() => null),
      ]).then(([srRes, emRes]) => {
        const list: AdminMenuBadge[] = [];

        // Firme: sent + viewed
        const srP = srRes?.data || srRes;
        if (srP?.success && srP?.counts) {
          const firmeCount = (srP.counts.sent || 0) + (srP.counts.viewed || 0);
          if (firmeCount > 0) {
            list.push({ href: '/admin/firme', count: firmeCount, color: 'bg-amber-500' });
          }
        }

        // Email: totalUnread
        const emP = emRes?.data || emRes;
        if (emP?.success && emP.totalUnread > 0) {
          list.push({ href: '/admin/mia-email', count: emP.totalUnread, color: 'bg-red-500' });
        }

        setBadges2(list);
      });
    };

    fetchBadges();
    const interval = setInterval(fetchBadges, 60000);
    return () => clearInterval(interval);
  }, [user, userProp]);

  const handleLogout = () => {
    if (onLogout) return onLogout();
    localStorage.removeItem("pi_session");
    document.cookie = "pi_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    document.cookie = "token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    window.location.href = "/login";
  };

  const getBadge = (href: string) => {
    const b = badges2.find((x) => x.href === href);
    return b && b.count > 0 ? b : null;
  };

  return (
    <aside className="w-56 bg-white border-r border-gray-200 flex flex-col flex-shrink-0 sticky top-0 h-screen">
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#1a2744] to-[#0f3460] flex items-center justify-center text-white font-bold text-xs">
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
          const isActive = pathname === item.href || (item.href !== '/admin/dashboard' && pathname?.startsWith(item.href));
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
