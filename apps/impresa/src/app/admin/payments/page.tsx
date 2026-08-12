"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    Loader2, ArrowLeft, CheckCircle2, Clock, AlertCircle,
    Lock, Eye, Edit3, Filter, Download, RefreshCw
} from "lucide-react";

export default function AdminPaymentsPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [invoices, setInvoices] = useState<any[]>([]);
    const [stats, setStats] = useState<any>(null);
    const [filter, setFilter] = useState<'all' | 'pending' | 'paid' | 'overdue'>('all');
    const [showDemo, setShowDemo] = useState(true);
    const [editingInvoice, setEditingInvoice] = useState<any>(null);

    useEffect(() => {
        const session = localStorage.getItem("odoo_session");
        if (!session) router.push("/admin/login");
        else loadPayments();
    }, [router, filter, showDemo]);

    const loadPayments = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filter !== 'all') params.append('status', filter);
            if (!showDemo) params.append('demo', 'false');

            const res = await fetch(`/api/admin/payments?${params}`);
            const data = await res.json();
            setInvoices(data.invoices || []);
            setStats(data.stats);
        } catch (error) {
            console.error('Errore caricamento pagamenti:', error);
        } finally {
            setLoading(false);
        }
    };

    const updateInvoiceStatus = async (invoiceId: string, status: string, paymentMethod?: string) => {
        try {
            const res = await fetch('/api/admin/payments', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ invoiceId, status, paymentMethod }),
            });

            if (res.ok) {
                alert('✅ Fattura aggiornata');
                setEditingInvoice(null);
                loadPayments();
            } else {
                alert('❌ Errore aggiornamento');
            }
        } catch (error) {
            alert('❌ Errore di connessione');
        }
    };

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center"><Loader2 size={40} className="animate-spin text-orange-500" /></div>;
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
                        <h1 className="text-3xl font-bold text-[#1a2744]">Gestione Pagamenti</h1>
                        <p className="text-gray-500">Visualizza e gestisci tutti i pagamenti</p>
                    </div>
                    <button
                        onClick={loadPayments}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-sm font-medium"
                    >
                        <RefreshCw size={16} /> Aggiorna
                    </button>
                </div>

                {/* Stats Cards */}
                {stats && (
                    <div className="grid md:grid-cols-4 gap-6 mb-8">
                        <div className="bg-white rounded-2xl border border-gray-100 p-6">
                            <div className="text-sm text-gray-500 mb-1">Totale Fatture</div>
                            <div className="text-3xl font-bold text-[#1a2744]">{stats.total}</div>
                        </div>
                        <div className="bg-white rounded-2xl border border-gray-100 p-6">
                            <div className="text-sm text-gray-500 mb-1">In Attesa</div>
                            <div className="text-3xl font-bold text-orange-600">{stats.pending}</div>
                        </div>
                        <div className="bg-white rounded-2xl border border-gray-100 p-6">
                            <div className="text-sm text-gray-500 mb-1">Pagate</div>
                            <div className="text-3xl font-bold text-green-600">{stats.paid}</div>
                        </div>
                        <div className="bg-white rounded-2xl border border-gray-100 p-6">
                            <div className="text-sm text-gray-500 mb-1">Importo Totale</div>
                            <div className="text-2xl font-bold text-[#1a2744]">€{stats.totalAmount.toLocaleString()}</div>
                            <div className="text-xs text-gray-500 mt-1">Incassato: €{stats.paidAmount.toLocaleString()}</div>
                        </div>
                    </div>
                )}

                {/* Filtri */}
                <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-6">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <div className="flex items-center gap-2">
                            <Filter size={18} className="text-gray-400" />
                            <select
                                value={filter}
                                onChange={(e) => setFilter(e.target.value as any)}
                                className="px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                            >
                                <option value="all">Tutti</option>
                                <option value="pending">In Attesa</option>
                                <option value="paid">Pagati</option>
                                <option value="overdue">Scaduti</option>
                            </select>
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={showDemo}
                                onChange={(e) => setShowDemo(e.target.checked)}
                                className="rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                            />
                            <span className="text-sm text-gray-700">Mostra dati demo</span>
                        </label>
                    </div>
                </div>

                {/* Lista Fatture */}
                {invoices.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
                        <CheckCircle2 size={48} className="mx-auto mb-4 text-green-500" />
                        <h3 className="text-xl font-bold text-[#1a2744] mb-2">Nessuna fattura trovata</h3>
                        <p className="text-gray-500">Non ci sono fatture con i filtri selezionati</p>
                    </div>
                ) : (
                    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Progetto</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Importo</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stato</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Azioni</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {invoices.map((invoice) => (
                                    <tr key={invoice.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-2">
                                                <code className="text-xs font-mono text-gray-600">{invoice.id}</code>
                                                {invoice.demo && (
                                                    <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">
                                                        DEMO
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-medium text-[#1a2744]">{invoice.clientName}</div>
                                            <div className="text-xs text-gray-500">{invoice.clientEmail}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-gray-900">{invoice.projectCode}</div>
                                            <div className="text-xs text-gray-500">{invoice.level}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-bold text-[#1a2744]">€{invoice.amount.toLocaleString()}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${invoice.status === 'paid' ? 'bg-green-100 text-green-800' :
                                                    invoice.status === 'pending' ? 'bg-orange-100 text-orange-800' :
                                                        invoice.status === 'overdue' ? 'bg-red-100 text-red-800' :
                                                            'bg-gray-100 text-gray-800'
                                                }`}>
                                                {invoice.status === 'paid' && <CheckCircle2 size={12} />}
                                                {invoice.status === 'pending' && <Clock size={12} />}
                                                {invoice.status === 'overdue' && <AlertCircle size={12} />}
                                                {invoice.status === 'bloccato' && <Lock size={12} />}
                                                {invoice.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {invoice.createdAt ? new Date(invoice.createdAt).toLocaleDateString('it-IT') : 'N/A'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button
                                                onClick={() => setEditingInvoice(invoice)}
                                                className="text-orange-600 hover:text-orange-900 mr-3"
                                            >
                                                <Edit3 size={16} />
                                            </button>
                                            <button className="text-gray-600 hover:text-gray-900">
                                                <Eye size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Modal Modifica */}
                {editingInvoice && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-2xl max-w-md w-full p-6">
                            <h3 className="text-xl font-bold text-[#1a2744] mb-4">Modifica Fattura</h3>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">ID</label>
                                    <div className="px-4 py-2 bg-gray-50 rounded-lg text-sm font-mono">{editingInvoice.id}</div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Importo</label>
                                    <div className="px-4 py-2 bg-gray-50 rounded-lg text-sm font-bold">€{editingInvoice.amount.toLocaleString()}</div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Stato</label>
                                    <select
                                        defaultValue={editingInvoice.status}
                                        onChange={(e) => setEditingInvoice({ ...editingInvoice, status: e.target.value })}
                                        className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                                    >
                                        <option value="pending">In Attesa</option>
                                        <option value="paid">Pagato</option>
                                        <option value="overdue">Scaduto</option>
                                        <option value="cancelled">Annullato</option>
                                    </select>
                                </div>

                                {editingInvoice.status === 'paid' && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Metodo Pagamento</label>
                                        <select
                                            defaultValue={editingInvoice.paymentMethod || ''}
                                            onChange={(e) => setEditingInvoice({ ...editingInvoice, paymentMethod: e.target.value })}
                                            className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                                        >
                                            <option value="">Seleziona...</option>
                                            <option value="stripe">Carta di Credito</option>
                                            <option value="bonifico">Bonifico Bancario</option>
                                        </select>
                                    </div>
                                )}

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Note Admin</label>
                                    <textarea
                                        defaultValue={editingInvoice.adminNotes || ''}
                                        onChange={(e) => setEditingInvoice({ ...editingInvoice, adminNotes: e.target.value })}
                                        rows={3}
                                        className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 resize-none"
                                        placeholder="Note interne..."
                                    />
                                </div>
                            </div>

                            <div className="flex items-center gap-3 mt-6">
                                <button
                                    onClick={() => updateInvoiceStatus(
                                        editingInvoice.id,
                                        editingInvoice.status,
                                        editingInvoice.paymentMethod
                                    )}
                                    className="flex-1 px-6 py-3 rounded-xl bg-[#1a2744] text-white font-medium hover:bg-[#0f3460]"
                                >
                                    Salva Modifiche
                                </button>
                                <button
                                    onClick={() => setEditingInvoice(null)}
                                    className="px-6 py-3 rounded-xl border border-gray-200 hover:bg-gray-50 font-medium"
                                >
                                    Annulla
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
