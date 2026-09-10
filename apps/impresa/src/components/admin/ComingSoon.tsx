import Link from "next/link";
import { ArrowLeft, type LucideIcon } from "lucide-react";

// 10/09/2026 (Denis, dopo aver trovato 5 voci del menu admin che
// portavano a un 404: Knowledge Base, Libreria, Brand Projects,
// Marketing Plans, Sicurezza - pagine mai costruite): "diamogli una
// pagina che sia coerente ossia che dica AEOSv6 sistema in arrivo" -
// placeholder condiviso, mai un 404 silenzioso, mai contenuto finto
// spacciato per reale.
interface ComingSoonProps {
    icon: LucideIcon;
    title: string;
    description: string;
}

export default function ComingSoon({ icon: Icon, title, description }: ComingSoonProps) {
    return (
        <div className="min-h-screen bg-[#f8fafc]">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <Link href="/admin/dashboard" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 mb-8">
                    <ArrowLeft size={16} /> Torna alla dashboard
                </Link>

                <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center max-w-2xl mx-auto">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#1a2744] to-[#0f3460] flex items-center justify-center mx-auto mb-6">
                        <Icon size={28} className="text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-[#1a2744] mb-2">{title}</h1>
                    <p className="text-gray-500 mb-6">{description}</p>
                    <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 text-blue-700 text-sm font-semibold">
                        AEOSv6 — Sistema in arrivo
                    </span>
                </div>
            </div>
        </div>
    );
}
