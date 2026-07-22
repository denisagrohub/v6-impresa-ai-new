"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
    Loader2, CreditCard, Building2, CheckCircle2,
    AlertCircle, ArrowLeft, Shield, FileText, Clock
} from "lucide-react";

export default function CheckoutPage() {
    const router = useRouter();
    const params = useParams();
    const invoiceId = params.id as string;

    const [loading, setLoading] = useState(true);
    const [invoice, setInvoice] = useState<any>(null);
    const [error, setError] = useState("");
    const [selectedMethod, setSelectedMethod] = useState<'stripe' | 'bonifico' | null>(null);
    const [processing, setProcessing] = useState(false);
    const [success, setSuccess] = useState(false);

    // Carica dati fattura
    useEffect(() => {
        fetch(`/api/payments/${invoiceId}`)
            .then(res => {
                if (!res.ok) throw new Error('Fattura non trovata');
                return res.json();
            })
            .then(data => {
                setInvoice(data);
                setLoading(false);
            })
            .catch(err => {
                setError(err.message);
                setLoading(false);
            });
    }, [invoiceId]);

    const handlePayment = async () => {
        if (!selectedMethod) {
            setError('Seleziona un metodo di pagamento');
            return;
        }

        setProcessing(true);
        setError("");

        try {
            // Simula elaborazione pagamento (2 secondi)
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Aggiorna stato fattura
            const response = await fetch(`/api/payments/${invoiceId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: 'paid',
                    paymentMethod: selectedMethod,
                }),
            });

            if (!response.ok) {
                throw new Error('Errore durante il pagamento');
            }

            setSuccess(true);

            // Redirect alla dashboard dopo 3 secondi
            setTimeout(() => {
                router.push('/dashboard');
            }, 3000);

        } catch (err) {
            setError(err instanceof Error ? err.message : 'Errore sconosciuto');
            setProcessing(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
                <Loader2 size={40} className="animate-spin text-orange-500" />
            </div>
        );
    }

    if (error && !invoice) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
                <div className="max-w-md w-full bg-white rounded-2xl border border-gray-200 p-8 text-center">
                    <AlertCircle size={48} className="mx-auto mb-4 text-red-500" />
                    <h2 className="text-2xl font-bold text-[#1a2744] mb-2">Errore</h2>
                    <p className="text-gray-600 mb-6">{error}</p>
                    <Link href="/dashboard" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#1a2744] text-white font-medium hover:bg-[#0f3460]">
                        <ArrowLeft size={18} /> Torna alla Dashboard
                    </Link>
                </div>
            </div>
        );
    }

    if (success) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
                <div className="max-w-md w-full bg-white rounded-2xl border border-gray-200 p-8 text-center">
                    <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
                        <CheckCircle2 size={48} className="text-green-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-[#1a2744] mb-2">Pagamento Completato!</h2>
                    <p className="text-gray-600 mb-6">
                        Il tuo pagamento di <strong>€{invoice.amount.toLocaleString()}</strong> è stato ricevuto con successo.
                    </p>
                    <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
                        <div className="text-sm text-green-800">
                            <strong>Ricevuta:</strong> {invoice.id}<br />
                            <strong>Data:</strong> {new Date().toLocaleDateString('it-IT')}<br />
                            <strong>Metodo:</strong> {selectedMethod === 'stripe' ? 'Carta di credito' : 'Bonifico bancario'}
                        </div>
                    </div>
                    <p className="text-sm text-gray-500">
                        Verrai reindirizzato alla dashboard tra pochi secondi...
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f8fafc] py-12 px-4">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 mb-4">
                        <ArrowLeft size={16} /> Torna alla Dashboard
                    </Link>
                    <h1 className="text-3xl font-bold text-[#1a2744]">Completa il Pagamento</h1>
                    <p className="text-gray-600 mt-1">Fattura #{invoice.id}</p>
                </div>

                <div className="grid md:grid-cols-3 gap-6">
                    {/* Colonna Sinistra: Riepilogo */}
                    <div className="md:col-span-2 space-y-6">
                        {/* Riepilogo Fattura */}
                        <div className="bg-white rounded-2xl border border-gray-200 p-6">
                            <h2 className="text-xl font-bold text-[#1a2744] mb-4 flex items-center gap-2">
                                <FileText size={20} className="text-orange-500" />
                                Riepilogo Fattura
                            </h2>

                            <div className="space-y-3 text-sm">
                                <div className="flex justify-between pb-3 border-b border-gray-100">
                                    <span className="text-gray-600">Progetto:</span>
                                    <span className="font-semibold text-[#1a2744]">{invoice.projectCode}</span>
                                </div>
                                <div className="flex justify-between pb-3 border-b border-gray-100">
                                    <span className="text-gray-600">Descrizione:</span>
                                    <span className="font-semibold text-[#1a2744]">{invoice.description}</span>
                                </div>
                                <div className="flex justify-between pb-3 border-b border-gray-100">
                                    <span className="text-gray-600">Livello:</span>
                                    <span className="font-semibold text-[#1a2744]">{invoice.level}</span>
                                </div>
                                {invoice.dueDate && (
                                    <div className="flex justify-between pb-3 border-b border-gray-100">
                                        <span className="text-gray-600">Scadenza:</span>
                                        <span className="font-semibold text-orange-600">
                                            {new Date(invoice.dueDate).toLocaleDateString('it-IT')}
                                        </span>
                                    </div>
                                )}
                                <div className="flex justify-between pt-3">
                                    <span className="text-lg font-bold text-[#1a2744]">Totale:</span>
                                    <span className="text-2xl font-bold text-orange-600">
                                        €{invoice.amount.toLocaleString()}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Selezione Metodo Pagamento */}
                        <div className="bg-white rounded-2xl border border-gray-200 p-6">
                            <h2 className="text-xl font-bold text-[#1a2744] mb-4">Metodo di Pagamento</h2>

                            <div className="space-y-3">
                                {/* Carta di Credito */}
                                <button
                                    onClick={() => setSelectedMethod('stripe')}
                                    className={`w-full flex items-center gap-4 p-5 rounded-xl border-2 transition-all text-left ${selectedMethod === 'stripe'
                                            ? 'border-blue-500 bg-blue-50'
                                            : 'border-gray-200 hover:border-blue-300'
                                        }`}
                                >
                                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${selectedMethod === 'stripe' ? 'bg-blue-500' : 'bg-gray-100'
                                        }`}>
                                        <CreditCard size={24} className={selectedMethod === 'stripe' ? 'text-white' : 'text-gray-600'} />
                                    </div>
                                    <div className="flex-1">
                                        <div className="font-bold text-[#1a2744]">Carta di Credito</div>
                                        <div className="text-sm text-gray-500">Pagamento immediato e sicuro</div>
                                    </div>
                                    {selectedMethod === 'stripe' && (
                                        <CheckCircle2 size={24} className="text-blue-500" />
                                    )}
                                </button>

                                {/* Bonifico Bancario */}
                                <button
                                    onClick={() => setSelectedMethod('bonifico')}
                                    className={`w-full flex items-center gap-4 p-5 rounded-xl border-2 transition-all text-left ${selectedMethod === 'bonifico'
                                            ? 'border-orange-500 bg-orange-50'
                                            : 'border-gray-200 hover:border-orange-300'
                                        }`}
                                >
                                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${selectedMethod === 'bonifico' ? 'bg-orange-500' : 'bg-gray-100'
                                        }`}>
                                        <Building2 size={24} className={selectedMethod === 'bonifico' ? 'text-white' : 'text-gray-600'} />
                                    </div>
                                    <div className="flex-1">
                                        <div className="font-bold text-[#1a2744]">Bonifico Bancario</div>
                                        <div className="text-sm text-gray-500">Riceverai le coordinate via email</div>
                                    </div>
                                    {selectedMethod === 'bonifico' && (
                                        <CheckCircle2 size={24} className="text-orange-500" />
                                    )}
                                </button>
                            </div>

                            {/* Dettagli Bonifico (se selezionato) */}
                            {selectedMethod === 'bonifico' && (
                                <div className="mt-4 p-4 bg-orange-50 border border-orange-200 rounded-xl">
                                    <h3 className="font-bold text-[#1a2744] mb-3 text-sm">Coordinate Bancarie</h3>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-gray-600">IBAN:</span>
                                            <span className="font-mono font-semibold text-[#1a2744]">{invoice.iban}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-600">Intestato a:</span>
                                            <span className="font-semibold text-[#1a2744]">Progetto Impresa S.r.l.</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-600">Causale:</span>
                                            <span className="font-mono text-xs text-[#1a2744]">{invoice.id}</span>
                                        </div>
                                    </div>
                                    <p className="text-xs text-gray-600 mt-3">
                                        ⏱️ Il pagamento verrà confermato entro 2-3 giorni lavorativi dalla ricezione del bonifico.
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Errore */}
                        {error && (
                            <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
                                <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
                                <div className="text-sm text-red-800">{error}</div>
                            </div>
                        )}
                    </div>

                    {/* Colonna Destra: Azione */}
                    <div className="md:col-span-1">
                        <div className="bg-white rounded-2xl border border-gray-200 p-6 sticky top-8">
                            <div className="text-center mb-6">
                                <div className="text-sm text-gray-500 mb-1">Importo da pagare</div>
                                <div className="text-4xl font-bold text-orange-600">
                                    €{invoice.amount.toLocaleString()}
                                </div>
                            </div>

                            <button
                                onClick={handlePayment}
                                disabled={!selectedMethod || processing}
                                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[#1a2744] to-[#0f3460] text-white font-bold py-4 rounded-xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {processing ? (
                                    <>
                                        <Loader2 size={20} className="animate-spin" />
                                        Elaborazione...
                                    </>
                                ) : (
                                    <>
                                        <Shield size={20} />
                                        Paga Ora
                                    </>
                                )}
                            </button>

                            <div className="mt-4 pt-4 border-t border-gray-100 text-center">
                                <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
                                    <Clock size={14} />
                                    <span>Scadenza: {invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString('it-IT') : 'N/A'}</span>
                                </div>
                            </div>

                            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                                <div className="flex items-start gap-2 text-xs text-green-800">
                                    <Shield size={14} className="flex-shrink-0 mt-0.5" />
                                    <span>
                                        <strong>Pagamento sicuro.</strong> I tuoi dati sono protetti e crittografati.
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
