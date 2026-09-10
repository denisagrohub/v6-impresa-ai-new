"use client";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Menu, X, User, LogOut, ArrowRight, ChevronDown } from "lucide-react";
import { Logo } from "./Logo";

// 10/09/2026 (Denis: "non vedo le pagine dedicate nuove") - le 8 landing
// di prodotto (Parte D) erano raggiungibili SOLO dalle CTA della
// rotazione in homepage, mai da nessun link di menu - da qui la
// sensazione di "sito vecchio" anche con l'ultimo deploy live. Elenco
// unico qui, riusato da dropdown desktop e lista mobile sotto.
//
// Stesso giro: rimossi "Pacchetti" (/premium) e "Brand" (/brand) dal
// menu su richiesta esplicita di Denis ("non servono sul menu") - le
// pagine restano raggiungibili via URL diretto, solo tolte dalla
// navigazione.
const PRODOTTI = [
  { href: "/business-plan", label: "Business Plan" },
  { href: "/analisi-aziendale", label: "Analisi Aziendale" },
  { href: "/ricambio-generazionale", label: "Ricambio Generazionale" },
  { href: "/acquisto-tee", label: "Acquisto TEE" },
  { href: "/esg", label: "ESG" },
  { href: "/team-building", label: "Team Building" },
  { href: "/formazione-aziendale", label: "Formazione Aziendale" },
  { href: "/kaizen-lean", label: "Kaizen & Lean" },
] as const;

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [productsOpen, setProductsOpen] = useState(false);
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
            <Logo />
          </Link>
          
          <div className="hidden md:flex items-center gap-6">
            <Link href="/" className={`text-sm font-medium hover:text-gray-900 ${pathname === '/' ? 'text-[#1a2744] font-semibold' : 'text-gray-700'}`}>Home</Link>
            <Link href="/chi-siamo" className={`text-sm font-medium hover:text-gray-900 ${pathname === '/chi-siamo' ? 'text-[#1a2744] font-semibold' : 'text-gray-700'}`}>Chi Siamo</Link>
            <Link href="/metodo" className={`text-sm font-medium hover:text-gray-900 ${pathname === '/metodo' ? 'text-[#1a2744] font-semibold' : 'text-gray-700'}`}>Il Metodo</Link>

            <div
              className="relative"
              onMouseEnter={() => setProductsOpen(true)}
              onMouseLeave={() => setProductsOpen(false)}
            >
              <button
                type="button"
                className="flex items-center gap-1 text-sm font-medium text-gray-700 hover:text-gray-900"
                aria-expanded={productsOpen}
              >
                Prodotti <ChevronDown size={14} />
              </button>
              {productsOpen && (
                <div className="absolute left-0 top-full pt-2">
                  <div className="w-64 rounded-xl border border-gray-100 bg-white p-2 shadow-lg">
                    {PRODOTTI.map((p) => (
                      <Link
                        key={p.href}
                        href={p.href}
                        className="block rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                      >
                        {p.label}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <Link href="/blog" className={`text-sm font-medium hover:text-gray-900 ${pathname === '/blog' ? 'text-[#1a2744] font-semibold' : 'text-gray-700'}`}>Blog</Link>
            <Link href="/partnership" className={`text-sm font-medium hover:text-gray-900 ${pathname === '/partnership' ? 'text-[#1a2744] font-semibold' : 'text-gray-700'}`}>Partnership</Link>
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
            <div className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Prodotti</div>
            {PRODOTTI.map((p) => (
              <Link key={p.href} href={p.href} className="block px-6 py-2 rounded-lg hover:bg-gray-100 text-sm">
                {p.label}
              </Link>
            ))}
            <Link href="/blog" className="block px-4 py-2 rounded-lg hover:bg-gray-100">Blog</Link>
            <Link href="/partnership" className="block px-4 py-2 rounded-lg hover:bg-gray-100">Partnership</Link>
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
