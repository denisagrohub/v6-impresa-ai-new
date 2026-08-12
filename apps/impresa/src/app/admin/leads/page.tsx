"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    Loader2, ArrowLeft, RefreshCw, CheckCircle2,
    AlertCircle, Clock, Trash2, Eye
} from "lucide-react";

export default function LeadsQueuePage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [leads, setLeads] = useState<any[]>([]);
    const [syncing, setSyncing] = useState(false);
    const [syncResult, setSyncResult] = useState<{ synced: number; failed: number } | null>(null);

    useEffect(() => {
        const session = localStorage.getItem("odoo_session");
        if (!session) {
            router.push("/admin/login");
        } else {
            loadLeads();
        }
    }, [router]);

    const loadLeads = async () => {
        try {
            const response = await fetch('/api/leads');
            const data = await response.json();
            setLeads(data.leads || []);
        } catch (error) {
            console.error('Errore caricamento lead:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSync = async () => {
        setSyncing(true);
        setSyncResult(null);
        try {
            const response = await fetch('/api/leads', { method: 'PUT' });
            const result = await response.json();
            setSyncResult(result);
            await loadLeads();
        } catch (error) {
            console.error('Errore sincronizzazione:', error);
        } finally {
            setSyncing(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 size={40} className="animate-spin text-orange-500" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f8fafc]">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <Link href="/admin/dashboard" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 mb-2">
                            <ArrowLeft size={16} /> Torna alla dashboard
                        </Link>
                        <h1 className="text-3xl font-bold text-[#1a2744]">Coda Lead</h1>
                        <p className="text-gray-500">Lead in attesa di sincronizzazione con Odoo</p>
                    </div>
                    <button
                        onClick={handleSync}
                        disabled={syncing || leads.length === 0}
                        className="flex items-center gap-2 px-6 py-3 rounded-lg bg-[#1a2744] text-white hover:bg-[#0f3460] font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {syncing ? (
                            <Loader2 size={18} className="animate-spin" />
                        ) : (
                            <RefreshCw size={18} />
                        )}
                        Sincronizza con Odoo
                    </button>
                </div>

                {/* Status */}
                {syncResult && (
                    <div className={`mb-6 p-4 rounded-xl border ${syncResult.failed > 0 ? 'bg-orange-50 border-orange-200' : 'bg-green-50 border-green-200'}`}>
                        <div className="flex items-center gap-2">
                            {syncResult.failed > 0 ? (
                                <AlertCircle size={20} className="text-orange-600" />
                            ) : (
                                <CheckCircle2 size={20} className="text-green-600" />
                            )}
                            <span className="font-medium">
                                {syncResult.synced} lead sincronizzati, {syncResult.failed} falliti
                            </span>
                        </div>
                    </div>
                )}

                {/* Lista lead */}
                {leads.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
                        <CheckCircle2 size={48} className="mx-auto mb-4 text-green-500" />
                        <h3 className="text-xl font-bold text-[#1a2744] mb-2">Nessun lead in coda</h3>
                        <p className="text-gray-500">Tutti i lead sono stati sincronizzati con Odoo</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {leads.map((lead) => (
                            <div key={lead.id} className="bg-white rounded-2xl border border-gray-100 p-6">
                                <div className="flex items-start justify-between mb-4">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-mono text-sm text-gray-500">{lead.id}</span>
                                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${lead.source === 'l1' ? 'bg-blue-100 text-blue-700' :
                                                    lead.source === 'l2' ? 'bg-orange-100 text-orange-700' :
                                                        lead.source === 'l3' ? 'bg-purple-100 text-purple-700' :
                                                            'bg-gray-100 text-gray-700'
                                                }`}>
                                                {lead.source.toUpperCase()}
                                            </span>
                                        </div>
                                        <div className="text-sm text-gray-500">
                                            {new Date(lead.timestamp).toLocaleString('it-IT')}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {lead.syncAttempts > 0 && (
                                            <span className="text-xs text-gray-500">
                                                Tentativi: {lead.syncAttempts}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="bg-gray-50 rounded-xl p-4 mb-4">
                                    <pre className="text-xs text-gray-700 overflow-x-auto">
                                        {JSON.stringify(lead.data, null, 2)}
                                    </pre>
                                </div>

                                {lead.error && (
                                    <div className="flex items-center gap-2 text-sm text-red-600 mb-4">
                                        <AlertCircle size={16} />
                                        <span>{lead.error}</span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
