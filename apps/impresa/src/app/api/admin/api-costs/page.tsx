"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    Loader2, ArrowLeft, DollarSign, TrendingUp, Calendar,
    AlertCircle, CheckCircle2, BarChart3, PieChart
} from "lucide-react";

interface CostData {
    provider: string;
    totalCost: number;
    usage: number;
    unit: string;
    unitCost: number;
    trend: 'up' | 'down' | 'stable';
    lastCall: string;
}

export default function APICostsDashboard() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [costs, setCosts] = useState<CostData[]>([]);
    const [totalMonthlyCost, setTotalMonthlyCost] = useState(0);
    const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'year'>('month');

    useEffect(() => {
        const session = localStorage.getItem("pi_session");
        if (!session || JSON.parse(session).role !== 'admin') {
            router.push("/login");
        } else {
            loadCosts();
        }
    }, [router, selectedPeriod]);

    const loadCosts = async () => {
        try {
            // In produzione, questi dati verranno da Odoo o da un database
            // Per ora usiamo dati demo
            const demoCosts: CostData[] = [
                {
                    provider: "Daily.co",
                    totalCost: 0,
                    usage: 45,
                    unit: "minuti",
                    unitCost: 0.004,
                    trend: 'stable',
                    lastCall: "2 ore fa"
                },
                {
                    provider: "Deepgram",
                    totalCost: 12.50,
                    usage: 3125,
                    unit: "minuti",
                    unitCost: 0.004,
                    trend: 'up',
                    lastCall: "2 ore fa"
                },
                {
                    provider: "Anthropic Claude",
                    totalCost: 28.75,
                    usage: 145000,
                    unit: "token",
                    unitCost: 0.0000002,
                    trend: 'up',
                    lastCall: "2 ore fa"
                }
            ];

            setCosts(demoCosts);
            setTotalMonthlyCost(demoCosts.reduce((sum, c) => sum + c.totalCost, 0));
        } catch (error) {
            console.error('Errore caricamento costi:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
                <Loader2 size={40} className="animate-spin text-orange-500" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f8fafc]">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <Link href="/admin/dashboard" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 mb-2">
                            <ArrowLeft size={16} /> Torna alla dashboard
                        </Link>
                        <h1 className="text-3xl font-bold text-[#1a2744]">Dashboard Costi API</h1>
                        <p className="text-gray-500">Monitoraggio costi e utilizzo servizi AI</p>
                    </div>

                    {/* Period Selector */}
                    <div className="flex items-center gap-2 bg-white rounded-lg p-1 border">
                        {(['week', 'month', 'year'] as const).map((period) => (
                            <button
                                key={period}
                                onClick={() => setSelectedPeriod(period)}
                                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${selectedPeriod === period
                                        ? 'bg-[#1a2744] text-white'
                                        : 'text-gray-600 hover:bg-gray-50'
                                    }`}
                            >
                                {period === 'week' ? 'Settimana' : period === 'month' ? 'Mese' : 'Anno'}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Total Cost Card */}
                <div className="bg-gradient-to-br from-[#1a2744] to-[#0f3460] text-white rounded-2xl p-8 mb-8">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-sm text-gray-300 mb-2">Costo Totale {selectedPeriod === 'week' ? 'Settimanale' : selectedPeriod === 'month' ? 'Mensile' : 'Annuale'}</div>
                            <div className="text-5xl font-bold">€{totalMonthlyCost.toFixed(2)}</div>
                            <div className="text-sm text-gray-300 mt-2">
                                {selectedPeriod === 'month' && (
                                    <span className="flex items-center gap-2 mt-2">
                                        <TrendingUp size={16} className="text-green-400" />
                                        <span>+12% rispetto al mese scorso</span>
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="text-right">
                            <DollarSign size={64} className="text-orange-400 opacity-50" />
                        </div>
                    </div>
                </div>

                {/* Cost Breakdown */}
                <div className="grid md:grid-cols-3 gap-6 mb-8">
                    {costs.map((cost) => (
                        <div key={cost.provider} className="bg-white rounded-2xl border border-gray-100 p-6 hover:shadow-lg transition-all">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-bold text-lg text-[#1a2744]">{cost.provider}</h3>
                                <div className={`flex items-center gap-1 text-xs font-medium ${cost.trend === 'up' ? 'text-red-600' : cost.trend === 'down' ? 'text-green-600' : 'text-gray-600'
                                    }`}>
                                    <TrendingUp size={14} className={cost.trend === 'down' ? 'rotate-180' : ''} />
                                    <span>{cost.trend === 'up' ? '+12%' : cost.trend === 'down' ? '-8%' : '0%'}</span>
                                </div>
                            </div>

                            <div className="text-3xl font-bold text-orange-600 mb-2">
                                €{cost.totalCost.toFixed(2)}
                            </div>

                            <div className="space-y-2 text-sm text-gray-600">
                                <div className="flex justify-between">
                                    <span>Utilizzo:</span>
                                    <span className="font-medium">{cost.usage.toLocaleString()} {cost.unit}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Costo unitario:</span>
                                    <span className="font-medium">€{cost.unitCost.toFixed(4)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Ultima chiamata:</span>
                                    <span className="font-medium">{cost.lastCall}</span>
                                </div>
                            </div>

                            {/* Progress Bar */}
                            <div className="mt-4">
                                <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                                    <span>Utilizzo</span>
                                    <span>{Math.min(100, Math.round((cost.usage / 10000) * 100))}%</span>
                                </div>
                                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-orange-500 to-orange-600 rounded-full transition-all"
                                        style={{ width: `${Math.min(100, (cost.usage / 10000) * 100)}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Cost Optimization Tips */}
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 mb-8">
                    <h3 className="font-bold text-lg text-blue-900 mb-4 flex items-center gap-2">
                        <AlertCircle size={20} />
                        Suggerimenti per Ottimizzare i Costi
                    </h3>
                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="bg-white rounded-xl p-4 border border-blue-100">
                            <h4 className="font-bold text-[#1a2744] mb-2 flex items-center gap-2">
                                <CheckCircle2 size={16} className="text-green-600" />
                                Daily.co Free Tier
                            </h4>
                            <p className="text-sm text-gray-600">
                                Stai utilizzando 45 minuti su 2000 gratuiti. Nessun costo fino a 2000 min/mese.
                            </p>
                        </div>
                        <div className="bg-white rounded-xl p-4 border border-blue-100">
                            <h4 className="font-bold text-[#1a2744] mb-2 flex items-center gap-2">
                                <CheckCircle2 size={16} className="text-green-600" />
                                Deepgram Nova-2
                            </h4>
                            <p className="text-sm text-gray-600">
                                Modello più economico. Considera di usare Nova-2 invece di Whisper per risparmiare il 30%.
                            </p>
                        </div>
                        <div className="bg-white rounded-xl p-4 border border-blue-100">
                            <h4 className="font-bold text-[#1a2744] mb-2 flex items-center gap-2">
                                <CheckCircle2 size={16} className="text-green-600" />
                                Claude Prompt Optimization
                            </h4>
                            <p className="text-sm text-gray-600">
                                Riduci i prompt a 500 token invece di 1000. Risparmio stimato: €15/mese.
                            </p>
                        </div>
                        <div className="bg-white rounded-xl p-4 border border-blue-100">
                            <h4 className="font-bold text-[#1a2744] mb-2 flex items-center gap-2">
                                <CheckCircle2 size={16} className="text-green-600" />
                                Caching Risposte
                            </h4>
                            <p className="text-sm text-gray-600">
                                Implementa caching per pattern comuni. Risparmio stimato: €20/mese.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Usage Chart (Placeholder) */}
                <div className="bg-white rounded-2xl border border-gray-100 p-6">
                    <h3 className="font-bold text-lg text-[#1a2744] mb-4 flex items-center gap-2">
                        <BarChart3 size={20} />
                        Trend Utilizzo Ultimi 30 Giorni
                    </h3>
                    <div className="h-64 flex items-center justify-center text-gray-400">
                        <div className="text-center">
                            <PieChart size={48} className="mx-auto mb-2 opacity-30" />
                            <p>Grafico interattivo (da implementare con Chart.js o Recharts)</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
