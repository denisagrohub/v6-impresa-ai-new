'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import AdminLayout from '@/components/admin/layout/AdminLayout';
import DealNarrative from '@/components/deal/DealNarrative';
import { SignRequestsPanel, type SignRequest } from '@/components/deal/SignRequestsPanel';
import { DealWizardPanel, type ChecklistStep } from '@/components/deal/DealWizardPanel';
import { SettlementsPanel, type Settlement } from '@/components/deal/SettlementsPanel';
import { Loader2, ArrowLeft, FileSignature } from 'lucide-react';
import { getAuthToken } from '@/components/deal/auth';
import { DealHeaderActions, type DealAction } from '@/components/deal/detail/DealHeaderActions';
import { DealInfoCard } from '@/components/deal/detail/DealInfoCard';
import { DealVariablesPanel } from '@/components/deal/detail/DealVariablesPanel';
import { DealProspettoPanel } from '@/components/deal/detail/DealProspettoPanel';
import { DealLegsTable } from '@/components/deal/detail/DealLegsTable';
import { DealParticipantsTable } from '@/components/deal/detail/DealParticipantsTable';

type Variable = {
    id: number;
    name: string;
    label: string;
    unit: string;
    valueMin: number;
    valueBase: number;
    valueMax: number;
    valueText: string;
    source: string;
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
    signRequests: SignRequest[];
    settlements: Settlement[];
    checklist: ChecklistStep[];
    progressDone: number;
    progressTotal: number;
    nextStepId: number | null;
    nextStepCode: string | null;
};

const stateLabel: Record<string, string> = {
    forecasting: 'Previsione', negotiating: 'In trattativa', frozen: 'Congelato',
    signing: 'In firma', active: 'Attivo', closed: 'Chiuso', cancelled: 'Annullato',
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
            const token = getAuthToken();
            if (!token) { setError('Sessione mancante.'); setLoading(false); return; }
            fetch(`/api/admin/deals/${dealId}`, { headers: { Authorization: `JWT ${token}` } })
                .then(r => r.json())
                .then(json => {
                    const payload = json.data ?? json;
                    if (payload.deal) {
                        setDeal(payload.deal);
                        // Fetch settlements separatamente
                        fetch(`/api/admin/deals/${dealId}/settlements`, {
                            headers: { Authorization: `JWT ${token}` },
                        })
                            .then(r => r.json())
                            .then(sd => {
                                if (sd.settlements) {
                                    setDeal(prev => prev ? { ...prev, settlements: sd.settlements } : prev);
                                }
                            })
                            .catch(() => {});
                    } else setError('Deal non trovato.');
                    setLoading(false);
                })
                .catch(e => { setError(e.message); setLoading(false); });
        } catch (e: any) { setError(e.message); setLoading(false); }
    };

    const runAction = (action: 'freeze' | 'send-to-sign' | 'recompute') => {
        const token = getAuthToken();
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

    const updateVariable = (name: string, payload: { enabled?: boolean; valueBase?: number }) => {
        const token = getAuthToken();
        if (!token) return;

        setActionLoading(`var:${name}`);
        setActionMessage(null);

        fetch(`/api/admin/deals/${dealId}/variable`, {
            method: 'POST',
            headers: { Authorization: `JWT ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, ...payload }),
        })
            .then(r => r.json())
            .then(json => {
                const payload2 = json.data ?? json;
                if (payload2.error) {
                    setActionMessage(`Errore: ${payload2.error}`);
                } else {
                    setActionMessage(`OK: variabile ${name} aggiornata`);
                    if (payload2.deal) setDeal(payload2.deal);
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

                {/* 28/09/2026: wizard checklist per fase */}
                <DealWizardPanel
                    dealId={deal.id}
                    checklist={deal.checklist || []}
                    progressDone={deal.progressDone || 0}
                    progressTotal={deal.progressTotal || 0}
                    nextStepId={deal.nextStepId || null}
                    authToken={getAuthToken() || ''}
                    onRefresh={fetchDeal}
                />

                <DealHeaderActions
                    canFreeze={deal.canFreeze}
                    canSign={deal.canSign}
                    actionLoading={actionLoading}
                    onAction={runAction}
                />

                {actionMessage && (
                    <div className={`mb-4 p-3 rounded-md text-sm ${
                        actionMessage.startsWith('OK') 
                            ? 'bg-green-50 border border-green-200 text-green-700'
                            : 'bg-red-50 border border-red-200 text-red-700'
                    }`}>
                        {actionMessage}
                    </div>
                )}

                <DealNarrative
                    deal={{
                        name: deal.name,
                        revenueModel: deal.revenueModel,
                        state: deal.state,
                        variables: deal.variables,
                        participantCount: deal.participants.length,
                    }}
                    prospetto={deal.prospetto ? { lines: deal.prospetto.lines } : null}
                />

                {/* 28/09/2026: firme del prospetto (Documenso) */}
                {deal.signRequests && deal.signRequests.length > 0 && (
                    <section className="mb-4 rounded-xl border border-gray-200 bg-white p-5">
                        <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
                            <FileSignature size={16} className="text-indigo-600" />
                            Firme del prospetto
                        </h2>
                        <SignRequestsPanel requests={deal.signRequests} />
                    </section>
                )}

                {/* 28/09/2026: consuntivi mensili */}
                <SettlementsPanel
                    dealId={deal.id}
                    settlements={deal.settlements || []}
                    onRefresh={fetchDeal}
                    authToken={getAuthToken() || ''}
                />

                {/* Info deal (C1.b) */}
                <DealInfoCard
                    sellerIsPlaceholder={deal.sellerIsPlaceholder}
                    sellerPlaceholderCode={deal.sellerPlaceholderCode}
                    sellerName={deal.sellerName}
                    buyerIsPlaceholder={deal.buyerIsPlaceholder}
                    buyerPlaceholderCode={deal.buyerPlaceholderCode}
                    buyerName={deal.buyerName}
                    frozenAt={deal.frozenAt}
                    legsCount={deal.legs.length}
                    participantsCount={deal.participants.length}
                    notes={deal.notes}
                />

                {/* Split screen variabili | prospetto (C1.b) */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                    <DealVariablesPanel
                        variables={deal.variables}
                        actionLoading={actionLoading}
                        onUpdate={updateVariable}
                    />
                    <DealProspettoPanel prospetto={deal.prospetto} />
                </div>

                {/* Leg e partecipanti (C1.b) */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <DealLegsTable legs={deal.legs} />
                    <DealParticipantsTable participants={deal.participants} />
                </div>
            </div>
        </AdminLayout>
    );
}
