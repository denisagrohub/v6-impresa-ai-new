"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Menu, X, User, LogOut, ArrowRight } from "lucide-react";

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [session, setSession] = useState<any>(null);

  const pathname = usePathname();


  useEffect(() => {
    const saved = localStorage.getItem("pi_session");
    setSession(saved ? JSON.parse(saved) : null);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("pi_session");
    document.cookie = "pi_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    window.location.href = "/login";
  };

  return (
    <nav className="sticky top-0 z-50 bg-white shadow-md border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#1a2744] flex items-center justify-center text-white font-bold text-sm">PI</div>
            <span className="font-bold text-lg text-[#1a2744]">Progetto Impresa</span>
          </Link>

          <div className="hidden md:flex items-center gap-6">
            <Link href="/" className="text-sm font-medium text-gray-700 hover:text-gray-900">Home</Link>
            <Link href="/chi-siamo" className="text-sm font-medium text-gray-700 hover:text-gray-900">Chi Siamo</Link>
            <Link href="/metodo" className="text-sm font-medium text-gray-700 hover:text-gray-900">Il Metodo</Link>
            <Link href="/premium" className="text-sm font-medium text-orange-600 hover:text-orange-700 font-semibold">💎 Pacchetti</Link>
<Link href="/brand" className="text-sm font-medium text-gray-700 hover:text-gray-900">🎨 Brand</Link>
            <Link href="/contatti" className="text-sm font-medium text-gray-700 hover:text-gray-900">Contatti</Link>

            {session ? (
              <div className="flex items-center gap-3 ml-4 pl-4 border-l border-gray-200">
                <Link href={session.role === 'admin' ? "/admin/dashboard" : session.role === 'consultant' ? "/consultant/dashboard" : "/dashboard"} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1a2744] text-white hover:bg-[#0f3460] text-sm font-medium">
                  <User size={16} />
                  Dashboard
                </Link>
                <button onClick={handleLogout} className="p-2 rounded-lg hover:bg-red-50 text-gray-500 hover:text-red-600">
                  <LogOut size={18} />
                </button>
              </div>
            ) : (
              <Link href="/login" className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#1a2744] text-white font-semibold text-sm hover:bg-[#0f3460] transition-all">
                Accedi <ArrowRight size={16} />
              </Link>
            )}
          </div>

          <button onClick={() => setIsOpen(!isOpen)} className="md:hidden p-2 text-gray-600">
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {isOpen && (
          <div className="md:hidden py-4 space-y-2 border-t border-gray-100">
            <Link href="/" className="block px-4 py-2 rounded-lg hover:bg-gray-100">Home</Link>
            <Link href="/chi-siamo" className="block px-4 py-2 rounded-lg hover:bg-gray-100">Chi Siamo</Link>
            <Link href="/metodo" className="block px-4 py-2 rounded-lg hover:bg-gray-100">Il Metodo</Link>
            <Link href="/premium" className="block px-4 py-2 rounded-lg hover:bg-orange-50 text-orange-600 font-semibold">💎 Pacchetti</Link>
<Link href="/brand" className="text-sm font-medium text-gray-700 hover:text-gray-900">🎨 Brand</Link>
            <Link href="/contatti" className="block px-4 py-2 rounded-lg hover:bg-gray-100">Contatti</Link>
            {session ? (
              <>
                <Link href={session.role === 'admin' ? "/admin/dashboard" : "/dashboard"} className="block px-4 py-2 rounded-lg bg-[#1a2744] text-white text-center font-bold">Dashboard</Link>
                <button onClick={handleLogout} className="block w-full text-center px-4 py-2 rounded-lg text-red-600 font-medium">Esci</button>
              </>
            ) : (
              <Link href="/login" className="block px-4 py-2 rounded-lg bg-[#1a2744] text-white text-center font-bold">Accedi</Link>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
