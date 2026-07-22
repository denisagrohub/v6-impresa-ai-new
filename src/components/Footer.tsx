import Link from "next/link";
import { ArrowUpRight, Mail, Phone, MapPin } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-[#0f172a] text-gray-300 pt-20 pb-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
          {/* Brand */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center text-white font-bold text-lg">PI</div>
              <span className="font-bold text-xl text-white">Progetto Impresa</span>
            </div>
            <p className="text-sm text-gray-400 leading-relaxed">
              Trasformiamo idee complesse in strutture finanziarie solide. Il partner strategico per la tua crescita.
            </p>
            <div className="flex gap-4 pt-2">
              {/* Social placeholders */}
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-orange-500 transition-colors cursor-pointer">in</div>
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-orange-500 transition-colors cursor-pointer">ig</div>
            </div>
          </div>

          {/* Servizi */}
          <div>
            <h4 className="text-white font-bold mb-6 uppercase text-xs tracking-wider">I Nostri Percorsi</h4>
            <ul className="space-y-3">
              <li><Link href="/business-plan-startup" className="hover:text-orange-400 transition-colors flex items-center gap-2 group">Pacchetto Startup <ArrowUpRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity"/></Link></li>
              <li><Link href="/business-plan-pmi" className="hover:text-orange-400 transition-colors flex items-center gap-2 group">Piano Industriale PMI <ArrowUpRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity"/></Link></li>
              <li><Link href="/project-finance" className="hover:text-orange-400 transition-colors flex items-center gap-2 group">Advisory & Project Finance <ArrowUpRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity"/></Link></li>
              <li><Link href="/form" className="hover:text-orange-400 transition-colors flex items-center gap-2 group">Richiedi Consulenza <ArrowUpRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity"/></Link></li>
            </ul>
          </div>

          {/* Azienda */}
          <div>
            <h4 className="text-white font-bold mb-6 uppercase text-xs tracking-wider">Azienda</h4>
            <ul className="space-y-3">
              <li><Link href="/chi-siamo" className="hover:text-orange-400 transition-colors">Chi Siamo</Link></li>
              <li><Link href="/metodo" className="hover:text-orange-400 transition-colors">Il Metodo V6</Link></li>
              <li><Link href="/casi-studio" className="hover:text-orange-400 transition-colors">Casi Studio</Link></li>
              <li><Link href="/contatti" className="hover:text-orange-400 transition-colors">Contatti</Link></li>
              </ul>
          </div>

          {/* Contatti */}
          <div>
            <h4 className="text-white font-bold mb-6 uppercase text-xs tracking-wider">Contatti</h4>
            <ul className="space-y-4">
              <li className="flex items-start gap-3"><Mail size={18} className="text-orange-500 mt-1"/> <span>info@progettoimpresa.it</span></li>
              <li className="flex items-start gap-3"><Phone size={18} className="text-orange-500 mt-1"/> <span>+39 02 123 4567</span></li>
              <li className="flex items-start gap-3"><MapPin size={18} className="text-orange-500 mt-1"/> <span>Via Monte Napoleone, 8<br/>20121 Milano MI</span></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-gray-500">
          <p>© 2026 Progetto Impresa S.r.l. — P.IVA 12345678901</p>
          <div className="flex gap-6">
            <Link href="#" className="hover:text-white">Privacy Policy</Link>
            <Link href="#" className="hover:text-white">Cookie Policy</Link>
            <Link href="#" className="hover:text-white">Termini di Servizio</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
