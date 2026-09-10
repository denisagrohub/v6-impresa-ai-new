"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, ArrowLeft, Plus, Ticket, ChevronDown, ChevronUp, Copy } from "lucide-react";

interface Consultant {
    id: number;
    name: string;
    brand: string;
    hourlyRate: number;
    commissionRate: number;
    zone: string;
    isActive: boolean;
}

interface Referral {
    id: number;
    name: string;
    email: string | false;
    phone: string | false;
}

interface Token {
    id: number;
    token: string;
    status: string;
    expires_at: string | false;
    client_name: string | false;
    booked_at: string | false;
}

export default function TeamPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [consultants, setConsultants] = useState<Consultant[]>([]);
    const [referrals, setReferrals] = useState<Referral[]>([]);
    const [error, setError] = useState<string | null>(null);

    // Slot
    const [openSlotsFor, setOpenSlotsFor] = useState<number | null>(null);
    const [tokensByConsultant, setTokensByConsultant] = useState<Record<number, Token[]>>({});
    const [slotCount, setSlotCount] = useState(10);
    const [slotValidity, setSlotValidity] = useState(24);
    const [generating, setGenerating] = useState(false);

    // Referral form
    const [refName, setRefName] = useState("");
    const [refEmail, setRefEmail] = useState("");
    const [refPhone, setRefPhone] = useState("");
    const [refSaving, setRefSaving] = useState(false);
    const [refError, setRefError] = useState<string | null>(null);

    const loadAll = async () => {
        try {
            const [cRes, rRes] = await Promise.all([
                fetch('/api/admin/consultants'),
                fetch('/api/admin/referrals'),
            ]);
            const cData = await cRes.json();
            const rData = await rRes.json();
            if (!cData.success) { setError(cData.error || 'Odoo non raggiungibile'); return; }
            setConsultants(cData.consultants || []);
            setReferrals(rData.success ? (rData.referrals || []) : []);
        } catch (e: any) {
            setError(e.message || 'Errore di rete');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const session = localStorage.getItem("pi_session");
        if (!session) { router.push("/admin/login"); return; }
        loadAll();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [router]);

    const toggleSlots = async (consultantId: number) => {
        if (openSlotsFor === consultantId) { setOpenSlotsFor(null); return; }
        setOpenSlotsFor(consultantId);
        if (!tokensByConsultant[consultantId]) {
            const res = await fetch(`/api/admin/consultants/${consultantId}/slots`);
            const data = await res.json();
            if (data.success) setTokensByConsultant((prev) => ({ ...prev, [consultantId]: data.tokens }));
        }
    };

    const handleGenerate = async (consultantId: number) => {
        setGenerating(true);
        try {
            const res = await fetch(`/api/admin/consultants/${consultantId}/slots`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ count: slotCount, validityHours: slotValidity }),
            });
            const data = await res.json();
            if (data.success) setTokensByConsultant((prev) => ({ ...prev, [consultantId]: data.tokens }));
        } finally {
            setGenerating(false);
        }
    };

    const handleCreateReferral = async (e: React.FormEvent) => {
        e.preventDefault();
        setRefSaving(true);
        setRefError(null);
        try {
            const res = await fetch('/api/admin/referrals', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: refName, email: refEmail, phone: refPhone }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                setRefError(data.error || 'Creazione fallita');
                return;
            }
            setRefName(""); setRefEmail(""); setRefPhone("");
            loadAll();
        } catch (err: any) {
            setRefError(err.message || 'Errore di rete');
        } finally {
            setRefSaving(false);
        }
    };

    const copyBookingLink = (consultantId: number) => {
        navigator.clipboard.writeText(`${window.location.origin}/booking/${consultantId}`);
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
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="flex items-center gap-4 mb-8">
                    <Link href="/admin/dashboard" className="p-2 rounded-lg hover:bg-gray-200 transition-colors">
                        <ArrowLeft size={20} className="text-gray-600" />
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold text-[#1a2744]">Team</h1>
                        <p className="text-gray-500">Consulenti, referral e slot di prenotazione</p>
                    </div>
                </div>

                {error && (
                    <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
                )}

                {/* Consulenti */}
                <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-8">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-bold text-[#1a2744]">Consulenti</h2>
                        <Link href="/admin/consultants/new" className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1a2744] text-white text-sm font-medium hover:bg-[#0f3460]">
                            <Plus size={16} /> Nuovo Consulente
                        </Link>
                    </div>
                    {consultants.length === 0 ? (
                        <p className="text-sm text-gray-400">Nessun consulente.</p>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {consultants.map((c) => (
                                <div key={c.id}>
                                    <div className="flex items-center justify-between py-3">
                                        <div>
                                            <div className="text-sm font-semibold text-[#1a2744]">{c.name}</div>
                                            <div className="text-xs text-gray-500">
                                                {c.brand}{c.zone ? ` · ${c.zone}` : ''}
                                                {c.hourlyRate ? ` · €${c.hourlyRate}/h` : ''}
                                                {c.commissionRate ? ` · ${c.commissionRate}% provv.` : ''}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => copyBookingLink(c.id)} title="Copia link di prenotazione"
                                                className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
                                                <Copy size={16} />
                                            </button>
                                            <button onClick={() => toggleSlots(c.id)}
                                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50">
                                                <Ticket size={14} /> Slot
                                                {openSlotsFor === c.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                            </button>
                                        </div>
                                    </div>
                                    {openSlotsFor === c.id && (
                                        <div className="pb-4 px-2">
                                            <div className="flex flex-wrap items-end gap-3 mb-3 bg-gray-50 rounded-lg p-3">
                                                <div>
                                                    <label className="block text-xs text-gray-500 mb-1">Quanti slot</label>
                                                    <input type="number" min={1} max={50} value={slotCount}
                                                        onChange={(e) => setSlotCount(Number(e.target.value))}
                                                        className="w-20 px-2 py-1 rounded border border-gray-200 text-sm" />
                                                </div>
                                                <div>
                                                    <label className="block text-xs text-gray-500 mb-1">Validità (ore)</label>
                                                    <input type="number" min={1} value={slotValidity}
                                                        onChange={(e) => setSlotValidity(Number(e.target.value))}
                                                        className="w-24 px-2 py-1 rounded border border-gray-200 text-sm" />
                                                </div>
                                                <button onClick={() => handleGenerate(c.id)} disabled={generating}
                                                    className="px-4 py-1.5 rounded-lg bg-[#1a2744] text-white text-sm font-medium hover:bg-[#0f3460] disabled:opacity-50">
                                                    {generating ? 'Genero...' : 'Genera'}
                                                </button>
                                            </div>
                                            {tokensByConsultant[c.id]?.length ? (
                                                <div className="text-xs text-gray-500 space-y-1 max-h-48 overflow-y-auto">
                                                    {tokensByConsultant[c.id].map((t) => (
                                                        <div key={t.id} className="flex items-center justify-between px-2 py-1 bg-white rounded border border-gray-100">
                                                            <span className="font-mono">{t.token.slice(0, 12)}…</span>
                                                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${t.status === 'available' ? 'bg-green-100 text-green-700' : t.status === 'booked' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                                                                {t.status}
                                                            </span>
                                                            <span>{t.expires_at ? new Date(t.expires_at).toLocaleString('it-IT') : ''}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-xs text-gray-400">Nessuno slot ancora.</p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Referral */}
                <div className="bg-white rounded-2xl border border-gray-100 p-6">
                    <h2 className="text-lg font-bold text-[#1a2744] mb-4">Referral</h2>
                    <form onSubmit={handleCreateReferral} className="grid sm:grid-cols-4 gap-3 mb-6">
                        <input required placeholder="Nome" value={refName} onChange={(e) => setRefName(e.target.value)}
                            className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20" />
                        <input placeholder="Email" type="email" value={refEmail} onChange={(e) => setRefEmail(e.target.value)}
                            className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20" />
                        <input placeholder="Telefono" value={refPhone} onChange={(e) => setRefPhone(e.target.value)}
                            className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20" />
                        <button type="submit" disabled={refSaving}
                            className="px-4 py-2 rounded-lg bg-[#1a2744] text-white text-sm font-medium hover:bg-[#0f3460] disabled:opacity-50">
                            {refSaving ? 'Salvo...' : 'Aggiungi'}
                        </button>
                    </form>
                    {refError && <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{refError}</div>}
                    {referrals.length === 0 ? (
                        <p className="text-sm text-gray-400">Nessun referral.</p>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {referrals.map((r) => (
                                <div key={r.id} className="py-2 flex items-center justify-between">
                                    <span className="text-sm font-medium text-[#1a2744]">{r.name}</span>
                                    <span className="text-xs text-gray-500">{r.email || ''}{r.phone ? ` · ${r.phone}` : ''}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
