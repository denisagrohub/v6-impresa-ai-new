"use client";
import type { Route } from 'next';
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    Loader2, ArrowLeft, Plus, Users, Star, UserCheck,
    TrendingUp, DollarSign, Mail, Phone, MoreVertical,
    Crown, Shield, AlertCircle, CheckCircle2
} from "lucide-react";

export default function AdminPartnersPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [partners, setPartners] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState<'all' | 'consultants' | 'referrals' | 'chiefs'>('all');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [actionMenu, setActionMenu] = useState<string | null>(null);

    useEffect(() => {
        const session = localStorage.getItem("odoo_session");
        if (!session) {
            router.push("/admin/login");
        } else {
            loadPartners();
        }
    }, [router]);

    const loadPartners = async () => {
        try {
            const res = await fetch('/api/admin/partners');
            if (res.ok) {
                const data = await res.json();
                setPartners(data.partners || []);
            }
        } catch (error) {
            console.error('Errore caricamento partner:', error);
        } finally {
            setLoading(false);
        }
    };

    const handlePromote = async (partnerId: string, action: 'promote' | 'demote') => {
        if (!confirm(`Sei sicuro di voler ${action === 'promote' ? 'promuovere a Chief' : 'rimuovere da Chief'} questo consulente?`)) {
            return;
        }

        try {
            const res = await fetch(`/api/admin/consultants/${partnerId}/promote`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action })
            });

            const data = await res.json();
            if (data.success) {
                alert(`✅ ${data.message}`);
                loadPartners();
            } else {
                alert(`❌ ${data.error}`);
            }
        } catch (error) {
            alert('❌ Errore di connessione');
        }
        setActionMenu(null);
    };

    // Filtra partner in base al tab attivo
    const filteredPartners = partners.filter(p => {
        if (activeTab === 'all') return true;
        if (activeTab === 'chiefs') return p.type === 'consultant' && p.isChief;
        if (activeTab === 'consultants') return p.type === 'consultant';
        if (activeTab === 'referrals') return p.type === 'referral';
        return true;
    });

    // Statistiche
    const stats = {
        total: partners.length,
        consultants: partners.filter(p => p.type === 'consultant' && !p.isChief).length,
        chiefs: partners.filter(p => p.type === 'consultant' && p.isChief).length,
        referrals: partners.filter(p => p.type === 'referral').length,
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
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <Link href="/admin/dashboard" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 mb-2">
                            <ArrowLeft size={16} /> Torna alla dashboard
                        </Link>
                        <h1 className="text-3xl font-bold text-[#1a2744]">Gestione Partner</h1>
                        <p className="text-gray-500">Consulenti, Chief Consultant e Referral</p>
                    </div>
                    <div className="flex gap-3">
                        <Link
                            href="/admin/consultants/new"
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500 text-white hover:bg-orange-600 font-medium"
                        >
                            <Plus size={18} /> Nuovo Consulente
                        </Link>
                        <Link
                            href={"/admin/referrals/new" as Route}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600 font-medium"
                        >
                            <Plus size={18} /> Nuovo Referral
                        </Link>
                    </div>
                </div>

                {/* Statistiche */}
                <div className="grid md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-white rounded-xl border border-gray-100 p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                                <Users size={20} className="text-gray-600" />
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-[#1a2744]">{stats.total}</div>
                                <div className="text-xs text-gray-500">Totale Partner</div>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white rounded-xl border border-gray-100 p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                                <UserCheck size={20} className="text-orange-600" />
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-[#1a2744]">{stats.consultants}</div>
                                <div className="text-xs text-gray-500">Consulenti</div>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white rounded-xl border border-gray-100 p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-yellow-100 flex items-center justify-center">
                                <Crown size={20} className="text-yellow-600" />
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-[#1a2744]">{stats.chiefs}</div>
                                <div className="text-xs text-gray-500">Chief Consultant</div>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white rounded-xl border border-gray-100 p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                                <TrendingUp size={20} className="text-blue-600" />
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-[#1a2744]">{stats.referrals}</div>
                                <div className="text-xs text-gray-500">Referral</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tab Navigation */}
                <div className="bg-white rounded-xl border border-gray-100 p-2 mb-6 inline-flex gap-1">
                    {[
                        { id: 'all', label: 'Tutti', count: stats.total },
                        { id: 'consultants', label: 'Consulenti', count: stats.consultants },
                        { id: 'chiefs', label: 'Chief Consultant', count: stats.chiefs },
                        { id: 'referrals', label: 'Referral', count: stats.referrals },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === tab.id
                                    ? 'bg-[#1a2744] text-white'
                                    : 'text-gray-600 hover:bg-gray-50'
                                }`}
                        >
                            {tab.label} ({tab.count})
                        </button>
                    ))}
                </div>

                {/* Lista Partner */}
                <div className="space-y-3">
                    {filteredPartners.length === 0 ? (
                        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
                            <Users size={48} className="text-gray-300 mx-auto mb-4" />
                            <p className="text-gray-500">Nessun partner trovato</p>
                        </div>
                    ) : (
                        filteredPartners.map(partner => (
                            <PartnerCard
                                key={partner.id}
                                partner={partner}
                                onPromote={() => handlePromote(partner.id, partner.isChief ? 'demote' : 'promote')}
                                actionMenu={actionMenu}
                                setActionMenu={setActionMenu}
                            />
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}

// Componente Card Partner
function PartnerCard({ partner, onPromote, actionMenu, setActionMenu }: any) {
    const isChief = partner.isChief;
    const isConsultant = partner.type === 'consultant';
    const isReferral = partner.type === 'referral';

    return (
        <div className={`bg-white rounded-xl border p-5 hover:shadow-md transition-all ${isChief ? 'border-yellow-300 bg-gradient-to-r from-yellow-50/50 to-white' : 'border-gray-100'
            }`}>
            <div className="flex items-start justify-between">
                <div className="flex items-start gap-4 flex-1">
                    {/* Avatar */}
                    <div className={`w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0 ${isChief ? 'bg-gradient-to-br from-yellow-400 to-yellow-600' :
                            isConsultant ? 'bg-gradient-to-br from-orange-500 to-orange-700' :
                                'bg-gradient-to-br from-blue-500 to-blue-700'
                        }`}>
                        <span className="text-xl font-bold text-white">
                            {partner.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()}
                        </span>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <h3 className="text-lg font-bold text-[#1a2744]">{partner.name}</h3>

                            {/* Badge Chief */}
                            {isChief && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 text-xs font-bold">
                                    <Crown size={12} /> Chief Consultant
                                </span>
                            )}

                            {/* Badge Tipo */}
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${isConsultant ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
                                }`}>
                                {isConsultant ? 'Consulente' : 'Referral'}
                            </span>

                            {/* Badge Stato */}
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${partner.status === 'active' ? 'bg-green-100 text-green-700' :
                                    partner.status === 'pending_onboarding' ? 'bg-yellow-100 text-yellow-700' :
                                        'bg-gray-100 text-gray-700'
                                }`}>
                                {partner.status === 'active' ? 'Attivo' :
                                    partner.status === 'pending_onboarding' ? 'In attesa' :
                                        partner.status === 'suspended' ? 'Sospeso' : partner.status}
                            </span>
                        </div>

                        {/* Dettagli */}
                        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 mt-2">
                            {partner.email && (
                                <div className="flex items-center gap-1">
                                    <Mail size={14} className="text-gray-400" />
                                    <span>{partner.email}</span>
                                </div>
                            )}
                            {partner.phone && (
                                <div className="flex items-center gap-1">
                                    <Phone size={14} className="text-gray-400" />
                                    <span>{partner.phone}</span>
                                </div>
                            )}
                        </div>

                        {/* Dati economici */}
                        <div className="flex flex-wrap items-center gap-3 mt-3">
                            {isConsultant && (
                                <>
                                    <div className="flex items-center gap-1 px-3 py-1 bg-orange-50 rounded-lg">
                                        <DollarSign size={14} className="text-orange-600" />
                                        <span className="text-sm font-bold text-orange-700">€{partner.hourlyRate}/h</span>
                                    </div>
                                    <div className="flex items-center gap-1 px-3 py-1 bg-green-50 rounded-lg">
                                        <TrendingUp size={14} className="text-green-600" />
                                        <span className="text-sm font-bold text-green-700">{partner.commissionRate}% provv.</span>
                                    </div>
                                    <div className="text-xs text-gray-500">
                                        Sconto max: {partner.maxDiscount}%
                                    </div>
                                </>
                            )}
                            {isReferral && (
                                <div className="flex items-center gap-1 px-3 py-1 bg-blue-50 rounded-lg">
                                    <TrendingUp size={14} className="text-blue-600" />
                                    <span className="text-sm font-bold text-blue-700">{partner.commissionRate}% provv. referral</span>
                                </div>
                            )}
                            {isChief && partner.promotedAt && (
                                <div className="text-xs text-gray-500">
                                    Promosso il {new Date(partner.promotedAt).toLocaleDateString('it-IT')}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Azioni */}
                <div className="relative">
                    <button
                        onClick={() => setActionMenu(actionMenu === partner.id ? null : partner.id)}
                        className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                        <MoreVertical size={20} className="text-gray-500" />
                    </button>

                    {actionMenu === partner.id && (
                        <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl border border-gray-200 shadow-lg z-10 py-2">
                            <button
                                onClick={onPromote}
                                className={`w-full flex items-center gap-3 px-4 py-2 text-sm text-left hover:bg-gray-50 ${isChief ? 'text-gray-700' : 'text-yellow-700'
                                    }`}
                            >
                                {isChief ? (
                                    <>
                                        <Shield size={16} /> Rimuovi da Chief
                                    </>
                                ) : (
                                    <>
                                        <Crown size={16} /> Promuovi a Chief
                                    </>
                                )}
                            </button>
                            <div className="border-t border-gray-100 my-1" />
                            <Link
                                href={`/admin/partners/${partner.id}` as Route}
                                className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                            >
                                <UserCheck size={16} /> Vedi dettagli
                            </Link>
                            <button className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50">
                                <AlertCircle size={16} /> Sospendi
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
