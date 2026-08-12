"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    Loader2, ArrowLeft, AlertTriangle, Euro, Users,
    CheckCircle2, Clock, XCircle, RefreshCw, Edit3
} from "lucide-react";

export default function AdminRequestsPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'risk' | 'transfer' | 'discount'>('risk');
    const [riskReports, setRiskReports] = useState<any[]>([]);
    const [transferRequests, setTransferRequests] = useState<any[]>([]);
    const [discountRequests, setDiscountRequests] = useState<any[]>([]);
    const [stats, setStats] = useState<any>(null);

    useEffect(() => {
        const session = localStorage.getItem("pi_session");
        if (!session || JSON.parse(session).role !== 'admin') {
            router.push("/login");
        } else {
            loadRequests();
        }
    }, [router, activeTab]);

    const loadRequests = async () => {
        setLoading(true);
        try {
            const [riskRes, transferRes, discountRes] = await Promise.all([
                fetch('/api/admin/requests?category=riskReports'),
                fetch('/api/admin/requests?category=transferRequests'),
                fetch('/api/admin/requests?category=discountRequests')
            ]);

            const riskData = await riskRes.json();
            const transferData = await transferRes.json();
            const discountData = await discountRes.json();

            setRiskReports(riskData.items || []);
            setTransferRequests(transferData.items || []);
            setDiscountRequests(discountData.items || []);
            setStats({
                risk: riskData.stats?.riskReports,
                transfer: transferData.stats?.transferRequests,
                discount: discountData.stats?.discountRequests
            });
        } catch (error) {
            console.error('Errore caricamento:', error);
        } finally {
            setLoading(false);
        }
    };

    const updateRequest = async (category: string, id: string, status: string, notes: string = '', newDiscountPercentage?: number) => {
        try {
            const payload: any = { category, id, status, adminNotes: notes };

            if (newDiscountPercentage !== undefined) {
                payload.discountPercentage = newDiscountPercentage;
            }

            await fetch('/api/admin/requests', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            loadRequests();
        } catch (error) {
            alert('Errore aggiornamento');
        }
    };

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center"><Loader2 size={40} className="animate-spin text-orange-500" /></div>;
    }

    const tabs = [
        { id: 'risk', label: 'Segnalazioni', icon: AlertTriangle, count: stats?.risk?.open },
        { id: 'transfer', label: 'Trasferimenti', icon: Users, count: stats?.transfer?.pending },
        { id: 'discount', label: 'Sconti', icon: Euro, count: stats?.discount?.pending },
    ];
    const handleModifyDiscount = async (req: any) => {
        const newPercentage = prompt(`Modifica percentuale sconto (attuale: ${req.discountPercentage}%):`, req.discountPercentage);

        if (newPercentage !== null && !isNaN(Number(newPercentage))) {
            const notes = `Modificato da Admin: approvata nuova percentuale al ${newPercentage}% (originale: ${req.discountPercentage}%)`;
            await updateRequest('category', req.id, 'approved', notes, Number(newPercentage));
        }
    };

    const handleRevokeDiscount = async (req: any) => {
        if (confirm('Sei sicuro di voler stornare e rifiutare questa richiesta? Il consulente dovrà crearne una nuova.')) {
            await updateRequest('category', req.id, 'rejected', 'Stornato da Admin. Richiedere nuova proposta con motivazione aggiornata.');
        }
    };
    return (
        <div className="min-h-screen bg-[#f8fafc]">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <Link href="/admin/dashboard" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 mb-2">
                            <ArrowLeft size={16} /> Torna alla dashboard
                        </Link>
                        <h1 className="text-3xl font-bold text-[#1a2744]">Gestione Richieste & Segnalazioni</h1>
                        <p className="text-gray-500">Triangolo di Heinrich, trasferimenti progetti e richieste sconto</p>
                    </div>
                    <button onClick={loadRequests} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50">
                        <RefreshCw size={16} /> Aggiorna
                    </button>
                </div>

                {/* Tabs */}
                <div className="bg-white rounded-2xl border border-gray-100 p-2 mb-6 flex gap-2">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === tab.id
                                    ? 'bg-[#1a2744] text-white shadow-lg shadow-blue-900/20'
                                    : 'text-gray-600 hover:bg-gray-100'
                                }`}
                        >
                            <tab.icon size={18} />
                            {tab.label}
                            {tab.count !== undefined && tab.count > 0 && (
                                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${activeTab === tab.id ? 'bg-white/20' : 'bg-red-500 text-white'
                                    }`}>
                                    {tab.count}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* TAB: SEGNALAZIONI */}
                {activeTab === 'risk' && (
                    <div className="space-y-4">
                        {riskReports.length === 0 ? (
                            <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
                                <CheckCircle2 size={48} className="mx-auto mb-4 text-green-500" />
                                <h3 className="text-xl font-bold text-[#1a2744] mb-2">Nessuna segnalazione attiva</h3>
                                <p className="text-gray-500">Tutti i progetti procedono senza blocchi</p>
                            </div>
                        ) : (
                            riskReports.map((report) => (
                                <div key={report.id} className={`bg-white rounded-2xl border-2 p-6 ${report.level === 'red' ? 'border-red-300' :
                                        report.level === 'yellow' ? 'border-yellow-300' :
                                            'border-green-300'
                                    }`}>
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white ${report.level === 'red' ? 'bg-red-500' :
                                                    report.level === 'yellow' ? 'bg-yellow-500' :
                                                        'bg-green-500'
                                                }`}>
                                                <AlertTriangle size={24} />
                                            </div>
                                            <div>
                                                <div className="font-bold text-[#1a2744] text-lg">{report.title}</div>
                                                <div className="text-sm text-gray-500">{report.projectName} • {report.consultantName}</div>
                                            </div>
                                        </div>
                                        <span className={`text-xs px-3 py-1 rounded-full font-medium ${report.status === 'open' ? 'bg-orange-100 text-orange-700' :
                                                report.status === 'resolved' ? 'bg-green-100 text-green-700' :
                                                    'bg-gray-100 text-gray-700'
                                            }`}>
                                            {report.status === 'open' ? 'Aperta' : report.status === 'resolved' ? 'Risolta' : 'Ignorata'}
                                        </span>
                                    </div>

                                    <div className="mb-4 p-4 bg-gray-50 rounded-xl">
                                        <div className="text-sm text-gray-700">{report.description}</div>
                                    </div>

                                    {report.status === 'open' && (
                                        <div className="flex gap-3">
                                            <button
                                                onClick={() => updateRequest('category', report.id, 'resolved', 'Segnalazione gestita')}
                                                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-500 text-white font-medium hover:bg-green-600"
                                            >
                                                <CheckCircle2 size={16} /> Segna come Risolta
                                            </button>
                                            <button
                                                onClick={() => updateRequest('category', report.id, 'dismissed', 'Non rilevante')}
                                                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 font-medium"
                                            >
                                                <XCircle size={16} /> Ignora
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                )}

                {/* TAB: TRASFERIMENTI */}
                {activeTab === 'transfer' && (
                    <div className="space-y-4">
                        {transferRequests.map((req) => (
                            <div key={req.id} className="bg-white rounded-2xl border border-gray-100 p-6">
                                <div className="flex items-start justify-between mb-4">
                                    <div>
                                        <div className="font-bold text-[#1a2744] text-lg">{req.projectName}</div>
                                        <div className="text-sm text-gray-500">Richiesto da: {req.requesterName}</div>
                                    </div>
                                    <span className={`text-xs px-3 py-1 rounded-full font-medium ${req.status === 'pending' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'
                                        }`}>
                                        {req.status === 'pending' ? 'In Attesa' : 'Gestita'}
                                    </span>
                                </div>

                                <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                                    <div className="text-sm font-medium text-blue-900 mb-1">Motivazione:</div>
                                    <div className="text-sm text-blue-800">{req.motivation}</div>
                                </div>

                                {req.status === 'pending' && (
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => updateRequest('category', req.id, 'approved', 'Trasferimento approvato')}
                                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-500 text-white font-medium hover:bg-green-600"
                                        >
                                            <CheckCircle2 size={16} /> Approva Trasferimento
                                        </button>
                                        <button
                                            onClick={() => updateRequest('category', req.id, 'rejected', 'Richiesta rifiutata')}
                                            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 font-medium"
                                        >
                                            <XCircle size={16} /> Rifiuta
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* TAB: SCONTI */}
                {activeTab === 'discount' && (
                    <div className="space-y-4">
                        {discountRequests.map((req) => (
                            <div key={req.id} className="bg-white rounded-2xl border border-gray-100 p-6">
                                <div className="flex items-start justify-between mb-4">
                                    <div>
                                        <div className="font-bold text-[#1a2744] text-lg">{req.projectName}</div>
                                        <div className="text-sm text-gray-500">
                                            {req.consultantName} •
                                            <span className={`ml-2 px-2 py-0.5 rounded text-xs font-bold ${req.type === 'self_discount' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
                                                }`}>
                                                {req.type === 'self_discount' ? 'Sconto Proprio' : 'Richiesta Admin'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-2xl font-bold text-orange-600">{req.discountPercentage}%</div>
                                        <span className={`text-xs px-2 py-1 rounded-full ${req.status === 'pending' ? 'bg-orange-100 text-orange-700' :
                                                req.status === 'approved' ? 'bg-green-100 text-green-700' :
                                                    'bg-red-100 text-red-700'
                                            }`}>
                                            {req.status === 'pending' ? 'In Attesa' : req.status === 'approved' ? 'Approvato' : 'Rifiutato'}
                                        </span>
                                    </div>
                                </div>

                                <div className="mb-4 p-4 bg-gray-50 rounded-xl">
                                    <div className="text-sm text-gray-700">{req.motivation}</div>
                                </div>

                                {req.status === 'pending' && req.type === 'admin_request' && (
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => handleModifyDiscount(req)}
                                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors"
                                        >
                                            <Edit3 size={16} /> Modifica e Approva
                                        </button>
                                        <button
                                            onClick={() => handleRevokeDiscount(req)}
                                            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 font-medium transition-colors"
                                        >
                                            <XCircle size={16} /> Storna
                                        </button>
                                    </div>
                                )}

                                {/* Se è uno sconto proprio del consulente, l'admin può solo confermare o stornare */}
                                {req.status === 'pending' && req.type === 'self_discount' && (
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => updateRequest('category', req.id, 'approved', 'Sconto proprio confermato')}
                                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-500 text-white font-medium hover:bg-green-600"
                                        >
                                            <CheckCircle2 size={16} /> Conferma
                                        </button>
                                        <button
                                            onClick={() => handleRevokeDiscount(req)}
                                            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 font-medium"
                                        >
                                            <XCircle size={16} /> Storna
                                        </button>
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
