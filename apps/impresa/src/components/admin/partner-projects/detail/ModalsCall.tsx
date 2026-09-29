// ═══════════════════════════════════════════════════════════════════
// ModalsCall — 3 modali legate a call/brief/presentazione.
// Estratto il 29/09/2026 (Refactor C, step C1.g.2) da:
//   app/admin/partner-projects/[id]/page.tsx
//
// Contiene:
//   - Modale Nuova Call Odoo Discuss (invita parti)
//   - Modale Brief/Debrief (compila → invia email)
//   - Overlay Presentazione (note live + full-screen)
//
// Props raggruppate in state/data/callbacks (pattern C1.e).
// ═══════════════════════════════════════════════════════════════════

// @ts-nocheck
// (file auto-generato da estrazione C1.g.2, tipizzazione in C1.h cleanup)

'use client';

import { FileText, Loader2, Send, Video } from 'lucide-react';

type Props = {
  state: any;
  data: any;
  callbacks: any;
};

export function ModalsCall({ state, data, callbacks }: Props) {
  return (
    <>
{state.isCreateCallModalOpen && (
    <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4" onClick={() => callbacks.setIsCreateCallModalOpen(false)}>
        <div className="bg-white rounded-lg shadow-2xl w-full max-w-md p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-[#0f172a]">Nuova Call Odoo Discuss</h3>
            <input
                type="text"
                placeholder="Oggetto della call"
                value={state.callSubject}
                onChange={(e) => callbacks.setCallSubject(e.target.value)}
                className="w-full px-3 py-1.5 rounded border border-gray-200 text-xs"
            />
            {data.partners.length > 0 && (
                <div>
                    <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1.5">Invita Parti</label>
                    <div className="space-y-1 max-h-32 overflow-y-auto border border-gray-100 rounded p-2">
                        {data.partners.map((p) => (
                            <label key={p.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-gray-50 rounded p-1">
                                <input
                                    type="checkbox"
                                    checked={state.callSelectedPartners.includes(p.id)}
                                    onChange={() =>
                                        callbacks.setCallSelectedPartners((prev) =>
                                            prev.includes(p.id) ? prev.filter((x) => x !== p.id) : [...prev, p.id]
                                        )
                                    }
                                    className="accent-emerald-600"
                                />
                                <span className="font-medium">{p.partnerName || p.name}</span>
                            </label>
                        ))}
                    </div>
                </div>
            )}
            {state.activeCallUrl && (
                <div className="text-xs bg-emerald-50 border border-emerald-200 rounded p-2 text-emerald-800 break-all">
                    Canale attivo: <a href={state.activeCallUrl} target="_blank" rel="noreferrer" className="underline">{state.activeCallUrl}</a>
                </div>
            )}
            <div className="flex items-center justify-end gap-2">
                <button onClick={() => callbacks.setIsCreateCallModalOpen(false)} className="px-3 py-1.5 rounded border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 cursor-pointer">Chiudi</button>
                <button
                    onClick={callbacks.handleCreateAndStartCall}
                    disabled={state.isGeneratingCall}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
                >
                    {state.isGeneratingCall ? <Loader2 size={12} className="animate-spin" /> : <Video size={12} />}
                    {state.isGeneratingCall ? 'Creazione...' : state.activeCallUrl ? 'Riapri Call' : 'Crea e Avvia'}
                </button>
            </div>
        </div>
    </div>
)}

{/* MODAL BRIEF/DEBRIEF: compila → invia come email a tutte le parti */}
{state.isBriefModalOpen && (
    <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4" onClick={() => callbacks.setIsBriefModalOpen(false)}>
        <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-[#0f172a]">
                {state.briefType === 'brief' ? '📋 Compila Brief' : '🔍 Compila Debrief'}
            </h3>
            <input type="text" placeholder={state.briefType === 'brief' ? 'Obiettivo del progetto' : 'Esito principale'} value={state.briefData.objective} onChange={(e) => callbacks.setBriefData((prev) => ({ ...prev, objective: e.target.value }))} className="w-full px-3 py-1.5 rounded border border-gray-200 text-xs" />
            <input type="text" placeholder={state.briefType === 'brief' ? 'Target audience' : 'Punti di attenzione emersi'} value={state.briefData.targetAudience} onChange={(e) => callbacks.setBriefData((prev) => ({ ...prev, targetAudience: e.target.value }))} className="w-full px-3 py-1.5 rounded border border-gray-200 text-xs" />
            <textarea placeholder={state.briefType === 'brief' ? 'Deliverables chiave' : 'Azioni correttive / follow-up'} value={state.briefData.keyDeliverables} onChange={(e) => callbacks.setBriefData((prev) => ({ ...prev, keyDeliverables: e.target.value }))} rows={3} className="w-full px-3 py-1.5 rounded border border-gray-200 text-xs resize-y" />
            <textarea placeholder="Rischi / Note" value={state.briefData.risksOrNotes} onChange={(e) => callbacks.setBriefData((prev) => ({ ...prev, risksOrNotes: e.target.value }))} rows={2} className="w-full px-3 py-1.5 rounded border border-gray-200 text-xs resize-y" />
            <div className="flex items-center justify-end gap-2 pt-1">
                <button onClick={() => callbacks.setIsBriefModalOpen(false)} className="px-3 py-1.5 rounded border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 cursor-pointer">Annulla</button>
                <button
                    onClick={async () => {
                        // Serializza i campi in testo (salta le righe vuote) → invia alle parti
                        const bodyText = [
                            `Obiettivo/Esito: ${state.briefData.objective}`,
                            `Target/Attenzioni: ${state.briefData.targetAudience}`,
                            `state.briefType===′brief′?′Deliverables′:′Follow−up′:{state.briefType === 'brief' ? 'Deliverables' : 'Follow-up'}:state.briefType===′brief′?′Deliverables′:′Follow−up′:{state.briefData.keyDeliverables}`,
                            `Note: ${state.briefData.risksOrNotes}`,
                        ].filter((l) => !l.endsWith(': ') && !l.endsWith(':')).join('\n');

                        const result = await callbacks.handleNoteSendEmail({
                            title: state.briefType === 'brief' ? `Brief – data.project?.name∣∣′′‘:‘Debrief–{data.project?.name || ''}` : `Debrief –data.project?.name∣∣′′‘:‘Debrief–{data.project?.name || ''}`,
                            body: bodyText,
                            note_type: state.briefType,
                        });
                        if (result.ok) {
                            callbacks.setIsBriefModalOpen(false);
                            callbacks.setBriefData({ objective: '', targetAudience: '', keyDeliverables: '', risksOrNotes: '' });
                        } else {
                            alert(result.text);
                        }
                    }}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded bg-[#0f172a] text-white text-xs font-semibold hover:bg-[#1e293b] cursor-pointer"
                >
                    <Send size={12} />
                    Salva e Invia alle Parti
                </button>
            </div>
        </div>
    </div>
)}

{/* MODALITÀ PRESENTAZIONE: overlay full-screen scuro per call/meeting.
    Default = slide info progetto. Overlay note = cattura + invio via email. */}
{state.isPresentationMode && (
    <div className="fixed inset-0 bg-[#0f172a] z-50 flex flex-col text-white">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
            <div>
                <h2 className="text-lg font-bold tracking-tight">{data.project?.name}</h2>
                <p className="text-xs text-white/50">Modalità Presentazione · {data.partners.length} parti collegate</p>
            </div>
            <div className="flex items-center gap-2">
                <button
                    onClick={() => callbacks.setActiveOverlayPanel(state.activeOverlayPanel === 'notes' ? null : 'notes')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold cursor-pointer transition-colors ${state.activeOverlayPanel === 'notes' ? 'bg-white text-[#0f172a]' : 'bg-white/10 text-white hover:bg-white/20'}`}
                >
                    <FileText size={13} /> Note Call
                </button>
                <button
                    onClick={() => { callbacks.setIsPresentationMode(false); callbacks.setActiveOverlayPanel(null); }}
                    className="px-3 py-1.5 rounded bg-red-600 text-white text-xs font-semibold hover:bg-red-700 cursor-pointer"
                >
                    Esci (✕)
                </button>
            </div>
        </div>

        <div className="flex-1 flex items-center justify-center p-8 overflow-hidden">
            {state.activeOverlayPanel === 'notes' ? (
                /* Pannello note call: cattura veloce, copia o invio alle parti */
                <div className="w-full max-w-2xl bg-white/5 border border-white/10 rounded-lg p-6 space-y-3 backdrop-blur">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-white/70">Note di Call</h3>
                    <textarea
                        value={state.callNoteText}
                        onChange={(e) => callbacks.setCallNoteText(e.target.value)}
                        rows={8}
                        placeholder="Annota i punti chiave della call..."
                        className="w-full bg-white/10 border border-white/20 rounded p-3 text-sm text-white placeholder-white/40 resize-y focus:outline-none focus:ring-1 focus:ring-white/40"
                    />
                    <div className="flex items-center justify-between">
                        <button
                            onClick={() => navigator.clipboard.writeText(state.callNoteText)}
                            className="px-3 py-1.5 rounded bg-white/10 text-xs font-medium hover:bg-white/20 cursor-pointer"
                        >
                            Copia negli appunti
                        </button>
                        <button
                            onClick={async () => {
                                const result = await callbacks.handleNoteSendEmail({
                                    title: `Note Call – ${data.project?.name || ''}`,
                                    body: state.callNoteText,
                                    note_type: 'call_notes',
                                });
                                if (result.ok) {
                                    callbacks.setCallNoteText('');
                                    callbacks.setActiveOverlayPanel(null);
                                } else {
                                    alert(result.text);
                                }
                            }}
                            disabled={!state.callNoteText.trim()}
                            className="flex items-center gap-1.5 px-4 py-1.5 rounded bg-emerald-600 text-xs font-semibold hover:bg-emerald-700 disabled:opacity-40 cursor-pointer"
                        >
                            <Send size={12} /> Invia come Email
                        </button>
                    </div>
                </div>
            ) : (
                /* Slide "copertina" del progetto: dati essenziali + chips parti */
                <div className="text-center space-y-4 max-w-xl">
                    <h1 className="text-3xl font-bold tracking-tight">{data.project?.name}</h1>
                    {data.project?.emailAlias && <p className="text-white/50 text-sm font-mono">{data.project.emailAlias}</p>}
                    <div className="flex items-center justify-center gap-6 text-sm text-white/70 pt-4">
                        <span>👥 {data.partners.length} parti</span>
                        <span>✉ {emails.length} email</span>
                        <span>📎 {documents.length} atti</span>
                    </div>
                    {data.partners.length > 0 && (
                        <div className="flex flex-wrap justify-center gap-2 pt-2">
                            {data.partners.map((p) => (
                                <span key={p.id} className="px-3 py-1 rounded-full bg-white/10 border border-white/15 text-xs">
                                    {p.partnerName || p.name}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    </div>
)}

    </>
  );
}
