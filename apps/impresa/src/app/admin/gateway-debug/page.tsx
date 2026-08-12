"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, ArrowLeft, CheckCircle2, AlertCircle, Server } from "lucide-react";

export default function GatewayDebugPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [features, setFeatures] = useState<any[]>([]);
    const [testResults, setTestResults] = useState<Record<string, any>>({});

    useEffect(() => {
        const session = localStorage.getItem("odoo_session");
        if (!session) router.push("/admin/login");
        else loadFeatures();
    }, [router]);

    const loadFeatures = async () => {
        try {
            const res = await fetch('/api/gateway/_list');
            const data = await res.json();
            setFeatures(data.features || []);
        } catch (error) {
            console.error('Errore:', error);
        } finally {
            setLoading(false);
        }
    };

    const testFeature = async (featureId: string) => {
        try {
            const res = await fetch(`/api/gateway/${featureId}`);
            const data = await res.json();
            setTestResults(prev => ({ ...prev, [featureId]: { success: true, data } }));
        } catch (error) {
            setTestResults(prev => ({ ...prev, [featureId]: { success: false, error: String(error) } }));
        }
    };

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center"><Loader2 size={40} className="animate-spin text-orange-500" /></div>;
    }

    return (
        <div className="min-h-screen bg-[#f8fafc]">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="mb-8">
                    <Link href="/admin/dashboard" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 mb-2">
                        <ArrowLeft size={16} /> Torna alla dashboard
                    </Link>
                    <h1 className="text-3xl font-bold text-[#1a2744]">Gateway Debug</h1>
                    <p className="text-gray-500">Testa tutte le feature del gateway centrale</p>
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 p-6">
                    <h2 className="text-lg font-bold text-[#1a2744] mb-4 flex items-center gap-2">
                        <Server size={20} className="text-orange-500" /> Feature Disponibili
                    </h2>

                    <div className="space-y-3">
                        {features.map((feature) => (
                            <div key={feature.id} className="flex items-center justify-between p-4 rounded-xl border border-gray-200 hover:border-orange-300 transition-colors">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <code className="text-sm font-mono font-bold text-[#1a2744]">{feature.id}</code>
                                        {feature.hasOdooEndpoint && (
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
                                                Odoo ✓
                                            </span>
                                        )}
                                        {feature.requiresId && (
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
                                                Richiede ID
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-sm text-gray-600">{feature.description}</div>

                                    {testResults[feature.id] && (
                                        <div className={`mt-2 p-2 rounded-lg text-xs ${testResults[feature.id].success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
                                            }`}>
                                            {testResults[feature.id].success ? (
                                                <div className="flex items-center gap-1">
                                                    <CheckCircle2 size={12} /> OK - {JSON.stringify(testResults[feature.id].data).substring(0, 100)}...
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-1">
                                                    <AlertCircle size={12} /> Errore: {testResults[feature.id].error}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <button
                                    onClick={() => testFeature(feature.id)}
                                    className="ml-4 px-4 py-2 rounded-lg bg-[#1a2744] text-white text-sm font-medium hover:bg-[#0f3460]"
                                >
                                    Test
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
