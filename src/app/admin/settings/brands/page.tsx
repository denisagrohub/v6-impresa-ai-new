"use client";
import WhitelabelUpload from "@/components/admin/WhitelabelUpload";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    Loader2, ArrowLeft, Plus, Edit3, Trash2,
    Save, Eye, Palette, Users, FileText, HelpCircle,
    CheckCircle2, AlertCircle, Image
} from "lucide-react";

export default function BrandsSettingsPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [brands, setBrands] = useState<any[]>([]);
    const [editingBrand, setEditingBrand] = useState<string | null>(null);
    const [formData, setFormData] = useState<any>(null);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

    useEffect(() => {
        const session = localStorage.getItem("odoo_session");
        if (!session) {
            router.push("/admin/login");
        } else {
            loadBrands();
        }
    }, [router]);

    const loadBrands = async () => {
        try {
            const response = await fetch('/api/brands/all');
            const data = await response.json();
            setBrands(data);
        } catch (error) {
            console.error('Errore caricamento brands:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (brandId: string) => {
        const brand = brands.find(b => b.id === brandId);
        if (brand) {
            setEditingBrand(brandId);
            setFormData({ ...brand });
        }
    };

    const handleSave = async () => {
        if (!editingBrand || !formData) return;

        setSaveStatus('saving');
        try {
            // In modalità locale, aggiorna il file JSON
            // In modalità Odoo, chiama l'API Odoo
            const response = await fetch(`/api/brands/${editingBrand}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });

            if (response.ok) {
                setSaveStatus('saved');
                await loadBrands();
                setTimeout(() => {
                    setEditingBrand(null);
                    setSaveStatus('idle');
                }, 1500);
            } else {
                setSaveStatus('error');
            }
        } catch (error) {
            console.error('Errore salvataggio:', error);
            setSaveStatus('error');
        }
    };

    const updateField = (field: string, value: any) => {
        setFormData({ ...formData, [field]: value });
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
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <Link href="/admin/dashboard" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 mb-2">
                            <ArrowLeft size={16} /> Torna alla dashboard
                        </Link>
                        <h1 className="text-3xl font-bold text-[#1a2744]">Gestione Brand</h1>
                        <p className="text-gray-500">Configura i brand, i contenuti e il white-label</p>
                    </div>
                    <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1a2744] text-white hover:bg-[#0f3460] font-medium">
                        <Plus size={18} /> Nuovo brand
                    </button>
                </div>

                {/* System Status */}
                <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-8">
                    <h2 className="text-lg font-bold text-[#1a2744] mb-4">Stato del Sistema</h2>
                    <div className="grid md:grid-cols-3 gap-4">
                        <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
                            <div className={`w-3 h-3 rounded-full ${process.env.NEXT_PUBLIC_USE_ODOO === 'true' ? 'bg-green-500' : 'bg-orange-500'}`} />
                            <div>
                                <div className="font-semibold text-sm">Backend</div>
                                <div className="text-xs text-gray-500">
                                    {process.env.NEXT_PUBLIC_USE_ODOO === 'true' ? 'Odoo (produzione)' : 'Database locale (sviluppo)'}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
                            <div className="w-3 h-3 rounded-full bg-blue-500" />
                            <div>
                                <div className="font-semibold text-sm">Brand Attivo</div>
                                <div className="text-xs text-gray-500">{brands.length} brand configurati</div>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
                            <div className="w-3 h-3 rounded-full bg-purple-500" />
                            <div>
                                <div className="font-semibold text-sm">White-Label</div>
                                <div className="text-xs text-gray-500">
                                    {process.env.NEXT_PUBLIC_WHITELABEL === 'true' ? 'Attivo' : 'Disattivo'}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Lista Brand */}
                <div className="space-y-6">
                    {brands.map((brand) => (
                        <div key={brand.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                            {/* Brand Header */}
                            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div
                                        className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg"
                                        style={{ backgroundColor: brand.colors.primary }}
                                    >
                                        {brand.logo.text}
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-[#1a2744]">{brand.name}</h3>
                                        <p className="text-sm text-gray-500">{brand.tagline}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => handleEdit(brand.id)}
                                        className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-sm font-medium"
                                    >
                                        <Edit3 size={16} /> Modifica
                                    </button>
                                    <div className="flex items-center gap-2">
                                        <Link
                                            href={`/chi-siamo?brand=${brand.id}&preview=true`}
                                            target="_blank"
                                            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-sm font-medium"
                                        >
                                            <Eye size={16} /> Anteprima Chi Siamo
                                        </Link>
                                        <Link
                                            href={`/casi-studio?brand=${brand.id}&preview=true`}
                                            target="_blank"
                                            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-sm font-medium"
                                        >
                                            <Eye size={16} /> Anteprima Casi Studio
                                        </Link>
                                    </div>
                                </div>
                            </div>

                            {/* Form di Editing (se in modalità edit) */}
                            {editingBrand === brand.id && formData && (
                                <div className="p-6 bg-gray-50 space-y-6">
                                    {/* Info Base */}
                                    <div>
                                        <h4 className="font-bold text-[#1a2744] mb-4 flex items-center gap-2">
                                            <FileText size={18} /> Informazioni Base
                                        </h4>
                                        <div className="grid md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Nome Brand</label>
                                                <input
                                                    type="text"
                                                    value={formData.name}
                                                    onChange={(e) => updateField('name', e.target.value)}
                                                    className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Tagline</label>
                                                <input
                                                    type="text"
                                                    value={formData.tagline}
                                                    onChange={(e) => updateField('tagline', e.target.value)}
                                                    className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                                                />
                                            </div>
                                            <div className="md:col-span-2">
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Descrizione</label>
                                                <textarea
                                                    value={formData.description}
                                                    onChange={(e) => updateField('description', e.target.value)}
                                                    rows={3}
                                                    className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 resize-none"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Colori */}
                                    <div>
                                        <h4 className="font-bold text-[#1a2744] mb-4 flex items-center gap-2">
                                            <Palette size={18} /> Colori Brand
                                        </h4>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                            {['primary', 'secondary', 'accent', 'background'].map((color) => (
                                                <div key={color}>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1 capitalize">{color}</label>
                                                    <div className="flex items-center gap-2">
                                                        <input
                                                            type="color"
                                                            value={formData.colors[color]}
                                                            onChange={(e) => updateField('colors', { ...formData.colors, [color]: e.target.value })}
                                                            className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer"
                                                        />
                                                        <input
                                                            type="text"
                                                            value={formData.colors[color]}
                                                            onChange={(e) => updateField('colors', { ...formData.colors, [color]: e.target.value })}
                                                            className="flex-1 px-3 py-2 rounded-lg border border-gray-200 font-mono text-sm"
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    {/* Whitelabel Upload */}
                                    <div>
                                        <h4 className="font-bold text-[#1a2744] mb-4 flex items-center gap-2">
                                            <Image size={18} /> Whitelabel Assets
                                        </h4>
                                        <WhitelabelUpload
                                            brandSlug={brand.id}
                                            currentLogo={formData.assets?.logo}
                                            currentFavicon={formData.assets?.favicon}
                                            onUploadComplete={(type, url) => {
                                                setFormData({
                                                    ...formData,
                                                    assets: {
                                                        ...formData.assets,
                                                        [type]: url
                                                    }
                                                });
                                            }}
                                        />
                                    </div>
                                    {/* Contatti */}
                                    <div>
                                        <h4 className="font-bold text-[#1a2744] mb-4 flex items-center gap-2">
                                            <Users size={18} /> Contatti
                                        </h4>
                                        <div className="grid md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                                <input
                                                    type="email"
                                                    value={formData.contact.email}
                                                    onChange={(e) => updateField('contact', { ...formData.contact, email: e.target.value })}
                                                    className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Telefono</label>
                                                <input
                                                    type="tel"
                                                    value={formData.contact.phone}
                                                    onChange={(e) => updateField('contact', { ...formData.contact, phone: e.target.value })}
                                                    className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Indirizzo</label>
                                                <input
                                                    type="text"
                                                    value={formData.contact.address}
                                                    onChange={(e) => updateField('contact', { ...formData.contact, address: e.target.value })}
                                                    className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Città</label>
                                                <input
                                                    type="text"
                                                    value={formData.contact.city}
                                                    onChange={(e) => updateField('contact', { ...formData.contact, city: e.target.value })}
                                                    className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Azioni */}
                                    <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                                        <div className="flex items-center gap-2">
                                            {saveStatus === 'saved' && (
                                                <span className="flex items-center gap-1 text-sm text-green-600">
                                                    <CheckCircle2 size={16} /> Salvato con successo
                                                </span>
                                            )}
                                            {saveStatus === 'error' && (
                                                <span className="flex items-center gap-1 text-sm text-red-600">
                                                    <AlertCircle size={16} /> Errore nel salvataggio
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => setEditingBrand(null)}
                                                className="px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-100 text-sm font-medium"
                                            >
                                                Annulla
                                            </button>
                                            <button
                                                onClick={handleSave}
                                                disabled={saveStatus === 'saving'}
                                                className="flex items-center gap-2 px-6 py-2 rounded-lg bg-[#1a2744] text-white hover:bg-[#0f3460] font-medium disabled:opacity-50"
                                            >
                                                {saveStatus === 'saving' ? (
                                                    <Loader2 size={16} className="animate-spin" />
                                                ) : (
                                                    <Save size={16} />
                                                )}
                                                Salva modifiche
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
