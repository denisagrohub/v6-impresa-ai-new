"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, CheckCircle2 } from "lucide-react";

interface Brand {
    id: number;
    name: string;
}

export default function EditConsultantPage() {
    const params = useParams();
    const router = useRouter();
    const id = params?.id as string;

    const [brands, setBrands] = useState<Brand[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const [form, setForm] = useState({
        name: "", email: "", phone: "", vatNumber: "", fiscalCode: "",
        zone: "", languages: "", specialties: "",
        brandId: "", hourlyRate: "", commissionRate: "", isActive: true,
    });

    useEffect(() => {
        (async () => {
            try {
                const [bRes, cRes] = await Promise.all([
                    fetch('/api/admin/brands'),
                    fetch(`/api/admin/consultants/${id}`),
                ]);
                const bData = await bRes.json();
                const cData = await cRes.json();
                if (bData.success) setBrands(bData.brands || []);
                if (cData.success) {
                    const c = cData.consultant;
                    setForm({
                        name: c.name || "", email: c.email || "", phone: c.phone || "",
                        vatNumber: c.vatNumber || "", fiscalCode: c.fiscalCode || "",
                        zone: c.zone || "", languages: c.languages || "", specialties: c.specialties || "",
                        brandId: c.brandId ? String(c.brandId) : "",
                        hourlyRate: c.hourlyRate ? String(c.hourlyRate) : "",
                        commissionRate: c.commissionRate ? String(c.commissionRate) : "",
                        isActive: c.isActive,
                    });
                } else {
                    setError(cData.error || 'Consulente non trovato');
                }
            } catch (err: any) {
                setError(err.message || 'Errore di rete');
            } finally {
                setLoading(false);
            }
        })();
    }, [id]);

    const updateField = (field: string, value: string | boolean) => setForm({ ...form, [field]: value });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError(null);
        try {
            const res = await fetch(`/api/admin/consultants/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                setError(data.error || 'Modifica fallita');
                return;
            }
            setSuccess(true);
        } catch (err: any) {
            setError(err.message || 'Errore di rete');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
                <Loader2 size={40} className="animate-spin text-orange-500" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f8fafc]">
            <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <Link href="/admin/team" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 mb-6">
                    <ArrowLeft size={16} /> Torna al Team
                </Link>

                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
                    <h1 className="text-2xl font-bold text-[#1a2744] mb-6">Modifica Consulente</h1>

                    {success ? (
                        <div className="rounded-xl bg-green-50 border border-green-200 p-6 text-center">
                            <CheckCircle2 className="mx-auto text-green-600 mb-2" size={32} />
                            <p className="text-green-700 font-semibold">Modifiche salvate.</p>
                            <Link href="/admin/team" className="inline-block mt-4 text-sm text-[#1a2744] font-medium hover:underline">
                                Torna al Team
                            </Link>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
                                    <input required value={form.name} onChange={(e) => updateField('name', e.target.value)}
                                        className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                                    <input required type="email" value={form.email} onChange={(e) => updateField('email', e.target.value)}
                                        className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Telefono</label>
                                    <input value={form.phone} onChange={(e) => updateField('phone', e.target.value)}
                                        className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Partita IVA</label>
                                    <input value={form.vatNumber} onChange={(e) => updateField('vatNumber', e.target.value)}
                                        className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Codice Fiscale</label>
                                    <input value={form.fiscalCode} onChange={(e) => updateField('fiscalCode', e.target.value)}
                                        className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Zona Geografica</label>
                                    <input value={form.zone} onChange={(e) => updateField('zone', e.target.value)}
                                        className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Lingue (es. IT, EN)</label>
                                    <input value={form.languages} onChange={(e) => updateField('languages', e.target.value)}
                                        className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Specializzazioni</label>
                                    <input value={form.specialties} onChange={(e) => updateField('specialties', e.target.value)}
                                        className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20" />
                                </div>
                            </div>

                            <div className="border-t border-gray-100 pt-4">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Brand *</label>
                                <select required value={form.brandId} onChange={(e) => updateField('brandId', e.target.value)}
                                    className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 bg-white">
                                    <option value="">Seleziona un brand</option>
                                    {brands.map((b) => (
                                        <option key={b.id} value={b.id}>{b.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Tariffa Oraria (€)</label>
                                    <input type="number" step="0.01" value={form.hourlyRate} onChange={(e) => updateField('hourlyRate', e.target.value)}
                                        className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Provvigione (%)</label>
                                    <input type="number" step="0.01" value={form.commissionRate} onChange={(e) => updateField('commissionRate', e.target.value)}
                                        className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20" />
                                </div>
                            </div>

                            <label className="flex items-center gap-2 text-sm text-gray-700">
                                <input type="checkbox" checked={form.isActive} onChange={(e) => updateField('isActive', e.target.checked)} />
                                Consulente attivo
                            </label>

                            {error && (
                                <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>
                            )}

                            <button type="submit" disabled={saving}
                                className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-[#1a2744] text-white font-medium hover:bg-[#0f3460] disabled:opacity-50">
                                {saving ? <Loader2 size={18} className="animate-spin" /> : null}
                                Salva Modifiche
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
