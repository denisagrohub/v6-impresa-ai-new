"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, ArrowLeft, RefreshCw, Percent } from "lucide-react";

interface Commission {
    consultantId: number;
    nome: string;
    aliquota: number;
    totaleIncassato: number;
    commissione: number;
    numeroTranche: number;
}

// 10/09/2026 (Denis: "guarda il modulo e sistema entrambe le pagine")
// Contabilità era interamente finta (grafico a 12 mesi + suggerimenti
// fiscali, tutti numeri scritti a mano) - il modulo Odoo che dovrebbe
// alimentarla (erpv6_accounting) gira live sul server ma non esiste
// nel repository git, quindi ricostruire una vera contabilità generale
// qui non è possibile oggi (serve prima recuperare/versionare quel
// modulo, task separato). Quello che è reale e buildabile subito sono
// le commissioni: tranche incassate x aliquota reale del consulente
// (/api/admin/commissions) - non una contabilità completa, ma reale.
export default function CommissionsPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [commissions, setCommissions] = useState<Commission[]>([]);

    const load = async () => {
        try {
            const res = await fetch('/api/admin/commissions');
            const data = await res.json();
            if (!res.ok || !data.success) {
                setLoadError(data.error || 'Odoo non raggiungibile');
                return;
            }
            setCommissions(data.commissions || []);
        } catch (error: any) {
            setLoadError(error.message || 'Errore di rete');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const session = localStorage.getItem("pi_session");
        if (!session) { router.push("/login"); return; }
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [router]);

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center"><Loader2 size={40} className="animate-spin text-orange-500" /></div>;
    }

    const totaleCommissioni = commissions.reduce((s, c) => s + c.commissione, 0);
    const totaleIncassato = commissions.reduce((s, c) => s + c.totaleIncassato, 0);

    return (
        <div className="min-h-screen bg-[#f8fafc]">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <Link href="/admin/dashboard" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 mb-2">
                            <ArrowLeft size={16} /> Torna alla dashboard
                        </Link>
                        <h1 className="text-3xl font-bold text-[#1a2744]">Commissioni</h1>
                        <p className="text-gray-500">Provvigioni reali su tranche incassate — contabilità generale non ancora disponibile (modulo da recuperare)</p>
                    </div>
                    <button onClick={load} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-sm font-medium">
                        <RefreshCw size={16} /> Aggiorna
                    </button>
                </div>

                {loadError && (
                    <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{loadError}</div>
                )}

                <div className="grid md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-white rounded-2xl border border-gray-100 p-6">
                        <div className="text-sm text-gray-500 mb-1">Incassato Totale</div>
                        <div className="text-3xl font-bold text-[#1a2744]">€{totaleIncassato.toLocaleString('it-IT')}</div>
                    </div>
                    <div className="bg-white rounded-2xl border border-gray-100 p-6">
                        <div className="text-sm text-gray-500 mb-1">Commissioni Maturate</div>
                        <div className="text-3xl font-bold text-orange-600">€{totaleCommissioni.toLocaleString('it-IT')}</div>
                    </div>
                    <div className="bg-white rounded-2xl border border-gray-100 p-6">
                        <div className="text-sm text-gray-500 mb-1">Consulenti Attivi</div>
                        <div className="text-3xl font-bold text-[#1a2744]">{commissions.length}</div>
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100">
                        <h2 className="text-lg font-bold text-[#1a2744]">Per Consulente</h2>
                    </div>
                    {commissions.length === 0 ? (
                        <div className="p-8 text-center text-sm text-gray-400">
                            Nessuna tranche incassata ancora — le commissioni compaiono qui appena una tranche viene marcata incassata.
                        </div>
                    ) : (
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Consulente</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Aliquota</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tranche</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Incassato</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Commissione</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {commissions.map((c) => (
                                    <tr key={c.consultantId} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-[#1a2744]">{c.nome}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 flex items-center gap-1"><Percent size={12} /> {c.aliquota}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{c.numeroTranche}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">€{c.totaleIncassato.toLocaleString('it-IT')}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-orange-600">€{c.commissione.toLocaleString('it-IT')}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}
