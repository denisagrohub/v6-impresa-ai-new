// src/app/admin/settings/system/page.tsx
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    Loader2, ArrowLeft, Save, CheckCircle2, AlertCircle,
    Server, Database, Key, Eye, EyeOff, RefreshCw,
    FlaskConical, AlertTriangle, Upload, Terminal, Play, Shield, Video, Brain
} from "lucide-react";

export default function SystemSettingsPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [showApiKey, setShowApiKey] = useState(false);
    const [status, setStatus] = useState<{ type: 'success' | 'error' | 'idle', msg: string }>({ type: 'idle', msg: '' });

    // Configurazione Odoo API
    const [config, setConfig] = useState({
        useOdoo: false,
        odooUrl: '',
        odooDb: '',
        odooApiKey: '',
        activeBrand: 'progetto-impresa',
        whitelabelEnabled: false,
        callAI: {
            dailyApiKey: '',
            deepgramApiKey: '',
            anthropicApiKey: '',
            groqApiKey: '',
            aiProvider: 'claude',
            enabled: false
        }
    });

    // Configurazione Deploy SSH
    const [deployConfig, setDeployConfig] = useState({
        vpsHost: '',
        vpsUser: 'root',
        vpsSshPort: 22,
        vpsSshKeyPath: '~/.ssh/id_rsa',
        odooAddonsPath: '/opt/odoo/custom_addons',
        odooService: 'odoo',
        odooUser: 'odoo'
    });

    // Stato Deploy
    const [deploying, setDeploying] = useState(false);
    const [deployLog, setDeployLog] = useState<string[]>([]);
    const [selectedModule, setSelectedModule] = useState<string>('all');

    const [demoMode, setDemoMode] = useState(true);
    const [demoStats, setDemoStats] = useState<any>(null);
    const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
    const [adminPassword, setAdminPassword] = useState('');

    useEffect(() => {
        const session = localStorage.getItem("odoo_session");
        if (!session) {
            router.push("/admin/login");
        } else {
            loadSettings();
        }
    }, [router]);

    useEffect(() => {
        fetch('/api/admin/demo-mode')
            .then(res => res.json())
            .then(data => {
                setDemoMode(data.demoMode);
                setDemoStats(data.stats);
            });
    }, []);

    const loadSettings = async () => {
        try {
            const res = await fetch('/api/admin/settings');
            if (res.ok) {
                const data = await res.json();
                setConfig(data);

                // Carica anche configurazione deploy se presente
                if (data.deploy) {
                    setDeployConfig(data.deploy);
                }
            }
        } catch (error) {
            console.error('Errore caricamento impostazioni:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        setStatus({ type: 'idle', msg: '' });
        try {
            const payload = {
                ...config,
                deploy: deployConfig
            };

            const res = await fetch('/api/admin/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (res.ok) {
                setStatus({ type: 'success', msg: 'Impostazioni salvate con successo!' });
            } else {
                setStatus({ type: 'error', msg: 'Errore nel salvataggio.' });
            }
        } catch (error) {
            setStatus({ type: 'error', msg: 'Errore di connessione.' });
        } finally {
            setSaving(false);
        }
    };

    const handleTestConnection = async () => {
        setTesting(true);
        setStatus({ type: 'idle', msg: '' });
        try {
            const res = await fetch('/api/admin/test-odoo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: config.odooUrl,
                    db: config.odooDb,
                    key: config.odooApiKey
                }),
            });
            const data = await res.json();
            if (data.success) {
                setStatus({ type: 'success', msg: `✅ Connessione riuscita! Database: ${data.dbName}` });
            } else {
                setStatus({ type: 'error', msg: `❌ Connessione fallita: ${data.error}` });
            }
        } catch (error) {
            setStatus({ type: 'error', msg: 'Errore durante il test.' });
        } finally {
            setTesting(false);
        }
    };

    const handleTestSSH = async () => {
        setTesting(true);
        setDeployLog([]);
        try {
            const res = await fetch('/api/admin/deploy-odoo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'test',
                    config: deployConfig
                }),
            });
            const data = await res.json();
            if (data.success) {
                setDeployLog(['✅ Connessione SSH riuscita!', ...data.log]);
            } else {
                setDeployLog(['❌ Connessione SSH fallita!', ...data.log]);
            }
        } catch (error) {
            setDeployLog(['❌ Errore durante il test SSH']);
        } finally {
            setTesting(false);
        }
    };

    const handleDeploy = async () => {
        if (!confirm(`Sei sicuro di voler deployare ${selectedModule === 'all' ? 'tutti i moduli' : `il modulo ${selectedModule}`}?\n\nQuesta azione copierà i file sul VPS e riavvierà Odoo.`)) {
            return;
        }

        setDeploying(true);
        setDeployLog(['🚀 Avvio deploy...']);

        try {
            const res = await fetch('/api/admin/deploy-odoo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'deploy',
                    config: deployConfig,
                    modules: selectedModule === 'all' ? null : [selectedModule]
                }),
            });

            const data = await res.json();

            if (data.success) {
                setDeployLog(prev => [...prev, ...data.log, '✅ Deploy completato con successo!']);
            } else {
                setDeployLog(prev => [...prev, ...data.log, '❌ Deploy fallito']);
            }
        } catch (error) {
            setDeployLog(prev => [...prev, `❌ Errore: ${error}`]);
        } finally {
            setDeploying(false);
        }
    };

    const handleDemoToggle = (newValue: boolean) => {
        if (!newValue && demoMode) {
            setShowPasswordConfirm(true);
        } else {
            handleSaveDemoMode(newValue);
        }
    };

    const handleSaveDemoMode = async (newValue: boolean) => {
        try {
            const res = await fetch('/api/admin/demo-mode', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    demoMode: newValue,
                    adminPassword: adminPassword || 'admin123'
                }),
            });
            const data = await res.json();
            if (data.success) {
                setDemoMode(newValue);
                if (data.deletedData) {
                    alert(`✅ Modalità Produzione attivata.\n\nCancellati:\n- ${data.deletedData.deleted.invoices} fatture demo\n- ${data.deletedData.deleted.payments} pagamenti demo`);
                }
                const statsRes = await fetch('/api/admin/demo-mode');
                const statsData = await statsRes.json();
                setDemoStats(statsData.stats);
            } else {
                alert('❌ ' + data.error);
            }
        } catch (error) {
            alert('❌ Errore di connessione');
        } finally {
            setShowPasswordConfirm(false);
            setAdminPassword('');
        }
    };

    const handleConfirmSwitch = () => {
        handleSaveDemoMode(false);
    };

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center"><Loader2 size={40} className="animate-spin text-orange-500" /></div>;
    }

    return (
        <div className="min-h-screen bg-[#f8fafc]">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <Link href="/admin/dashboard" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 mb-2">
                            <ArrowLeft size={16} /> Torna alla dashboard
                        </Link>
                        <h1 className="text-3xl font-bold text-[#1a2744]">Impostazioni Sistema</h1>
                        <p className="text-gray-500">Configurazione backend, deploy e connessioni</p>
                    </div>
                </div>

                {/* Status Alert */}
                {status.type !== 'idle' && (
                    <div className={`mb-6 p-4 rounded-xl border flex items-center gap-3 ${status.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'
                        }`}>
                        {status.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
                        <span className="font-medium">{status.msg}</span>
                    </div>
                )}

                <div className="space-y-6">
                    {/* Sezione 1: Modalità Backend */}
                    <div className="bg-white rounded-2xl border border-gray-100 p-6">
                        <h2 className="text-lg font-bold text-[#1a2744] mb-4 flex items-center gap-2">
                            <Server size={20} className="text-orange-500" /> Modalità Backend
                        </h2>
                        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                            <div>
                                <div className="font-semibold text-[#1a2744]">Usa Odoo come Database</div>
                                <div className="text-sm text-gray-500">Se disattivato, il sistema userà il database locale (JSON)</div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={config.useOdoo}
                                    onChange={(e) => setConfig({ ...config, useOdoo: e.target.checked })}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                            </label>
                        </div>
                    </div>

                    {/* Sezione 2: Credenziali Odoo API */}
                    {config.useOdoo && (
                        <div className="bg-white rounded-2xl border border-gray-100 p-6 animate-in fade-in slide-in-from-top-4">
                            <h2 className="text-lg font-bold text-[#1a2744] mb-4 flex items-center gap-2">
                                <Database size={20} className="text-orange-500" /> Credenziali Odoo API
                            </h2>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">URL Odoo</label>
                                    <input
                                        type="text"
                                        value={config.odooUrl}
                                        onChange={(e) => setConfig({ ...config, odooUrl: e.target.value })}
                                        placeholder="https://tua-azienda.odoo.com"
                                        className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Nome Database</label>
                                        <input
                                            type="text"
                                            value={config.odooDb}
                                            onChange={(e) => setConfig({ ...config, odooDb: e.target.value })}
                                            placeholder="tua-azienda"
                                            className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
                                        <div className="relative">
                                            <input
                                                type={showApiKey ? "text" : "password"}
                                                value={config.odooApiKey}
                                                onChange={(e) => setConfig({ ...config, odooApiKey: e.target.value })}
                                                placeholder="••••••••••••••••"
                                                className="w-full px-4 py-2 pr-10 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowApiKey(!showApiKey)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                            >
                                                {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 pt-2">
                                    <button
                                        onClick={handleTestConnection}
                                        disabled={testing || !config.odooUrl}
                                        className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-sm font-medium disabled:opacity-50"
                                    >
                                        {testing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                                        Test Connessione API
                                    </button>
                                    <span className="text-xs text-gray-400">Verifica le credenziali API prima di salvare</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Sezione 3: Deploy Moduli Odoo (visibile solo se useOdoo è attivo) */}
                    {config.useOdoo && (
                        <div className="bg-white rounded-2xl border border-gray-100 p-6 animate-in fade-in slide-in-from-top-4">
                            <h2 className="text-lg font-bold text-[#1a2744] mb-4 flex items-center gap-2">
                                <Upload size={20} className="text-purple-500" /> Deploy Moduli Odoo (VPS Aruba)
                            </h2>

                            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
                                <div className="flex items-start gap-3">
                                    <Shield size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
                                    <div className="text-sm text-blue-900">
                                        <strong>Nota:</strong> Il deploy copia i moduli dalla cartella <code className="bg-white px-1 rounded">odoo-modules/</code> del progetto al VPS e riavvia Odoo.
                                        Assicurati di aver configurato l'accesso SSH prima di procedere.
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                {/* Credenziali SSH */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Host VPS</label>
                                        <input
                                            type="text"
                                            value={deployConfig.vpsHost}
                                            onChange={(e) => setDeployConfig({ ...deployConfig, vpsHost: e.target.value })}
                                            placeholder="xxx.xxx.xxx.xxx"
                                            className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Utente SSH</label>
                                        <input
                                            type="text"
                                            value={deployConfig.vpsUser}
                                            onChange={(e) => setDeployConfig({ ...deployConfig, vpsUser: e.target.value })}
                                            placeholder="root"
                                            className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Porta SSH</label>
                                        <input
                                            type="number"
                                            value={deployConfig.vpsSshPort}
                                            onChange={(e) => setDeployConfig({ ...deployConfig, vpsSshPort: parseInt(e.target.value) })}
                                            className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Path Chiave SSH</label>
                                        <input
                                            type="text"
                                            value={deployConfig.vpsSshKeyPath}
                                            onChange={(e) => setDeployConfig({ ...deployConfig, vpsSshKeyPath: e.target.value })}
                                            placeholder="~/.ssh/id_rsa"
                                            className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                                        />
                                    </div>
                                </div>

                                {/* Configurazione Odoo sul VPS */}
                                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Percorso Addons Odoo</label>
                                        <input
                                            type="text"
                                            value={deployConfig.odooAddonsPath}
                                            onChange={(e) => setDeployConfig({ ...deployConfig, odooAddonsPath: e.target.value })}
                                            placeholder="/opt/odoo/custom_addons"
                                            className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Servizio Odoo (systemd)</label>
                                        <input
                                            type="text"
                                            value={deployConfig.odooService}
                                            onChange={(e) => setDeployConfig({ ...deployConfig, odooService: e.target.value })}
                                            placeholder="odoo"
                                            className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Utente Odoo</label>
                                        <input
                                            type="text"
                                            value={deployConfig.odooUser}
                                            onChange={(e) => setDeployConfig({ ...deployConfig, odooUser: e.target.value })}
                                            placeholder="odoo"
                                            className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                                        />
                                    </div>
                                </div>

                                {/* Test Connessione SSH */}
                                <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
                                    <button
                                        onClick={handleTestSSH}
                                        disabled={testing || !deployConfig.vpsHost}
                                        className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-sm font-medium disabled:opacity-50"
                                    >
                                        {testing ? <Loader2 size={16} className="animate-spin" /> : <Terminal size={16} />}
                                        Test Connessione SSH
                                    </button>
                                    <span className="text-xs text-gray-400">Verifica che SSH funzioni prima di deployare</span>
                                </div>

                                {/* Deploy Controls */}
                                <div className="pt-4 border-t border-gray-100">
                                    <h3 className="text-sm font-bold text-[#1a2744] mb-3">Deploy Moduli</h3>

                                    <div className="flex items-center gap-3 mb-4">
                                        <select
                                            value={selectedModule}
                                            onChange={(e) => setSelectedModule(e.target.value)}
                                            className="flex-1 px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20 bg-white"
                                        >
                                            <option value="all">Tutti i moduli</option>
                                            <option value="pi_booking">pi_booking</option>
                                            <option value="pi_consulting">pi_consulting (futuro)</option>
                                            <option value="pi_lead_scoring">pi_lead_scoring (futuro)</option>
                                        </select>

                                        <button
                                            onClick={handleDeploy}
                                            disabled={deploying || !deployConfig.vpsHost}
                                            className="flex items-center gap-2 px-6 py-2 rounded-lg bg-purple-600 text-white font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {deploying ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
                                            {deploying ? 'Deploy in corso...' : 'Deploy Ora'}
                                        </button>
                                    </div>

                                    {/* Deploy Log */}
                                    {deployLog.length > 0 && (
                                        <div className="bg-gray-900 rounded-lg p-4 max-h-64 overflow-y-auto">
                                            <div className="font-mono text-xs text-green-400 space-y-1">
                                                {deployLog.map((line, i) => (
                                                    <div key={i}>{line}</div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                    
                    {/* Sezione 3.5: Call AI Configuration */}
                    {config.useOdoo && (
                        <div className="bg-white rounded-2xl border border-gray-100 p-6 animate-in fade-in slide-in-from-top-4">
                            <h2 className="text-lg font-bold text-[#1a2744] mb-4 flex items-center gap-2">
                                <Video size={20} className="text-red-500" /> Call AI Configuration
                            </h2>

                            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
                                <div className="flex items-start gap-3">
                                    <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
                                    <div className="text-sm text-red-900">
                                        <strong>Importante:</strong> Queste API keys sono necessarie per la funzionalità Call AI.
                                        Senza di esse, il pulsante "Call AI" nella dashboard progetto non funzionerà.
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                {/* Toggle Call AI */}
                                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                                    <div>
                                        <div className="font-semibold text-[#1a2744]">Abilita Call AI</div>
                                        <div className="text-sm text-gray-500">Attiva/disattiva la funzionalità Call AI nel sistema</div>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={config.callAI?.enabled || false}
                                            onChange={(e) => setConfig({
                                                ...config,
                                                callAI: { ...config.callAI, enabled: e.target.checked }
                                            })}
                                            className="sr-only peer"
                                        />
                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-500"></div>
                                    </label>
                                </div>

                                {/* Daily.co API Key */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Daily.co API Key
                                        <span className="text-xs text-gray-500 ml-2">(Video Call)</span>
                                    </label>
                                    <input
                                        type="password"
                                        value={config.callAI?.dailyApiKey || ''}
                                        onChange={(e) => setConfig({
                                            ...config,
                                            callAI: { ...config.callAI, dailyApiKey: e.target.value }
                                        })}
                                        placeholder="••••••••••••••••"
                                        className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-red-500/20"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">
                                        Ottieni la key su <a href="https://dashboard.daily.co/developers" target="_blank" className="text-red-600 hover:underline">dashboard.daily.co/developers</a>
                                    </p>
                                </div>

                                {/* Deepgram API Key */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Deepgram API Key
                                        <span className="text-xs text-gray-500 ml-2">(Trascrizione)</span>
                                    </label>
                                    <input
                                        type="password"
                                        value={config.callAI?.deepgramApiKey || ''}
                                        onChange={(e) => setConfig({
                                            ...config,
                                            callAI: { ...config.callAI, deepgramApiKey: e.target.value }
                                        })}
                                        placeholder="••••••••••••••••"
                                        className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-red-500/20"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">
                                        Ottieni la key su <a href="https://console.deepgram.com/" target="_blank" className="text-red-600 hover:underline">console.deepgram.com</a>
                                    </p>
                                </div>

                                {/* Anthropic API Key */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Anthropic API Key
                                        <span className="text-xs text-gray-500 ml-2">(Analisi Pattern AI)</span>
                                    </label>
                                    <input
                                        type="password"
                                        value={config.callAI?.anthropicApiKey || ''}
                                        onChange={(e) => setConfig({
                                            ...config,
                                            callAI: { ...config.callAI, anthropicApiKey: e.target.value }
                                        })}
                                        placeholder="••••••••••••••••"
                                        className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-red-500/20"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">
                                        Ottieni la key su <a href="https://console.anthropic.com/" target="_blank" className="text-red-600 hover:underline">console.anthropic.com</a>
                                    </p>
                                </div>
                                {/* Groq API Key */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Groq API Key
                                        <span className="text-xs text-gray-500 ml-2">(Test Gratuito)</span>
                                    </label>
                                    <input
                                        type="password"
                                        value={config.callAI?.groqApiKey || ''}
                                        onChange={(e) => setConfig({
                                            ...config,
                                            callAI: { ...config.callAI, groqApiKey: e.target.value }
                                        })}
                                        placeholder="gsk_xxxxxxxxxxxxx"
                                        className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-red-500/20"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">
                                        Ottieni la key su <a href="https://console.groq.com/keys" target="_blank" className="text-red-600 hover:underline">console.groq.com/keys</a>
                                    </p>
                                </div>

                                {/* Info costi */}
                                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                                    <div className="flex items-start gap-3">
                                        <div className="text-blue-600 flex-shrink-0">💡</div>
                                        <div className="text-sm text-blue-900">
                                            <strong>Costi stimati:</strong> Per 100 call/mese da 30 minuti:
                                            <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                                                <li>Daily.co: ~$0 (free tier: 2000 min/mese)</li>
                                                <li>Deepgram: ~$13/mese</li>
                                                <li>Anthropic Claude: ~$20-40/mese</li>
                                                <li><strong>Totale: ~$30-50/mese</strong></li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Sezione 4: Configurazione Generale */}
                    <div className="bg-white rounded-2xl border border-gray-100 p-6">
                        <h2 className="text-lg font-bold text-[#1a2744] mb-4 flex items-center gap-2">
                            <Key size={20} className="text-orange-500" /> Configurazione Generale
                        </h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Brand Attivo (Default)</label>
                                <select
                                    value={config.activeBrand}
                                    onChange={(e) => setConfig({ ...config, activeBrand: e.target.value })}
                                    className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 bg-white"
                                >
                                    <option value="progetto-impresa">Progetto Impresa</option>
                                    <option value="zero-sprechi">Zero Sprechi</option>
                                    <option value="manuale-rapido">Manuale Rapido</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    {/* Sezione: Provider AI per Test */}
                    <div className="bg-white rounded-2xl border border-gray-100 p-6">
                        <h2 className="text-lg font-bold text-[#1a2744] mb-4 flex items-center gap-2">
                            <Brain size={20} className="text-purple-500" /> Provider AI per Analisi Pattern
                        </h2>
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
                            <div className="flex items-start gap-3">
                                <div className="text-blue-600 flex-shrink-0">💡</div>
                                <div className="text-sm text-blue-900">
                                    <strong>Nota:</strong> Puoi switchare tra Claude (più accurato, costo ~$0.03/call) e Groq (gratis, più veloce) per i test.
                                    Il cambio è immediato e non richiede riavvio.
                                </div>
                            </div>
                        </div>

                        <div className="grid md:grid-cols-2 gap-4">
                            {/* Claude */}
                            <button
                                onClick={async () => {
                                    try {
                                        const res = await fetch('/api/call/ai-provider', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ provider: 'claude' })
                                        });
                                        if (res.ok) {
                                            alert('✅ Provider cambiato a Claude');
                                            loadSettings();
                                        }
                                    } catch (error) {
                                        alert('❌ Errore cambio provider');
                                    }
                                }}
                                className={`p-6 rounded-xl border-2 text-left transition-all ${config.callAI?.aiProvider === 'claude'
                                        ? 'border-orange-500 bg-orange-50'
                                        : 'border-gray-200 hover:border-orange-300'
                                    }`}
                            >
                                <div className="flex items-center justify-between mb-3">
                                    <div className="font-bold text-[#1a2744] text-lg">Claude (Anthropic)</div>
                                    {config.callAI?.aiProvider === 'claude' && (
                                        <span className="px-2 py-1 rounded-full bg-orange-500 text-white text-xs font-bold">ATTIVO</span>
                                    )}
                                </div>
                                <div className="text-sm text-gray-600 mb-2">Migliore accuratezza, meno allucinazioni</div>
                                <div className="text-xs text-gray-500">Costo: ~$0.03/call • Tempo: 2-3s</div>
                            </button>

                            {/* Groq */}
                            <button
                                onClick={async () => {
                                    try {
                                        const res = await fetch('/api/call/ai-provider', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ provider: 'groq' })
                                        });
                                        if (res.ok) {
                                            alert('✅ Provider cambiato a Groq');
                                            loadSettings();
                                        }
                                    } catch (error) {
                                        alert('❌ Errore cambio provider');
                                    }
                                }}
                                className={`p-6 rounded-xl border-2 text-left transition-all ${config.callAI?.aiProvider === 'groq'
                                        ? 'border-orange-500 bg-orange-50'
                                        : 'border-gray-200 hover:border-orange-300'
                                    }`}
                            >
                                <div className="flex items-center justify-between mb-3">
                                    <div className="font-bold text-[#1a2744] text-lg">Groq (Llama 3.3)</div>
                                    {config.callAI?.aiProvider === 'groq' && (
                                        <span className="px-2 py-1 rounded-full bg-orange-500 text-white text-xs font-bold">ATTIVO</span>
                                    )}
                                </div>
                                <div className="text-sm text-gray-600 mb-2">Più veloce, gratuito per test</div>
                                <div className="text-xs text-gray-500">Costo: Gratis • Tempo: {'<'}1s</div>
                            </button>
                        </div>
                    </div>
                    {/* Sezione Modalità Demo */}
                    <div className="bg-white rounded-2xl border border-gray-100 p-6">
                        <h2 className="text-lg font-bold text-[#1a2744] mb-4 flex items-center gap-2">
                            <FlaskConical size={20} className="text-purple-500" /> Modalità Demo
                        </h2>
                        <div className={`p-4 rounded-xl border ${demoMode ? 'bg-purple-50 border-purple-200' : 'bg-green-50 border-green-200'}`}>
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <div className="font-semibold text-[#1a2744]">
                                        {demoMode ? '🧪 Modalità Demo ATTIVA' : '✅ Modalità Produzione'}
                                    </div>
                                    <div className="text-sm text-gray-600 mt-1">
                                        {demoMode
                                            ? 'I pagamenti sono simulati. I dati non sono reali.'
                                            : 'I pagamenti sono reali. I dati vengono salvati definitivamente.'}
                                    </div>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={demoMode}
                                        onChange={(e) => setDemoMode(e.target.checked)}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-500"></div>
                                </label>
                            </div>

                            {demoMode && demoStats && (
                                <div className="mt-4 p-3 bg-white rounded-lg border border-purple-100">
                                    <div className="text-xs font-semibold text-purple-700 mb-2">Dati Demo Attuali</div>
                                    <div className="grid grid-cols-3 gap-3 text-center">
                                        <div>
                                            <div className="text-2xl font-bold text-[#1a2744]">{demoStats.invoices}</div>
                                            <div className="text-xs text-gray-500">Fatture</div>
                                        </div>
                                        <div>
                                            <div className="text-2xl font-bold text-[#1a2744]">{demoStats.payments}</div>
                                            <div className="text-xs text-gray-500">Pagamenti</div>
                                        </div>
                                        <div>
                                            <div className="text-2xl font-bold text-[#1a2744]">{demoStats.leads}</div>
                                            <div className="text-xs text-gray-500">Lead</div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {demoMode && demoStats && (demoStats.invoices > 0 || demoStats.payments > 0) && (
                                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                                    <div className="flex items-start gap-3">
                                        <AlertTriangle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
                                        <div className="text-sm text-red-800">
                                            <strong>Attenzione:</strong> Passando a Produzione, verranno cancellati:
                                            <ul className="list-disc list-inside mt-1 space-y-0.5">
                                                <li>{demoStats.invoices} fatture demo</li>
                                                <li>{demoStats.payments} pagamenti simulati</li>
                                            </ul>
                                            <p className="mt-2 text-xs">Questa azione è irreversibile.</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {showPasswordConfirm && (
                            <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    🔐 Conferma con password admin
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="password"
                                        value={adminPassword}
                                        onChange={(e) => setAdminPassword(e.target.value)}
                                        placeholder="Password admin"
                                        className="flex-1 px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                                    />
                                    <button
                                        onClick={handleConfirmSwitch}
                                        disabled={!adminPassword}
                                        className="px-6 py-2 rounded-lg bg-[#1a2744] text-white font-medium hover:bg-[#0f3460] disabled:opacity-50"
                                    >
                                        Conferma
                                    </button>
                                    <button
                                        onClick={() => {
                                            setShowPasswordConfirm(false);
                                            setAdminPassword('');
                                            setDemoMode(!demoMode);
                                        }}
                                        className="px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-100"
                                    >
                                        Annulla
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Azioni */}
                    <div className="flex justify-end pt-4">
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex items-center gap-2 px-8 py-3 rounded-xl bg-[#1a2744] text-white hover:bg-[#0f3460] font-bold shadow-lg shadow-blue-900/20 disabled:opacity-50 transition-all"
                        >
                            {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                            Salva Impostazioni
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
