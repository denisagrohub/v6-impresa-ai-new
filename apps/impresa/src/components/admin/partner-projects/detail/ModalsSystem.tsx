// @ts-nocheck
// (file auto-generato da C1.g.3, tipizzazione in C1.h cleanup)
//
// ═══════════════════════════════════════════════════════════════════
// ModalsSystem — ultimo gruppo di modali "sistema".
// Estratto il 29/09/2026 (Refactor C, step C1.g.3) da:
//   app/admin/partner-projects/[id]/page.tsx
//
// Contiene:
//   - Impostazioni Circuito (read-only: progetto, alias, KPI)
//   - Scheda completa persona (RichPartModal)
//   - Crea sotto-progetto (acq)
//   - RelationScoutingPanel + LiveCallDrawer + PersonCard + CallEndPanel
// ═══════════════════════════════════════════════════════════════════

'use client';

import { RichPartModal } from '@/components/admin/RichPartModal';
import RelationScoutingPanel from '@/components/admin/RelationScoutingPanel';
import LiveCallDrawer from '@/components/admin/LiveCallDrawer';
import PersonCard from '@/components/admin/PersonCard';
import CallEndPanel from '@/components/admin/CallEndPanel';

type Props = {
  state: any;
  data: any;
  callbacks: any;
};

export function ModalsSystem({ state, data, callbacks }: Props) {
  return (
    <>
{state.isSettingsOpen && (
    <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4" onClick={() => callbacks.setIsSettingsOpen(false)}>
        <div className="bg-white rounded-lg shadow-2xl w-full max-w-md p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-[#0f172a]">Impostazioni Circuito</h3>
            <div className="space-y-2 text-xs text-gray-600">
                <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                    <span>Progetto</span>
                    <span className="font-semibold text-[#0f172a]">{state.project?.name}</span>
                </div>
                <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                    <span>Alias Email</span>
                    <span className="font-mono text-[11px] text-[#1a7fa8]">{state.project?.emailAlias || 'N/D'}</span>
                </div>
                <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                    <span>Parti collegate</span>
                    <span className="font-semibold">{state.partners.length}</span>
                </div>
                <div className="flex items-center justify-between">
                    <span>Documenti</span>
                    <span className="font-semibold">{state.documents.length}</span>
                </div>
            </div>
            {/* 19/09/2026: editor KPI targets (non charter, non versionato) */}
            <div className="border-t border-gray-100 pt-3">
                <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-500">
                    🎯 Target di rendimento
                </h4>
                <div className="grid grid-cols-2 gap-2 mb-2">
                    <div>
                        <label className="mb-0.5 block text-[10px] font-medium text-gray-600">Target attivi</label>
                        <input type="number" min={0}
                            className="w-full rounded border border-gray-200 px-2 py-1 text-xs"
                            value={state.kpiTargetsEdit.targetAttivi}
                            onChange={e => callbacks.setKpiTargetsEdit({ ...kpiTargetsEdit, targetAttivi: parseInt(e.target.value || '0', 10) })} />
                    </div>
                    <div>
                        <label className="mb-0.5 block text-[10px] font-medium text-gray-600">Partner / anno</label>
                        <input type="number" min={0}
                            className="w-full rounded border border-gray-200 px-2 py-1 text-xs"
                            value={state.kpiTargetsEdit.partnerAnno}
                            onChange={e => callbacks.setKpiTargetsEdit({ ...kpiTargetsEdit, partnerAnno: parseInt(e.target.value || '0', 10) })} />
                    </div>
                    <div>
                        <label className="mb-0.5 block text-[10px] font-medium text-gray-600">Call / mese</label>
                        <input type="number" min={0}
                            className="w-full rounded border border-gray-200 px-2 py-1 text-xs"
                            value={state.kpiTargetsEdit.callMese}
                            onChange={e => callbacks.setKpiTargetsEdit({ ...kpiTargetsEdit, callMese: parseInt(e.target.value || '0', 10) })} />
                    </div>
                    <div>
                        <label className="mb-0.5 block text-[10px] font-medium text-gray-600">Email / mese</label>
                        <input type="number" min={0}
                            className="w-full rounded border border-gray-200 px-2 py-1 text-xs"
                            value={state.kpiTargetsEdit.emailMese}
                            onChange={e => callbacks.setKpiTargetsEdit({ ...kpiTargetsEdit, emailMese: parseInt(e.target.value || '0', 10) })} />
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={async () => {
                            if (!state.project?.id) return;
                            callbacks.setKpiTargetsBusy(true); callbacks.setKpiTargetsMsg(null);
                            try {
                                const r = await fetch(`/api/admin/partner-projects/${state.project.id}/kpi-targets`, {
                                    method: 'PATCH',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify(state.kpiTargetsEdit),
                                });
                                const d = await r.json();
                                callbacks.setKpiTargetsMsg(d.success ? '✓ Salvato' : (d.error || 'Errore'));
                            } catch (e: any) { callbacks.setKpiTargetsMsg(e.message); }
                            finally { callbacks.setKpiTargetsBusy(false); }
                        }}
                        disabled={state.kpiTargetsBusy}
                        className="flex-1 py-1.5 rounded bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-40"
                    >
                        {state.kpiTargetsBusy ? 'Salvo…' : 'Salva target KPI'}
                    </button>
                    {state.kpiTargetsMsg && <span className={`text-[10px] ${state.kpiTargetsMsg.startsWith('✓') ? 'text-emerald-600' : 'text-red-600'}`}>{state.kpiTargetsMsg}</span>}
                </div>
                <p className="mt-1 text-[10px] text-gray-400">Separati dal charter, non versionati. Alimentano il cruscotto Copertina.</p>
            </div>

            <button onClick={() => callbacks.setIsSettingsOpen(false)} className="w-full py-1.5 rounded bg-[#0f172a] text-white text-xs font-medium hover:bg-[#1e293b] cursor-pointer">
                Chiudi
            </button>
        </div>
    </div>
)}
{state.isRichPartOpen && (
    <RichPartModal
        projectId={Number(id)}
        onClose={() => callbacks.setIsRichPartOpen(false)}
        onAdded={callbacks.load}
    />
)}
{state.showAcqModal && (
    
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <h3 className="mb-3 text-sm font-bold">Crea sotto-progetto</h3>

            <label className="block text-xs font-semibold text-gray-600">Tipo di sotto-progetto</label>
            <select value={state.acqKind} onChange={(e) => callbacks.setAcqKind(e.target.value)}
                className="mb-3 w-full rounded border px-2 py-1.5 text-sm">
                <option value="sotto_progetto">Sotto-progetto (generico)</option>
                <option value="pipeline">Pipeline operativa</option>
            </select>

            <label className="block text-xs font-semibold text-gray-600">Pipeline di default</label>
            <select value={state.acqPipeline} onChange={(e) => callbacks.setAcqPipeline(e.target.value)}
                className="mb-3 w-full rounded border px-2 py-1.5 text-sm">
                <option value="acquisition">Acquisizione Aziende (scouting → contatto → risultato)</option>
                <option value="">Nessuna (personalizzata)</option>
            </select>

            <label className="block text-xs font-semibold text-gray-600">Nome sotto-progetto</label>
            <input value={state.acqName} onChange={(e) => callbacks.setAcqName(e.target.value)}
                placeholder="Acquisizione Aziende" className="mb-3 w-full rounded border px-2 py-1.5 text-sm" />
            <label className="block text-xs font-semibold text-gray-600">Alias email (opzionale)</label>
            <div className="mb-4 flex items-center gap-1">
                <input value={state.acqAlias} onChange={(e) => callbacks.setAcqAlias(e.target.value)}
                    placeholder={String(state.project!.id) + '-acq'} className="w-full rounded border px-2 py-1.5 text-sm" />
                <span className="text-xs text-gray-500">@v6sviluppoimpresa.it</span>
            </div>
            {state.acqError && <p className="mb-2 text-xs text-red-600">{state.acqError}</p>}
            <div className="flex justify-end gap-2">
                <button onClick={() => callbacks.setShowAcqModal(false)} className="rounded px-3 py-1.5 text-xs text-gray-600">Annulla</button>
                <button onClick={async () => {
                    callbacks.setAcqError(null); callbacks.setAcqBusy(true);
                    try {
                        const res = await fetch(`/api/admin/partner-projects/${state.project!.id}/start-acquisition`, {
                            method: 'POST', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                name: state.acqName,
                                emailAlias: state.acqAlias,
                                kind: state.acqKind,
                                pipelineTemplate: state.acqPipeline || null,
                            }),
                        });
                        const j = await res.json();
                        if (!res.ok) throw new Error(j.error || 'Errore');
                        callbacks.setShowAcqModal(false);
                        callbacks.load(); // ricarica per vedere il figlio nell'albero
                    } catch (e: any) { callbacks.setAcqError(e.message); }
                    finally { callbacks.setAcqBusy(false); }
                }} disabled={state.acqBusy || !state.acqName.trim()}
                    className="rounded bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
                    {state.acqBusy ? 'Creazione…' : 'Crea'}
                </button>
            </div>
        </div>
    </div>
)}

{state.isRelationScoutingOpen && state.project && (
    <RelationScoutingPanel
        relationId={state.project.id}
        relationName={state.project.name}
        scouting={state.project.relationScouting ?? null}
        onClose={() => callbacks.setIsRelationScoutingOpen(false)}
        onSaved={(s) => callbacks.setProject((p) => p ? { ...p, relationScouting: s } : p)}
    />
)}

{state.liveCallOpen && state.liveCallPartnerId && (
    <LiveCallDrawer
        partnerId={state.liveCallPartnerId}
        partnerName={state.liveCallPartnerName}
        relationId={state.project?.id}
        scouting={partnerScouting[state.liveCallPartnerId] ?? null}
        onClose={() => { callbacks.setLiveCallOpen(false); callbacks.setLiveCallPartnerId(null); }}
        onScoutingUpdated={(s) => callbacks.setPartnerScouting(prev => ({ ...prev, [state.liveCallPartnerId!]: s }))}
        onEnd={(info) => {
            const pid = state.liveCallPartnerId;
            callbacks.setLiveCallOpen(false);
            callbacks.setLiveCallPartnerId(null);
            callbacks.setLastCallEnd({ callId: info.callId, durationSeconds: info.durationSeconds, partnerId: pid });
        }}
    />
)}

{state.detailPerson && (
    <PersonCard
        person={state.detailPerson}
        onClose={() => callbacks.setDetailPerson(null)}
        onOpenTarget={(tid, tname) => {
            callbacks.setOperativeContext({ type: 'target', id: tid, label: tname });
            callbacks.setDetailPerson(null);
        }}
        onOpenOperativa={() => {
            // apre l'operativa contestuale già selezionata
            callbacks.setDetailPerson(null);
        }}
    />
)}

{state.lastCallEnd && (
    <CallEndPanel
        callId={state.lastCallEnd.callId}
        durationSeconds={state.lastCallEnd.durationSeconds}
        partnerId={state.lastCallEnd.partnerId}
        onDegrade={() => callbacks.load()}
        onClose={() => callbacks.setLastCallEnd(null)}
        onOpenDebrief={(prefill) => {
            callbacks.setBriefType('debrief');
            callbacks.setBriefData(prefill);
            callbacks.setIsBriefModalOpen(true);
            callbacks.setLastCallEnd(null);
        }}
        onOpenEmail={(prefill) => {
            callbacks.setSubject(prefill.subject);
            callbacks.setMessage(prefill.body);
            callbacks.setIsEmailModalOpen(true);
            callbacks.setLastCallEnd(null);
        }}
    />
)}

    </>
  );
}
