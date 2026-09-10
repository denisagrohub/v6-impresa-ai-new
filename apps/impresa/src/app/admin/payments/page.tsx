"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    Loader2, ArrowLeft, CheckCircle2, Clock, RefreshCw, ExternalLink,
} from "lucide-react";

interface OnlinePayment {
    id: number;
    name: string;
    cliente: string;
    importo: number;
    data: string;
    statoFatturazione: string;
}

interface Tranche {
    id: number;
    nome: string;
    progetto: string;
    progettoId: number | null;
    numero: number;
    importo: number;
    stato: 'da_incassare' | 'incassata';
    dataIncasso: string | null;
    confermatoDa: string | null;
}

// 10/09/2026 (Denis: sistema Pagamenti con dati reali) - due fonti reali
// distinte, mai fuse in una finta unica tabella: i pagamenti online
// Win-Win (sale.order confermato, stesso flusso Stripe/Odoo nativo gia'
// collegato in sessione) e le tranche/SAL di consulenza (conferma
// manuale dell'incasso, scelta esplicita gia' presa - "non serve un
// vero sistema di pagamento esterno" per queste).
export default function AdminPaymentsPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [onlinePayments, setOnlinePayments] = useState<OnlinePayment[]>([]);
    const [tranches, setTranches] = useState<Tranche[]>([]);
    const [markingId, setMarkingId] = useState<number | null>(null);

    const load = async () => {
        try {
            const res = await fetch('/api/admin/payments');
            const data = await res.json();
            if (!res.ok || !data.success) {
                setLoadError(data.error || 'Odoo non raggiungibile');
                return;
            }
            setOnlinePayments(data.onlinePayments || []);
            setTranches(data.tranches || []);
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

    const handleMarkPaid = async (trancheId: number) => {
        if (!confirm('Confermi che questa tranche è stata incassata?')) return;
        setMarkingId(trancheId);
        try {
            const res = await fetch(`/api/admin/payments/tranches/${trancheId}/mark-paid`, { method: 'POST' });
            const data = await res.json();
            if (data.success) load();
            else alert(data.error || 'Operazione fallita');
        } finally {
            setMarkingId(null);
        }
    };

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center"><Loader2 size={40} className="animate-spin text-orange-500" /></div>;
    }

    const totaleOnline = onlinePayments.reduce((sum, p) => sum + p.importo, 0);
    const trancheIncassate = tranches.filter((t) => t.stato === 'incassata');
    const trancheDaIncassare = tranches.filter((t) => t.stato === 'da_incassare');
    const totaleIncassatoTranche = trancheIncassate.reduce((sum, t) => sum + t.importo, 0);
    const totaleDaIncassare = trancheDaIncassare.reduce((sum, t) => sum + t.importo, 0);

    return (
        <div className="min-h-screen bg-[#f8fafc]">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <Link href="/admin/dashboard" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 mb-2">
                            <ArrowLeft size={16} /> Torna alla dashboard
                        </Link>
                        <h1 className="text-3xl font-bold text-[#1a2744]">Pagamenti</h1>
                        <p className="text-gray-500">Pagamenti online e tranche di consulenza</p>
                    </div>
                    <button onClick={load} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-sm font-medium">
                        <RefreshCw size={16} /> Aggiorna
                    </button>
                </div>

                {loadError && (
                    <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{loadError}</div>
                )}

                <div className="grid md:grid-cols-4 gap-6 mb-8">
                    <div className="bg-white rounded-2xl border border-gray-100 p-6">
                        <div className="text-sm text-gray-500 mb-1">Pagamenti Online</div>
                        <div className="text-3xl font-bold text-[#1a2744]">€{totaleOnline.toLocaleString('it-IT')}</div>
                        <div className="text-xs text-gray-500 mt-1">{onlinePayments.length} ordini confermati</div>
                    </div>
                    <div className="bg-white rounded-2xl border border-gray-100 p-6">
                        <div className="text-sm text-gray-500 mb-1">Tranche Incassate</div>
                        <div className="text-3xl font-bold text-green-600">€{totaleIncassatoTranche.toLocaleString('it-IT')}</div>
                        <div className="text-xs text-gray-500 mt-1">{trancheIncassate.length} tranche</div>
                    </div>
                    <div className="bg-white rounded-2xl border border-gray-100 p-6">
                        <div className="text-sm text-gray-500 mb-1">Da Incassare</div>
                        <div className="text-3xl font-bold text-orange-600">€{totaleDaIncassare.toLocaleString('it-IT')}</div>
                        <div className="text-xs text-gray-500 mt-1">{trancheDaIncassare.length} tranche</div>
                    </div>
                    <div className="bg-white rounded-2xl border border-gray-100 p-6">
                        <div className="text-sm text-gray-500 mb-1">Totale Movimentato</div>
                        <div className="text-2xl font-bold text-[#1a2744]">€{(totaleOnline + totaleIncassatoTranche).toLocaleString('it-IT')}</div>
                    </div>
                </div>

                {/* Pagamenti Online */}
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden mb-8">
                    <div className="px-6 py-4 border-b border-gray-100">
                        <h2 className="text-lg font-bold text-[#1a2744]">Pagamenti Online (Win-Win)</h2>
                    </div>
                    {onlinePayments.length === 0 ? (
                        <div className="p-8 text-center text-sm text-gray-400">Nessun pagamento online ancora.</div>
                    ) : (
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ordine</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Importo</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fatturazione</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {onlinePayments.map((p) => (
                                    <tr key={p.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-600">{p.name}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-[#1a2744] font-medium">{p.cliente}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-[#1a2744]">€{p.importo.toLocaleString('it-IT')}</td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                <CheckCircle2 size={12} /> {p.statoFatturazione}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{p.data ? new Date(p.data).toLocaleDateString('it-IT') : '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Tranche SAL */}
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100">
                        <h2 className="text-lg font-bold text-[#1a2744]">Tranche / SAL Consulenza</h2>
                    </div>
                    {tranches.length === 0 ? (
                        <div className="p-8 text-center text-sm text-gray-400">Nessuna tranche ancora.</div>
                    ) : (
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tranche</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Progetto</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Importo</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stato</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Incassata il</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Azioni</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {tranches.map((t) => (
                                    <tr key={t.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{t.nome}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                            {t.progettoId ? (
                                                <Link href={`/admin/projects/${t.progettoId}`} className="text-[#1a2744] font-medium hover:underline flex items-center gap-1">
                                                    {t.progetto} <ExternalLink size={12} />
                                                </Link>
                                            ) : t.progetto}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-[#1a2744]">€{t.importo.toLocaleString('it-IT')}</td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${t.stato === 'incassata' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}`}>
                                                {t.stato === 'incassata' ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                                                {t.stato === 'incassata' ? 'Incassata' : 'Da incassare'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {t.dataIncasso ? `${new Date(t.dataIncasso).toLocaleDateString('it-IT')}${t.confermatoDa ? ` · ${t.confermatoDa}` : ''}` : '—'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right">
                                            {t.stato === 'da_incassare' && (
                                                <button
                                                    onClick={() => handleMarkPaid(t.id)}
                                                    disabled={markingId === t.id}
                                                    className="text-xs px-3 py-1.5 rounded-lg bg-[#1a2744] text-white font-medium hover:bg-[#0f3460] disabled:opacity-50"
                                                >
                                                    {markingId === t.id ? '...' : 'Marca Incassata'}
                                                </button>
                                            )}
                                        </td>
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
