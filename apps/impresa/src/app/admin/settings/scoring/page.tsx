"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, ArrowLeft, Save, Target, Users, Shield, AlertCircle } from "lucide-react";

export default function ScoringSettingsPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [config, setConfig] = useState({
        fatturatoAlto: 20,
        fatturatoMedio: 10,
        settoreHot: 10,
        importoOperazioneAlto: 10,
        ruoloDecisionale: 20,
        ruoloOperativo: 10,
        emailAziendale: 10,
        mandatoScritto: 20,
        mandatoVerbale: 5,
        partnerRicorrente: 10,
        sogliaWhale: 80,
        sogliaHot: 50,
        settoriHot: 'tech, finanza, energia, farmaceutico, aerospazio, biotech, fintech, sustainability, green',
        ruoliDecisionali: 'ceo, cfo, owner, fondatore, direttore generale, partner, amministratore, presidente',
    });

    useEffect(() => {
        const session = localStorage.getItem("odoo_session");
        if (!session) router.push("/admin/login");
        else loadConfig();
    }, [router]);

    const loadConfig = async () => {
        try {
            const res = await fetch('/api/admin/scoring-config');
            if (res.ok) setConfig(await res.json());
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await fetch('/api/admin/scoring-config', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config),
            });
            alert('✅ Configurazione scoring salvata!');
        } catch (e) { alert(' Errore'); }
        finally { setSaving(false); }
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 size={40} className="animate-spin text-orange-500" /></div>;

    return (
        <div className="min-h-screen bg-[#f8fafc]">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="mb-8">
                    <Link href="/admin/dashboard" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 mb-2">
                        <ArrowLeft size={16} /> Torna alla dashboard
                    </Link>
                    <h1 className="text-3xl font-bold text-[#1a2744]">Configurazione Lead Scoring</h1>
                    <p className="text-gray-500">Regola i pesi per qualificare automaticamente i lead</p>
                </div>

                <div className="space-y-6">
                    {/* Azienda */}
                    <div className="bg-white rounded-2xl border border-gray-100 p-6">
                        <h2 className="text-lg font-bold text-[#1a2744] mb-4 flex items-center gap-2">
                            <Target size={20} className="text-blue-600" /> Punteggio Azienda (Max 40)
                        </h2>
                        <div className="grid md:grid-cols-2 gap-4">
                            {[
                                { key: 'fatturatoAlto', label: 'Fatturato > 10M€', max: 40 },
                                { key: 'fatturatoMedio', label: 'Fatturato 2-10M€', max: 40 },
                                { key: 'setтореHot', label: 'Settore Hot', max: 40, keyReal: 'settoreHot' },
                                { key: 'importoOperazioneAlto', label: 'Operazione > 5M€', max: 40 },
                            ].map((item) => (
                                <div key={item.key}>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">{item.label}</label>
                                    <input
                                        type="number"
                                        value={(config as any)[item.keyReal || item.key]}
                                        onChange={(e) => setConfig({ ...config, [item.keyReal || item.key]: parseInt(e.target.value) })}
                                        className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Referente */}
                    <div className="bg-white rounded-2xl border border-gray-100 p-6">
                        <h2 className="text-lg font-bold text-[#1a2744] mb-4 flex items-center gap-2">
                            <Users size={20} className="text-green-600" /> Punteggio Referente (Max 30)
                        </h2>
                        <div className="grid md:grid-cols-3 gap-4">
                            {[
                                { key: 'ruoloDecisionale', label: 'Ruolo Decisionale (CEO, CFO...)' },
                                { key: 'ruoloOperativo', label: 'Ruolo Operativo' },
                                { key: 'emailAziendale', label: 'Email Aziendale (non gmail)' },
                            ].map((item) => (
                                <div key={item.key}>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">{item.label}</label>
                                    <input
                                        type="number"
                                        value={(config as any)[item.key]}
                                        onChange={(e) => setConfig({ ...config, [item.key]: parseInt(e.target.value) })}
                                        className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-green-500/20"
                                    />
                                </div>
                            ))}
                        </div>
                        <div className="mt-4">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Ruoli Decisionali (separati da virgola)</label>
                            <input
                                type="text"
                                value={config.ruoliDecisionali}
                                onChange={(e) => setConfig({ ...config, ruoliDecisionali: e.target.value })}
                                className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-green-500/20"
                            />
                        </div>
                    </div>

                    {/* Intermediario */}
                    <div className="bg-white rounded-2xl border border-gray-100 p-6">
                        <h2 className="text-lg font-bold text-[#1a2744] mb-4 flex items-center gap-2">
                            <Shield size={20} className="text-purple-600" /> Punteggio Intermediario (Max 30)
                        </h2>
                        <div className="grid md:grid-cols-3 gap-4">
                            {[
                                { key: 'mandatoScritto', label: 'Mandato Scritto' },
                                { key: 'mandatoVerbale', label: 'Mandato Verbale' },
                                { key: 'partnerRicorrente', label: 'Partner Ricorrente' },
                            ].map((item) => (
                                <div key={item.key}>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">{item.label}</label>
                                    <input
                                        type="number"
                                        value={(config as any)[item.key]}
                                        onChange={(e) => setConfig({ ...config, [item.key]: parseInt(e.target.value) })}
                                        className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Soglie Tier */}
                    <div className="bg-white rounded-2xl border border-gray-100 p-6">
                        <h2 className="text-lg font-bold text-[#1a2744] mb-4 flex items-center gap-2">
                            <AlertCircle size={20} className="text-orange-600" /> Soglie Tier
                        </h2>
                        <div className="grid md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Soglia Whale (minimo)</label>
                                <input
                                    type="number"
                                    value={config.sogliaWhale}
                                    onChange={(e) => setConfig({ ...config, sogliaWhale: parseInt(e.target.value) })}
                                    className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                                />
                                <p className="text-xs text-gray-500 mt-1">Score ≥ di questo valore = Whale (notifica immediata)</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Soglia Hot (minimo)</label>
                                <input
                                    type="number"
                                    value={config.sogliaHot}
                                    onChange={(e) => setConfig({ ...config, sogliaHot: parseInt(e.target.value) })}
                                    className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                                />
                                <p className="text-xs text-gray-500 mt-1">Score ≥ di questo valore = Hot (email entro 2h)</p>
                            </div>
                        </div>
                    </div>

                    {/* Settori Hot */}
                    <div className="bg-white rounded-2xl border border-gray-100 p-6">
                        <h2 className="text-lg font-bold text-[#1a2744] mb-4">Settori "Hot" (bonus punteggio)</h2>
                        <textarea
                            value={config.settoriHot}
                            onChange={(e) => setConfig({ ...config, settoriHot: e.target.value })}
                            rows={2}
                            className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 resize-none"
                            placeholder="tech, finanza, energia..."
                        />
                    </div>

                    <div className="flex justify-end">
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex items-center gap-2 px-8 py-3 rounded-xl bg-[#1a2744] text-white hover:bg-[#0f3460] font-bold shadow-lg disabled:opacity-50"
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
