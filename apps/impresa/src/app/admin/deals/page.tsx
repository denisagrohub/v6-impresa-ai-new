'use client';

import { useEffect, useState } from 'react';
import AdminLayout from '@/components/admin/layout/AdminLayout';
import { Loader2, TrendingUp, Snowflake, FileSignature, BarChart3, ChevronDown, ChevronRight } from 'lucide-react';

type Deal = {
    id: number;
    name: string;
    state: string;
    revenueModel: string;
    schemaCode: string;
    sellerName: string | null;
    sellerPlaceholderCode: string | null;
    sellerIsPlaceholder: boolean;
    buyerName: string | null;
    buyerPlaceholderCode: string | null;
    buyerIsPlaceholder: boolean;
    legCount: number;
    participantCount: number;
    currentProspettoId: number | null;
};

type Group = {
    relationId: number;
    relationName: string;
    deals: Deal[];
};

type Kpi = {
    totalDeals: number;
    active: number;
    frozen: number;
    signing: number;
    forecasting: number;
    feeMonthlyMin: number;
    feeMonthlyBase: number;
    feeMonthlyMax: number;
};

const fmt = (n: number) =>
    new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);

const stateColor: Record<string, string> = {
    forecasting: 'bg-gray-100 text-gray-700',
    negotiating: 'bg-blue-100 text-blue-700',
    frozen: 'bg-cyan-100 text-cyan-700',
    signing: 'bg-amber-100 text-amber-700',
    active: 'bg-green-100 text-green-700',
    closed: 'bg-gray-100 text-gray-500',
    cancelled: 'bg-red-100 text-red-700',
};

const stateLabel: Record<string, string> = {
    forecasting: 'Previsione',
    negotiating: 'In trattativa',
    frozen: 'Congelato',
    signing: 'In firma',
    active: 'Attivo',
    closed: 'Chiuso',
    cancelled: 'Annullato',
};

export default function AdminDealsPage() {
    const [showAll, setShowAll] = useState(false);
    const [groups, setGroups] = useState<Group[]>([]);
    const [kpi, setKpi] = useState<Kpi | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expanded, setExpanded] = useState<Record<number, boolean>>({});

    useEffect(() => {
        try {
            const raw = localStorage.getItem('pi_session');
            const session = raw ? JSON.parse(raw) : null;
            const token = session?.token;
            if (!token) {
                setError('Sessione mancante. Effettua il login.');
                setLoading(false);
                return;
            }
            fetch('/api/admin/deals', { headers: { Authorization: `JWT ${token}` } })
                .then(r => r.json())
                .then(json => {
                    const payload = json.data ?? json;
                    setGroups(payload.groups ?? []);
                    setKpi(payload.kpi ?? null);
                    if (payload.groups?.length) {
                        setExpanded({ [payload.groups[0].relationId]: true });
                    }
                    setLoading(false);
                })
                .catch(e => {
                    setError(e.message);
                    setLoading(false);
                });
        } catch (e: any) {
            setError(e.message);
            setLoading(false);
        }
    }, []);

    return (
        <AdminLayout title="Deal" subtitle="Aggregazioni, prospetti, firme. Visibili solo a chi ha firmato NDA/NCND.">
            <div className="p-6 max-w-7xl mx-auto">
                {loading && (
                    <div className="flex items-center gap-2 text-gray-500">
                        <Loader2 className="w-4 h-4 animate-spin" /> Caricamento…
                    </div>
                )}

                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md">
                        {error}
                    </div>
                )}

                {kpi && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        <KpiCard icon={TrendingUp} label="Deal totali" value={String(kpi.totalDeals)}
                                 sub={`${kpi.forecasting} in previsione`} />
                        <KpiCard icon={Snowflake} label="Congelati" value={String(kpi.frozen)}
                                 sub={`${kpi.signing} in firma`} />
                        <KpiCard icon={BarChart3} label="Attivi" value={String(kpi.active)}
                                 sub="Rolling in corso" />
                        <KpiCard icon={FileSignature} label="Fee V6 / mese"
                                 value={fmt(kpi.feeMonthlyBase)}
                                 sub={`${fmt(kpi.feeMonthlyMin)} – ${fmt(kpi.feeMonthlyMax)}`} />
                    </div>
                )}

                {!loading && !error && groups.length === 0 && (
                    <div className="bg-gray-50 border border-gray-200 rounded-md p-8 text-center text-gray-500">
                        Nessun deal presente.
                    </div>
                )}

                {/* 28/09/2026: filtro attivi/tutti */}
                {(() => {
                    const filtered = groups
                        .map(g => ({
                            ...g,
                            deals: showAll
                                ? g.deals
                                : g.deals.filter(d => !['frozen', 'closed', 'cancelled'].includes(d.state)),
                        }))
                        .filter(g => g.deals.length > 0);
                    const hiddenCount = groups.reduce((acc, g) => acc + g.deals.length, 0)
                        - filtered.reduce((acc, g) => acc + g.deals.length, 0);

                    return (
                        <>
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-sm font-semibold text-gray-700">
                                    {showAll ? 'Tutti i deal' : 'Deal attivi'}
                                    {!showAll && hiddenCount > 0 && (
                                        <span className="ml-2 text-xs text-gray-400">
                                            ({hiddenCount} nascosti)
                                        </span>
                                    )}
                                </h2>
                                <button
                                    onClick={() => setShowAll(!showAll)}
                                    className="text-xs px-3 py-1 rounded border border-gray-300 hover:bg-gray-50"
                                >
                                    {showAll ? 'Solo attivi' : 'Mostra tutti'}
                                </button>
                            </div>
                            {filtered.length === 0 && (
                                <div className="bg-gray-50 border border-gray-200 rounded-md p-8 text-center text-gray-500">
                                    Nessun deal {showAll ? '' : 'attivo'}. Clicca "Mostra tutti" per vedere quelli congelati.
                                </div>
                            )}
                            {filtered.map(group => (
                    <div key={group.relationId} className="mb-4 border border-gray-200 rounded-lg overflow-hidden">
                        <button
                            onClick={() => setExpanded(e => ({ ...e, [group.relationId]: !e[group.relationId] }))}
                            className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 text-left"
                        >
                            <div className="flex items-center gap-2">
                                {expanded[group.relationId] ?
                                    <ChevronDown className="w-4 h-4 text-gray-500" /> :
                                    <ChevronRight className="w-4 h-4 text-gray-500" />}
                                <span className="font-semibold text-gray-900">{group.relationName}</span>
                                <span className="text-sm text-gray-500">
                                    {group.deals.length} deal
                                </span>
                            </div>
                        </button>

                        {expanded[group.relationId] && (
                            <table className="w-full text-sm">
                                <thead className="bg-white border-t border-b border-gray-200">
                                    <tr className="text-left text-xs uppercase text-gray-500">
                                        <th className="px-4 py-2 font-medium">Deal</th>
                                        <th className="px-4 py-2 font-medium">Venditore</th>
                                        <th className="px-4 py-2 font-medium">Compratore</th>
                                        <th className="px-4 py-2 font-medium">Modello</th>
                                        <th className="px-4 py-2 font-medium">Stato</th>
                                        <th className="px-4 py-2 font-medium text-right">Leg</th>
                                        <th className="px-4 py-2 font-medium text-right">Part.</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {group.deals.map(deal => (
                                        <tr key={deal.id} className="border-b border-gray-100 hover:bg-gray-50">
                                            <td className="px-4 py-3">
                                                <a href={`/admin/deals/${deal.id}`} className="text-blue-600 hover:underline font-medium">
                                                    {deal.name}
                                                </a>
                                                <div className="text-xs text-gray-400 mt-0.5">{deal.schemaCode}</div>
                                            </td>
                                            <td className="px-4 py-3">
                                                {deal.sellerIsPlaceholder ? (
                                                    <span className="text-gray-500">
                                                        <span className="font-mono">{deal.sellerPlaceholderCode}</span>
                                                        <span className="ml-1 text-xs">(placeholder)</span>
                                                    </span>
                                                ) : deal.sellerName}
                                            </td>
                                            <td className="px-4 py-3">
                                                {deal.buyerIsPlaceholder ? (
                                                    <span className="text-gray-500">
                                                        <span className="font-mono">{deal.buyerPlaceholderCode}</span>
                                                        <span className="ml-1 text-xs">(placeholder)</span>
                                                    </span>
                                                ) : deal.buyerName}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="text-xs font-mono bg-gray-100 px-2 py-0.5 rounded">
                                                    {deal.revenueModel}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`text-xs px-2 py-0.5 rounded-full ${stateColor[deal.state] || 'bg-gray-100'}`}>
                                                    {stateLabel[deal.state] || deal.state}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right text-gray-600">{deal.legCount}</td>
                                            <td className="px-4 py-3 text-right text-gray-600">{deal.participantCount}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                ))}
                        </>
                    );
                })()}
            </div>
        </AdminLayout>
    );
}

function KpiCard({ icon: Icon, label, value, sub }: {
    icon: any;
    label: string;
    value: string;
    sub?: string;
}) {
    return (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-gray-500 text-xs uppercase mb-2">
                <Icon className="w-3.5 h-3.5" />
                {label}
            </div>
            <div className="text-xl font-bold text-gray-900">{value}</div>
            {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
        </div>
    );
}
