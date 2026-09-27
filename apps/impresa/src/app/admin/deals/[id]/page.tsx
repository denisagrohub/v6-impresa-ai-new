'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import AdminLayout from '@/components/admin/layout/AdminLayout';
import { Loader2, ArrowLeft, Snowflake, FileSignature, RefreshCw } from 'lucide-react';

type Variable = {
    id: number;
    name: string;
    label: string;
    unit: string;
    valueMin: number;
    valueBase: number;
    valueMax: number;
    valueText: string;
    isCritical: boolean;
    locked: boolean;
    enabled: boolean;
};

type Leg = {
    id: number;
    sellerName: string;
    sellerIsPlaceholder: boolean;
    sellerPlaceholderCode: string;
    quantita: number;
    prezzoAcquisto: number;
    prezzoVendita: number;
};

type Participant = {
    id: number;
    partnerName: string;
    role: string;
    tier: string;
    scope: string;
    sharePct: number;
    isReferralPayer: boolean;
};

type ProspettoLine = {
    id: number;
    partnerName: string;
    role: string;
    monthlyMin: number;
    monthlyBase: number;
    monthlyMax: number;
    rolling12Min: number;
    rolling12Base: number;
    rolling12Max: number;
    rolling24Min: number;
    rolling24Base: number;
    rolling24Max: number;
};

type Prospetto = {
    id: number;
    version: number;
    state: string;
    computedAt: string;
    lines: ProspettoLine[];
};

type Deal = {
    id: number;
    name: string;
    state: string;
    revenueModel: string;
    schemaCode: string;
    sellerName: string;
    sellerIsPlaceholder: boolean;
    sellerPlaceholderCode: string;
    buyerName: string;
    buyerIsPlaceholder: boolean;
    buyerPlaceholderCode: string;
    canFreeze: boolean;
    canSign: boolean;
    frozenAt: string | null;
    notes: string;
    variables: Variable[];
    legs: Leg[];
    participants: Participant[];
    prospetto: Prospetto | null;
};

const fmt = (n: number) =>
    new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);

const stateLabel: Record<string, string> = {
    forecasting: 'Previsione', negotiating: 'In trattativa', frozen: 'Congelato',
    signing: 'In firma', active: 'Attivo', closed: 'Chiuso', cancelled: 'Annullato',
};

const roleLabel: Record<string, string> = {
    v6_entity: 'V6 entità', consultant: 'Consulente', referral: 'Referral', other: 'Altro',
};

export default function DealDetailPage() {
    const params = useParams();
    const dealId = params?.id;
    const [deal, setDeal] = useState<Deal | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [actionMessage, setActionMessage] = useState<string | null>(null);

    const fetchDeal = () => {
        try {
            const raw = localStorage.getItem('pi_session');
            const session = raw ? JSON.parse(raw) : null;
            const token = session?.token;
            if (!token) { setError('Sessione mancante.'); setLoading(false); return; }
            fetch(`/api/admin/deals/${dealId}`, { headers: { Authorization: `JWT ${token}` } })
                .then(r => r.json())
                .then(json => {
                    const payload = json.data ?? json;
                    if (payload.deal) setDeal(payload.deal);
                    else setError('Deal non trovato.');
                    setLoading(false);
                })
                .catch(e => { setError(e.message); setLoading(false); });
        } catch (e: any) { setError(e.message); setLoading(false); }
    };

    const runAction = (action: 'freeze' | 'send-to-sign' | 'recompute') => {
        const raw = localStorage.getItem('pi_session');
        const session = raw ? JSON.parse(raw) : null;
        const token = session?.token;
        if (!token) return;

        setActionLoading(action);
        setActionMessage(null);

        const endpoint = action === 'freeze'
            ? `/api/admin/deals/${dealId}/freeze`
            : action === 'send-to-sign'
                ? `/api/admin/deals/${dealId}/send-to-sign`
                : `/api/admin/deals/${dealId}/freeze`; // recompute = refreeze per ora

        fetch(endpoint, {
            method: 'POST',
            headers: { Authorization: `JWT ${token}` },
        })
            .then(r => r.json())
            .then(json => {
                const payload = json.data ?? json;
                if (payload.error) {
                    setActionMessage(`Errore: ${payload.error}`);
                } else {
                    setActionMessage(`OK: ${action} eseguito`);
                    if (payload.deal) setDeal(payload.deal);
                    else fetchDeal();
                }
                setActionLoading(null);
            })
            .catch(e => {
                setActionMessage(`Errore: ${e.message}`);
                setActionLoading(null);
            });
    };

    useEffect(() => {
        if (!dealId) return;
        fetchDeal();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dealId]);

    if (loading) return (
        <AdminLayout title="Deal" subtitle="Caricamento…">
            <div className="p-6 flex items-center gap-2 text-gray-500">
                <Loader2 className="w-4 h-4 animate-spin" /> Caricamento…
            </div>
        </AdminLayout>
    );

    if (error || !deal) return (
        <AdminLayout title="Deal" subtitle="Errore">
            <div className="p-6">
                <a href="/admin/deals" className="text-blue-600 hover:underline flex items-center gap-1 mb-4">
                    <ArrowLeft className="w-4 h-4" /> Torna alla lista
                </a>
                <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md">
                    {error || 'Deal non trovato'}
                </div>
            </div>
        </AdminLayout>
    );

    return (
        <AdminLayout title={deal.name} subtitle={`${deal.schemaCode} · ${deal.revenueModel} · ${stateLabel[deal.state] || deal.state}`}>
            <div className="p-6 max-w-[1600px] mx-auto">

                <div className="mb-4 flex items-center justify-between">
                    <a href="/admin/deals" className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                        <ArrowLeft className="w-4 h-4" /> Torna alla lista
                    </a>
                    <div className="flex gap-2 items-center">
                        <button
                            onClick={() => runAction('recompute')}
                            disabled={actionLoading !== null}
                            className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 flex items-center gap-1.5 disabled:opacity-50">
                            <RefreshCw className={`w-3.5 h-3.5 ${actionLoading === 'recompute' ? 'animate-spin' : ''}`} />
                            {actionLoading === 'recompute' ? 'Rigenero…' : 'Rigenera'}
                        </button>
                        <button
                            onClick={() => runAction('freeze')}
                            disabled={!deal.canFreeze || actionLoading !== null}
                            className={`px-3 py-1.5 text-sm rounded flex items-center gap-1.5 ${deal.canFreeze && !actionLoading ? 'bg-cyan-600 text-white hover:bg-cyan-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>
                            <Snowflake className="w-3.5 h-3.5" />
                            {actionLoading === 'freeze' ? 'Congelo…' : 'Congela'}
                        </button>
                        <button
                            onClick={() => runAction('send-to-sign')}
                            disabled={!deal.canSign || actionLoading !== null}
                            className={`px-3 py-1.5 text-sm rounded flex items-center gap-1.5 ${deal.canSign && !actionLoading ? 'bg-amber-600 text-white hover:bg-amber-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>
                            <FileSignature className="w-3.5 h-3.5" />
                            {actionLoading === 'send-to-sign' ? 'Invio…' : 'Invia in firma'}
                        </button>
                    </div>
                </div>

                {actionMessage && (
                    <div className={`mb-4 p-3 rounded-md text-sm ${
                        actionMessage.startsWith('OK') 
                            ? 'bg-green-50 border border-green-200 text-green-700'
                            : 'bg-red-50 border border-red-200 text-red-700'
                    }`}>
                        {actionMessage}
                    </div>
                )}

                {/* Info deal */}
                <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                            <div className="text-xs text-gray-500 uppercase">Venditore</div>
                            <div className="font-medium">
                                {deal.sellerIsPlaceholder
                                    ? `${deal.sellerPlaceholderCode} (placeholder)`
                                    : deal.sellerName}
                            </div>
                        </div>
                        <div>
                            <div className="text-xs text-gray-500 uppercase">Compratore</div>
                            <div className="font-medium">
                                {deal.buyerIsPlaceholder
                                    ? `${deal.buyerPlaceholderCode} (placeholder)`
                                    : deal.buyerName}
                            </div>
                        </div>
                        <div>
                            <div className="text-xs text-gray-500 uppercase">Congelato</div>
                            <div className="font-medium">{deal.frozenAt ? new Date(deal.frozenAt).toLocaleString('it-IT') : '—'}</div>
                        </div>
                        <div>
                            <div className="text-xs text-gray-500 uppercase">Leg / Partecipanti</div>
                            <div className="font-medium">{deal.legs.length} / {deal.participants.length}</div>
                        </div>
                    </div>
                    {deal.notes && (
                        <div className="mt-3 pt-3 border-t border-gray-100 text-sm text-gray-600">
                            {deal.notes}
                        </div>
                    )}
                </div>

                {/* Split screen: variabili | prospetto */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">

                    {/* Variabili */}
                    <div className="bg-white border border-gray-200 rounded-lg">
                        <div className="px-4 py-3 border-b border-gray-200 font-semibold text-sm">
                            Variabili ({deal.variables.length})
                        </div>
                        <div className="divide-y divide-gray-100">
                            {deal.variables.map(v => (
                                <div key={v.id} className="px-4 py-2.5 text-sm">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="font-medium text-gray-800">
                                            {v.label || v.name}
                                            {v.isCritical && <span className="ml-2 text-xs text-amber-600">critica</span>}
                                            {!v.enabled && <span className="ml-2 text-xs text-gray-400">OFF</span>}
                                        </span>
                                        <span className="text-xs text-gray-500">{v.unit}</span>
                                    </div>
                                    <div className="flex gap-4 text-xs text-gray-600">
                                        {v.valueText ? (
                                            <span className="font-mono">{v.valueText}</span>
                                        ) : (
                                            <>
                                                <span>MIN: <span className="font-mono">{v.valueMin.toLocaleString('it-IT')}</span></span>
                                                <span>BASE: <span className="font-mono">{v.valueBase.toLocaleString('it-IT')}</span></span>
                                                <span>MAX: <span className="font-mono">{v.valueMax.toLocaleString('it-IT')}</span></span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Prospetto */}
                    <div className="bg-white border border-gray-200 rounded-lg">
                        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                            <span className="font-semibold text-sm">
                                Prospetto {deal.prospetto ? `v${deal.prospetto.version}` : '—'}
                            </span>
                            {deal.prospetto && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-700">
                                    {deal.prospetto.state}
                                </span>
                            )}
                        </div>
                        {!deal.prospetto ? (
                            <div className="p-4 text-sm text-gray-500">Nessun prospetto generato.</div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                    <thead className="bg-gray-50 text-gray-600 uppercase">
                                        <tr>
                                            <th className="px-3 py-2 text-left">Partecipante</th>
                                            <th className="px-3 py-2 text-right">MIN/mese</th>
                                            <th className="px-3 py-2 text-right">BASE/mese</th>
                                            <th className="px-3 py-2 text-right">MAX/mese</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {deal.prospetto.lines.map(line => (
                                            <tr key={line.id} className="border-t border-gray-100">
                                                <td className="px-3 py-2">
                                                    <div className="font-medium">{line.partnerName}</div>
                                                    <div className="text-gray-500">{roleLabel[line.role] || line.role}</div>
                                                </td>
                                                <td className="px-3 py-2 text-right font-mono">{fmt(line.monthlyMin)}</td>
                                                <td className="px-3 py-2 text-right font-mono">{fmt(line.monthlyBase)}</td>
                                                <td className="px-3 py-2 text-right font-mono">{fmt(line.monthlyMax)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>

                {/* Leg e partecipanti */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                    <div className="bg-white border border-gray-200 rounded-lg">
                        <div className="px-4 py-3 border-b border-gray-200 font-semibold text-sm">
                            Leg / Venditori ({deal.legs.length})
                        </div>
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 text-xs text-gray-600 uppercase">
                                <tr>
                                    <th className="px-4 py-2 text-left">Venditore</th>
                                    <th className="px-4 py-2 text-right">Q.tà</th>
                                    <th className="px-4 py-2 text-right">Prezzo acq.</th>
                                </tr>
                            </thead>
                            <tbody>
                                {deal.legs.map(l => (
                                    <tr key={l.id} className="border-t border-gray-100">
                                        <td className="px-4 py-2">
                                            {l.sellerIsPlaceholder
                                                ? <span className="font-mono text-gray-500">{l.sellerPlaceholderCode}</span>
                                                : l.sellerName}
                                        </td>
                                        <td className="px-4 py-2 text-right font-mono">{l.quantita.toLocaleString('it-IT')}</td>
                                        <td className="px-4 py-2 text-right font-mono">{l.prezzoAcquisto || '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="bg-white border border-gray-200 rounded-lg">
                        <div className="px-4 py-3 border-b border-gray-200 font-semibold text-sm">
                            Partecipanti ({deal.participants.length})
                        </div>
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 text-xs text-gray-600 uppercase">
                                <tr>
                                    <th className="px-4 py-2 text-left">Nome</th>
                                    <th className="px-4 py-2 text-left">Ruolo</th>
                                    <th className="px-4 py-2 text-left">Tier</th>
                                    <th className="px-4 py-2 text-right">Quota</th>
                                </tr>
                            </thead>
                            <tbody>
                                {deal.participants.map(p => (
                                    <tr key={p.id} className="border-t border-gray-100">
                                        <td className="px-4 py-2">{p.partnerName}</td>
                                        <td className="px-4 py-2 text-gray-600">{roleLabel[p.role] || p.role}</td>
                                        <td className="px-4 py-2 text-gray-500">{p.tier || '—'}</td>
                                        <td className="px-4 py-2 text-right font-mono">
                                            {p.role === 'referral'
                                                ? 'fisso'
                                                : `${(p.sharePct * 100).toFixed(2)}%`}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}
