"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, ArrowLeft, Save, Calculator, TrendingUp, Users, Building2 } from "lucide-react";

type Level = 'L1' | 'L2' | 'L3';

interface Rule {
    nome: string;
    prezzoBase: number;
    tipoProvvigioneConsulente: 'fisso' | 'percentuale';
    valoreConsulente: number;
    percentualeReferral: number;
    costiFissiAzienda: number;
}

export default function CommissionSettingsPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [rules, setRules] = useState<Record<Level, Rule>>({} as any);
    const [simLevel, setSimLevel] = useState<Level>('L1');
    const [simPrezzo, setSimPrezzo] = useState(1500);

    useEffect(() => {
        const session = localStorage.getItem("pi_session");
        if (!session || JSON.parse(session).role !== 'admin') {
            router.push("/login");
        } else {
            loadRules();
        }
    }, [router]);

    const loadRules = async () => {
        try {
            const res = await fetch('/api/admin/commission-rules');
            const data = await res.json();
            setRules(data.rules);
            setSimPrezzo(data.rules.L1.prezzoBase);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const updateRule = (level: Level, field: keyof Rule, value: any) => {
        setRules(prev => ({
            ...prev,
            [level]: { ...prev[level], [field]: value }
        }));
        // Se cambio il prezzo base, aggiorno anche il simulatore se è sullo stesso livello
        if (level === simLevel && field === 'prezzoBase') {
            setSimPrezzo(value);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await fetch('/api/admin/commission-rules', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rules }),
            });
            alert('✅ Regole di provvigione salvate con successo!');
        } catch (e) {
            alert('❌ Errore nel salvataggio');
        } finally {
            setSaving(false);
        }
    };

    // Logica del Simulatore
    const rule = rules[simLevel];
    if (!rule) return null;

    const costoReferral = Math.round(simPrezzo * (rule.percentualeReferral / 100));
    const costoConsulente = rule.tipoProvvigioneConsulente === 'fisso'
        ? rule.valoreConsulente
        : Math.round(simPrezzo * (rule.valoreConsulente / 100));

    const margineNetto = simPrezzo - costoReferral - costoConsulente - rule.costiFissiAzienda;
    const marginePercentuale = simPrezzo > 0 ? ((margineNetto / simPrezzo) * 100).toFixed(1) : 0;

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center"><Loader2 size={40} className="animate-spin text-orange-500" /></div>;
    }

    return (
        <div className="min-h-screen bg-[#f8fafc]">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <Link href="/admin/dashboard" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 mb-2">
                            <ArrowLeft size={16} /> Torna alla dashboard
                        </Link>
                        <h1 className="text-3xl font-bold text-[#1a2744]">Motore Provvigioni & Margini</h1>
                        <p className="text-gray-500">Configura le regole e simula l'impatto economico in tempo reale</p>
                    </div>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[#1a2744] text-white font-bold hover:bg-[#0f3460] disabled:opacity-50"
                    >
                        {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                        Salva Regole
                    </button>
                </div>

                <div className="grid lg:grid-cols-3 gap-8">
                    {/* COLONNA SINISTRA: Configurazione */}
                    <div className="lg:col-span-2 space-y-6">
                        {(['L1', 'L2', 'L3'] as Level[]).map((level) => (
                            <div key={level} className="bg-white rounded-2xl border border-gray-100 p-6">
                                <h2 className="text-xl font-bold text-[#1a2744] mb-4 flex items-center gap-2">
                                    <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold ${level === 'L1' ? 'bg-blue-500' : level === 'L2' ? 'bg-orange-500' : 'bg-purple-500'
                                        }`}>{level}</span>
                                    {rules[level].nome}
                                </h2>

                                <div className="grid md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Prezzo di Vendita Base (€)</label>
                                        <input
                                            type="number"
                                            value={rules[level].prezzoBase}
                                            onChange={(e) => updateRule(level, 'prezzoBase', Number(e.target.value))}
                                            className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Costi Fissi Azienda (€)</label>
                                        <input
                                            type="number"
                                            value={rules[level].costiFissiAzienda}
                                            onChange={(e) => updateRule(level, 'costiFissiAzienda', Number(e.target.value))}
                                            className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                                        />
                                        <p className="text-xs text-gray-500 mt-1">Software, marketing, tasse base</p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">% Referral</label>
                                        <input
                                            type="number"
                                            value={rules[level].percentualeReferral}
                                            onChange={(e) => updateRule(level, 'percentualeReferral', Number(e.target.value))}
                                            className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Tipo Provvigione Consulente</label>
                                        <select
                                            value={rules[level].tipoProvvigioneConsulente}
                                            onChange={(e) => updateRule(level, 'tipoProvvigioneConsulente', e.target.value)}
                                            className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 bg-white"
                                        >
                                            <option value="fisso">Importo Fisso (€)</option>
                                            <option value="percentuale">Percentuale (%)</option>
                                        </select>
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Valore Consulente ({rules[level].tipoProvvigioneConsulente === 'fisso' ? '€' : '%'})
                                        </label>
                                        <input
                                            type="number"
                                            value={rules[level].valoreConsulente}
                                            onChange={(e) => updateRule(level, 'valoreConsulente', Number(e.target.value))}
                                            className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* COLONNA DESTRA: Simulatore Live */}
                    <div className="lg:col-span-1">
                        <div className="bg-gradient-to-br from-[#1a2744] to-[#0f3460] text-white rounded-2xl p-6 sticky top-8 shadow-xl">
                            <div className="flex items-center gap-2 mb-6">
                                <Calculator size={24} className="text-orange-400" />
                                <h2 className="text-xl font-bold">Simulatore Margine</h2>
                            </div>

                            <div className="mb-6">
                                <label className="block text-sm text-gray-300 mb-2">Simula su Livello:</label>
                                <div className="flex gap-2">
                                    {(['L1', 'L2', 'L3'] as Level[]).map(l => (
                                        <button
                                            key={l}
                                            onClick={() => { setSimLevel(l); setSimPrezzo(rules[l].prezzoBase); }}
                                            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${simLevel === l ? 'bg-orange-500 text-white' : 'bg-white/10 text-gray-300 hover:bg-white/20'
                                                }`}
                                        >
                                            {l}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="mb-6">
                                <label className="block text-sm text-gray-300 mb-2">Prezzo di Vendita Simulato (€)</label>
                                <input
                                    type="number"
                                    value={simPrezzo}
                                    onChange={(e) => setSimPrezzo(Number(e.target.value))}
                                    className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white text-2xl font-bold focus:outline-none focus:ring-2 focus:ring-orange-500"
                                />
                            </div>

                            <div className="space-y-4 border-t border-white/20 pt-6">
                                <div className="flex justify-between items-center">
                                    <span className="flex items-center gap-2 text-gray-300"><Users size={16} /> Referral ({rule.percentualeReferral}%)</span>
                                    <span className="font-mono text-red-300">- €{costoReferral.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="flex items-center gap-2 text-gray-300">
                                        <Building2 size={16} /> Consulente ({rule.tipoProvvigioneConsulente === 'fisso' ? 'Fisso' : rule.valoreConsulente + '%'})
                                    </span>
                                    <span className="font-mono text-red-300">- €{costoConsulente.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="flex items-center gap-2 text-gray-300">Costi Fissi Azienda</span>
                                    <span className="font-mono text-red-300">- €{rule.costiFissiAzienda.toLocaleString()}</span>
                                </div>

                                <div className="border-t border-white/20 pt-4 mt-4">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-lg font-bold text-white">Margine Netto Azienda</span>
                                        <span className="text-2xl font-bold text-green-400">€{margineNetto.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-gray-400">Margine %</span>
                                        <span className={`text-sm font-bold ${Number(marginePercentuale) < 30 ? 'text-red-400' : 'text-green-400'}`}>
                                            {marginePercentuale}%
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-6 p-3 bg-white/10 rounded-lg text-xs text-gray-300">
                                <strong className="text-orange-400">💡 Nota:</strong> Se il margine scende sotto il 30%, il sistema ti avvisa. Modifica i parametri a sinistra per vedere l'impatto in tempo reale.
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
