"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, User, FileText, CheckCircle, Copy, Loader2 } from "lucide-react";

export default function NewConsultantPage() {
    const router = useRouter();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [onboardingLink, setOnboardingLink] = useState("");
    const [copied, setCopied] = useState(false);

    const [formData, setFormData] = useState({
        name: "", email: "", phone: "", company: "", vatNumber: "",
        contractType: "percentage", commissionRate: 10, fixedFee: 0, hourlyRate: 100, maxDiscount: 5,
        specialties: [] as string[]
    });

    const updateField = (field: string, value: any) => {
        setFormData({ ...formData, [field]: value });
    };

    const handleSubmit = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/consultants/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            const data = await res.json();
            if (data.success) {
                setOnboardingLink(data.onboardingLink);
                setStep(3);
            }
        } catch (error) {
            alert("Errore durante la creazione");
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(onboardingLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="min-h-screen bg-[#f8fafc]">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <Link href="/admin/partners" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 mb-6">
                    <ArrowLeft size={16} /> Torna ai Partner
                </Link>

                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
                    {/* Header */}
                    <div className="mb-8">
                        <h1 className="text-2xl font-bold text-[#1a2744]">Nuovo Consulente</h1>
                        <p className="text-gray-500 text-sm mt-1">Step {step} di 3</p>
                        <div className="w-full h-2 bg-gray-100 rounded-full mt-3">
                            <div className="h-full bg-orange-500 rounded-full transition-all" style={{ width: `${(step / 3) * 100}%` }}></div>
                        </div>
                    </div>

                    {/* Step 1: Anagrafica */}
                    {step === 1 && (
                        <div className="space-y-4">
                            <h2 className="text-lg font-semibold text-[#1a2744] flex items-center gap-2"><User size={20} /> Dati Anagrafici</h2>
                            <div className="grid md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo *</label>
                                    <input type="text" value={formData.name} onChange={(e) => updateField('name', e.target.value)} className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-orange-500/20" placeholder="Mario Rossi" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                                    <input type="email" value={formData.email} onChange={(e) => updateField('email', e.target.value)} className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-orange-500/20" placeholder="mario@esempio.it" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Telefono</label>
                                    <input type="text" value={formData.phone} onChange={(e) => updateField('phone', e.target.value)} className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-orange-500/20" placeholder="+39 333 1234567" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Azienda / P.IVA</label>
                                    <input type="text" value={formData.company} onChange={(e) => updateField('company', e.target.value)} className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-orange-500/20" placeholder="Nome Azienda" />
                                </div>
                            </div>
                            <div className="flex justify-end mt-6">
                                <button onClick={() => setStep(2)} className="px-6 py-2 bg-[#1a2744] text-white rounded-lg font-medium hover:bg-[#0f3460]">Avanti</button>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Contratto */}
                    {step === 2 && (
                        <div className="space-y-4">
                            <h2 className="text-lg font-semibold text-[#1a2744] flex items-center gap-2"><FileText size={20} /> Condizioni Contrattuali</h2>
                            <div className="grid md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Tipo Contratto</label>
                                    <select value={formData.contractType} onChange={(e) => updateField('contractType', e.target.value)} className="w-full px-4 py-2 rounded-lg border border-gray-200 bg-white">
                                        <option value="percentage">Solo % Provvigione</option>
                                        <option value="fixed_plus_percentage">Fisso + % Provvigione</option>
                                        <option value="fixed">Solo Fisso</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Tariffa Oraria (€)</label>
                                    <input type="number" value={formData.hourlyRate} onChange={(e) => updateField('hourlyRate', e.target.value)} className="w-full px-4 py-2 rounded-lg border border-gray-200" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">% Provvigione</label>
                                    <input type="number" value={formData.commissionRate} onChange={(e) => updateField('commissionRate', e.target.value)} className="w-full px-4 py-2 rounded-lg border border-gray-200" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Sconto Max Concedibile (%)</label>
                                    <input type="number" value={formData.maxDiscount} onChange={(e) => updateField('maxDiscount', e.target.value)} className="w-full px-4 py-2 rounded-lg border border-gray-200" />
                                </div>
                            </div>
                            <div className="flex justify-between mt-6">
                                <button onClick={() => setStep(1)} className="px-6 py-2 border border-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-50">Indietro</button>
                                <button onClick={handleSubmit} disabled={loading} className="px-6 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 flex items-center gap-2">
                                    {loading ? <Loader2 size={18} className="animate-spin" /> : 'Genera Link di Invito'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Link Generato */}
                    {step === 3 && (
                        <div className="text-center space-y-6">
                            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                                <CheckCircle size={32} className="text-green-600" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-[#1a2744]">Consulente Creato con Successo!</h2>
                                <p className="text-gray-500 mt-2">Copia il link sottostante e invialo via email o WhatsApp al consulente. Il link scadrà tra 7 giorni.</p>
                            </div>

                            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex items-center justify-between gap-4">
                                <code className="text-sm text-gray-700 break-all text-left flex-1">{onboardingLink}</code>
                                <button onClick={copyToClipboard} className="px-4 py-2 bg-[#1a2744] text-white rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-[#0f3460] whitespace-nowrap">
                                    <Copy size={16} /> {copied ? 'Copiato!' : 'Copia'}
                                </button>
                            </div>

                            <button onClick={() => router.push('/admin/partners')} className="mt-4 text-gray-500 hover:text-gray-900 text-sm font-medium">
                                Torna alla lista Partner
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
