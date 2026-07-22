"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, ArrowLeft, Save, TrendingUp, Settings2 } from "lucide-react";

export default function PricingSettingsPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [config, setConfig] = useState({
        base: 50000,
        pesoImporto: 0.015,
        pesoComplessita: 25000,
        pesoUrgenza: 1.25,
        settoriComplessi: ['m&a', 'ristrutturazione debito', 'acquisizione', 'fusione', 'ipo'],
    });

    useEffect(() => {
        const session = localStorage.getItem("odoo_session");
        if (!session) {
            router.push("/admin/login");
        } else {
            loadConfig();
        }
    }, [router]);

    const loadConfig = async () => {
        try {
            const res = await fetch('/api/admin/pricing-config');
            if (res.ok) {
                const data = await res.json();
                setConfig(data);
            }
        } catch (error) {
            console.error('Errore caricamento config:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await fetch('/api/admin/pricing-config', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config),
            });
            alert('✅ Configurazione salvata!');
        } catch (error) {
            alert('❌ Errore nel salvataggio');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center"><Loader2 size={40} className="animate-spin text-orange-500" /></div>;
    }

    // Calcola esempio con i parametri attuali
    const esempioBase = config.base;
    const esempioImporto = 5000000 * config.pesoImporto;
    const esempioComplessita = 2 * config.pesoComplessita; // Alta complessità
    const esempioTotale = esempioBase + esempioImporto + esempioComplessita;

    return (
        <div className="min-h-screen bg-[#f8fafc]">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <Link href="/admin/dashboard" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 mb-2">
                            <ArrowLeft size={16} /> Torna alla dashboard
                        </Link>
                        <h1 className="text-3xl font-bold text-[#1a2744]">Configurazione Pricing L3</h1>
                        <p className="text-gray-500">Regola i parametri del motore di pricing per progetti complessi</p>
                    </div>
                </div>

                <div className="space-y-6">
                    {/* Parametri Base */}
                    <div className="bg-white rounded-2xl border border-gray-100 p-6">
                        <h2 className="text-lg font-bold text-[#1a2744] mb-4 flex items-center gap-2">
                            <Settings2 size={20} className="text-orange-500" /> Parametri di Calcolo
                        </h2>

                        <div className="grid md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Fee Base (€)
                                </label>
                                <input
                                    type="number"
                                    value={config.base}
                                    onChange={(e) => setConfig({ ...config, base: parseInt(e.target.value) })}
                                    className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                                />
                                <p className="text-xs text-gray-500 mt-1">Costo fisso di partenza per ogni progetto L3</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Peso Importo Operazione (%)
                                </label>
                                <input
                                    type="number"
                                    step="0.001"
                                    value={config.pesoImporto}
                                    onChange={(e) => setConfig({ ...config, pesoImporto: parseFloat(e.target.value) })}
                                    className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    Percentuale sull'importo dell'operazione richiesta (es. 1.5% = 0.015)
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Peso Complessità (€ per punto)
                                </label>
                                <input
                                    type="number"
                                    value={config.pesoComplessita}
                                    onChange={(e) => setConfig({ ...config, pesoComplessita: parseInt(e.target.value) })}
                                    className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    Valore in € per ogni punto di complessità (bassa=0, media=1, alta=2)
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Moltiplicatore Urgenza (x)
                                </label>
                                <input
                                    type="number"
                                    step="0.05"
                                    value={config.pesoUrgenza}
                                    onChange={(e) => setConfig({ ...config, pesoUrgenza: parseFloat(e.target.value) })}
                                    className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    Moltiplicatore per progetti urgenti (es. 1.25 = +25%)
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Settori Complessi */}
                    <div className="bg-white rounded-2xl border border-gray-100 p-6">
                        <h2 className="text-lg font-bold text-[#1a2744] mb-4">Settori ad Alta Complessità</h2>
                        <p className="text-sm text-gray-600 mb-4">
                            Questi settori ricevono automaticamente +1 punto di complessità. Separali con virgola.
                        </p>
                        <textarea
                            value={config.settoriComplessi.join(', ')}
                            onChange={(e) => setConfig({ ...config, settoriComplessi: e.target.value.split(',').map(s => s.trim()) })}
                            rows={3}
                            className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 resize-none"
                            placeholder="m&a, ristrutturazione debito, acquisizione..."
                        />
                    </div>

                    {/* Esempio di Calcolo */}
                    <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-2xl border border-orange-200 p-6">
                        <h2 className="text-lg font-bold text-[#1a2744] mb-4 flex items-center gap-2">
                            <TrendingUp size={20} className="text-orange-600" /> Esempio di Calcolo
                        </h2>
                        <p className="text-sm text-gray-700 mb-4">
                            Progetto con: Importo €5M, Alta complessità, Tempistiche standard
                        </p>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between p-2 bg-white rounded-lg">
                                <span>Fee base:</span>
                                <span className="font-semibold">€{esempioBase.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between p-2 bg-white rounded-lg">
                                <span>Componente importo (€5M × {(config.pesoImporto * 100).toFixed(1)}%):</span>
                                <span className="font-semibold">€{Math.round(esempioImporto).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between p-2 bg-white rounded-lg">
                                <span>Componente complessità (2 punti × €{config.pesoComplessita.toLocaleString()}):</span>
                                <span className="font-semibold">€{esempioComplessita.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between p-3 bg-[#1a2744] text-white rounded-lg font-bold">
                                <span>Totale stimato:</span>
                                <span>€{Math.round(esempioTotale).toLocaleString()}</span>
                            </div>
                        </div>
                    </div>

                    {/* Save Button */}
                    <div className="flex justify-end">
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex items-center gap-2 px-8 py-3 rounded-xl bg-[#1a2744] text-white hover:bg-[#0f3460] font-bold shadow-lg shadow-blue-900/20 disabled:opacity-50 transition-all"
                        >
                            {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                            Salva Configurazione
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
