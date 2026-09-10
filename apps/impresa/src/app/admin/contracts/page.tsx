"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, ArrowLeft, ShieldCheck, FileText } from "lucide-react";

interface ContractDoc {
    id: number;
    tipo: string;
    fileName: string | null;
    certificato: boolean;
    firmatoIl: string | null;
}

interface Contract {
    id: number;
    nome: string;
    cliente: string;
    stato: string;
    certificato: boolean;
    firmatoIl: string | null;
    documenti: ContractDoc[];
}

const STATE_LABEL: Record<string, { label: string; className: string }> = {
    draft: { label: 'Bozza', className: 'bg-gray-100 text-gray-700' },
    sent: { label: 'Inviato', className: 'bg-blue-100 text-blue-700' },
    signed: { label: 'Firmato', className: 'bg-green-100 text-green-700' },
    certified: { label: 'Certificato', className: 'bg-purple-100 text-purple-700' },
    expired: { label: 'Scaduto', className: 'bg-red-100 text-red-700' },
};

// 10/09/2026 (Denis: "vedi come collegare il modulo contratti") - vista
// reale su erpv6.contract (Typst + firma Documenso + certificazione
// blockchain, sistema gia' completo, solo mai mostrato da nessuna UI
// del sito prima d'ora). Creazione di un nuovo contratto resta
// dall'interno di un progetto (pulsante "Crea Contratto" su
// /admin/projects/[id]) - qui solo la vista d'insieme.
export default function ContractsPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [contracts, setContracts] = useState<Contract[]>([]);

    useEffect(() => {
        const session = localStorage.getItem("pi_session");
        if (!session) { router.push("/login"); return; }
        (async () => {
            try {
                const res = await fetch('/api/admin/contracts');
                const data = await res.json();
                if (!res.ok || !data.success) {
                    setLoadError(data.error || 'Odoo non raggiungibile');
                    return;
                }
                setContracts(data.contracts || []);
            } catch (error: any) {
                setLoadError(error.message || 'Errore di rete');
            } finally {
                setLoading(false);
            }
        })();
    }, [router]);

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center"><Loader2 size={40} className="animate-spin text-orange-500" /></div>;
    }

    return (
        <div className="min-h-screen bg-[#f8fafc]">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <Link href="/admin/dashboard" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 mb-6">
                    <ArrowLeft size={16} /> Torna alla dashboard
                </Link>
                <h1 className="text-3xl font-bold text-[#1a2744] mb-1">Contratti</h1>
                <p className="text-gray-500 mb-8">Generazione Typst, firma Documenso, certificazione blockchain</p>

                {loadError && (
                    <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{loadError}</div>
                )}

                {contracts.length === 0 && !loadError ? (
                    <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-gray-500">
                        Nessun contratto ancora. Se ne crea uno dalla pagina di un progetto.
                    </div>
                ) : (
                    <div className="space-y-3">
                        {contracts.map((c) => {
                            const state = STATE_LABEL[c.stato] || STATE_LABEL.draft;
                            return (
                                <div key={c.id} className="bg-white rounded-2xl border border-gray-100 p-6">
                                    <div className="flex items-center justify-between mb-3">
                                        <div>
                                            <div className="text-sm font-bold text-[#1a2744]">{c.nome}</div>
                                            <div className="text-xs text-gray-500">{c.cliente}</div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {c.certificato && (
                                                <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-purple-50 text-purple-700">
                                                    <ShieldCheck size={12} /> Certificato
                                                </span>
                                            )}
                                            <span className={`text-xs px-2 py-1 rounded-full font-medium ${state.className}`}>{state.label}</span>
                                        </div>
                                    </div>
                                    {c.documenti.length > 0 && (
                                        <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-100">
                                            {c.documenti.map((d) => (
                                                <span key={d.id} className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-gray-50 text-gray-600">
                                                    <FileText size={12} /> {d.tipo}{d.certificato ? ' ✓' : ''}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
