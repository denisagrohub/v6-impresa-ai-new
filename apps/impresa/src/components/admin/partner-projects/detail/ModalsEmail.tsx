// ═══════════════════════════════════════════════════════════════════
// ModalsEmail — 3 modali legate al flusso email.
// Estratto il 29/09/2026 (Refactor C, step C1.g.1) da:
//   app/admin/partner-projects/[id]/page.tsx (righe 932-1114)
//
// Contiene:
//   - Composer email (destinatari, subject, body, flag, allegati)
//   - Modale sorgente allegato (PC vs Libreria)
//   - Modale libreria documenti (lazy load)
//
// Props raggruppate in state/data/callbacks (pattern C1.e).
// ═══════════════════════════════════════════════════════════════════

'use client';

import type { FormEvent } from 'react';
import { Loader2, Send, UploadCloud } from 'lucide-react';

type Props = {
  state: {
    isEmailModalOpen: boolean;
    subject: string;
    message: string;
    sending: boolean;
    sendResult: { ok: boolean; text: string } | null;
    extraEmails: string;
    selectedPartnerIds: number[];
    requiresSignature: boolean;
    requiresDocument: boolean;
    requiresAction: boolean;
    attachedFiles: any[];
    isSourceModalOpen: boolean;
    isLibraryModalOpen: boolean;
    libraryDocs: any[];
    loadingLibrary: boolean;
  };
  data: {
    partners: any[];
    targets: any[];
  };
  callbacks: {
    setIsEmailModalOpen: (v: boolean) => void;
    setSubject: (v: string) => void;
    setMessage: (v: string) => void;
    setRequiresSignature: (v: boolean) => void;
    setRequiresDocument: (v: boolean) => void;
    setRequiresAction: (v: boolean) => void;
    setExtraEmails: (v: string) => void;
    setAttachedFiles: (v: any[] | ((prev: any[]) => any[])) => void;
    setIsSourceModalOpen: (v: boolean) => void;
    setIsLibraryModalOpen: (v: boolean) => void;
    handleSend: (e: FormEvent) => Promise<boolean>;
    togglePartner: (id: number) => void;
  };
};

export function ModalsEmail({ state, data, callbacks }: Props) {
  return (
    <>
{state.isEmailModalOpen && (
    <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4" onClick={() => callbacks.setIsEmailModalOpen(false)}>
        <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-sm font-bold text-[#0f172a]">Nuova Email dal Progetto</h3>
                <button onClick={() => callbacks.setIsEmailModalOpen(false)} className="text-gray-400 hover:text-gray-800 cursor-pointer">✕</button>
            </div>

            <form
                onSubmit={async (e) => {
                    const ok = await callbacks.handleSend(e);
                    if (ok) callbacks.setIsEmailModalOpen(false); // chiudi solo se invio riuscito
                }}
                className="p-5 space-y-3 overflow-y-auto"
            >
                {/* Checkbox delle parti: destinatari curati dal progetto */}
                <div>
                    <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1.5">Parti Destinatarie</label>
                    {data.partners.length === 0 ? (
                        <p className="text-xs text-gray-400 italic">Nessuna parte collegata al progetto.</p>
                    ) : (
                        <div className="space-y-1 max-h-32 overflow-y-auto border border-gray-100 rounded p-2">
                            {data.partners.map((p) => (
                                <label key={p.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-gray-50 rounded p-1">
                                    <input
                                        type="checkbox"
                                        checked={state.selectedPartnerIds.includes(p.id)}
                                        onChange={() => callbacks.togglePartner(p.id)}
                                        className="accent-[#0f172a]"
                                    />
                                    <span className="font-medium text-[#0f172a]">{p.partnerName || p.name}</span>
                                </label>
                            ))}
                        </div>
                    )}
                </div>

                {/* Email extra libere (non presenti come parti) */}
                <input
                    type="text"
                    placeholder="Email extra (separate da virgola)"
                    value={state.extraEmails}
                    onChange={(e) => callbacks.setExtraEmails(e.target.value)}
                    className="w-full px-3 py-1.5 rounded border border-gray-200 text-xs"
                />

                <input required type="text" placeholder="Oggetto *" value={state.subject} onChange={(e) => callbacks.setSubject(e.target.value)} className="w-full px-3 py-1.5 rounded border border-gray-200 text-xs" />
                <textarea required placeholder="Messaggio *" value={state.message} onChange={(e) => callbacks.setMessage(e.target.value)} rows={6} className="w-full px-3 py-1.5 rounded border border-gray-200 text-xs resize-y" />

                {/* Flag semantici: alimentano il tracking dei pending (stesso contratto API dell'analisi heuristica) */}
                <div className="flex items-center gap-4 flex-wrap bg-[#f8fafc] border border-gray-100 rounded p-2">
                    <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                        <input type="checkbox" checked={state.requiresSignature} onChange={(e) => callbacks.setRequiresSignature(e.target.checked)} className="accent-amber-600" />
                        ✍️ Richiede Firma
                    </label>
                    <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                        <input type="checkbox" checked={state.requiresDocument} onChange={(e) => callbacks.setRequiresDocument(e.target.checked)} className="accent-blue-600" />
                        📄 Richiede Documenti
                    </label>
                    <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                        <input type="checkbox" checked={state.requiresAction} onChange={(e) => callbacks.setRequiresAction(e.target.checked)} className="accent-emerald-600" />
                        ⏳ Richiede Riscontro
                    </label>
                </div>

                {/* Allegati: chips rimovibili + due sorgenti (PC / Libreria) */}
                <div>
                    <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1.5">Allegati</label>
                    {state.attachedFiles.length > 0 && (
                        <div className="space-y-1 mb-2">
                            {state.attachedFiles.map((f, i) => (
                                <div key={i} className="flex items-center justify-between text-xs bg-gray-50 border border-gray-100 rounded px-2 py-1">
                                    <span className="truncate">{f.source === 'library' ? '📚 ' : '📎 '}{f.name}</span>
                                    <button type="button" onClick={() => callbacks.setAttachedFiles((prev) => prev.filter((_, idx) => idx !== i))} className="text-gray-400 hover:text-red-600 cursor-pointer">✕</button>
                                </div>
                            ))}
                        </div>
                    )}
                    <div className="flex items-center gap-2">
                        <label className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-gray-200 text-xs cursor-pointer hover:bg-gray-50">
                            <UploadCloud size={12} />
                            Da PC
                            <input
                                type="file"
                                className="hidden"
                                multiple
                                onChange={(e) => {
                                    const files = Array.from(e.target.files || []);
                                    if (files.length) {
                                        callbacks.setAttachedFiles((prev) => [
                                            ...prev,
                                            ...files.map((f) => ({ name: f.name, fileRaw: f, source: 'local' as const })),
                                        ]);
                                    }
                                    e.target.value = ''; // reset input per ri-selezionare lo stesso file
                                }}
                            />
                        </label>
                        <button
                            type="button"
                            onClick={() => callbacks.setIsSourceModalOpen(true)}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-gray-200 text-xs cursor-pointer hover:bg-gray-50"
                        >
                            📚 Da Libreria Progetto
                        </button>
                    </div>
                </div>

                {state.sendResult && (
                    <p className={`text-xs ${state.sendResult.ok ? 'text-emerald-600' : 'text-red-600'}`}>{state.sendResult.text}</p>
                )}

                <div className="flex items-center justify-end gap-2 pt-1">
                    <button type="button" onClick={() => callbacks.setIsEmailModalOpen(false)} className="px-3 py-1.5 rounded border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 cursor-pointer">
                        Annulla
                    </button>
                    <button
                        type="submit"
                        disabled={state.sending}
                        className="flex items-center gap-1.5 px-4 py-1.5 rounded bg-[#0f172a] text-white text-xs font-semibold hover:bg-[#1e293b] disabled:opacity-50 cursor-pointer"
                    >
                        {state.sending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                        {state.sending ? 'Invio...' : 'Invia Email'}
                    </button>
                </div>
            </form>
        </div>
    </div>
)}

{/* MODAL SORGENTE: выбора tra PC e Libreria (estendibile ad altre sorgenti) */}
{state.isSourceModalOpen && (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => callbacks.setIsSourceModalOpen(false)}>
        <div className="bg-white rounded-lg shadow-2xl w-full max-w-sm p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-[#0f172a]">Scegli la sorgente</h3>
            <button
                onClick={() => { callbacks.setIsSourceModalOpen(false); callbacks.setIsLibraryModalOpen(true); }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded border border-gray-200 text-xs font-medium hover:bg-gray-50 cursor-pointer"
            >
                📚 Libreria Progetto
            </button>
            <button onClick={() => callbacks.setIsSourceModalOpen(false)} className="w-full px-3 py-1.5 rounded text-xs text-gray-500 hover:bg-gray-50 cursor-pointer">Annulla</button>
        </div>
    </div>
)}

{/* MODAL LIBRERIA: lista lazy dei documenti già su Odoo → aggancio per id (no ri-upload) */}
{state.isLibraryModalOpen && (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => callbacks.setIsLibraryModalOpen(false)}>
        <div className="bg-white rounded-lg shadow-2xl w-full max-w-md max-h-[70vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-sm font-bold text-[#0f172a]">Libreria Progetto</h3>
                <button onClick={() => callbacks.setIsLibraryModalOpen(false)} className="text-gray-400 hover:text-gray-800 cursor-pointer">✕</button>
            </div>
            <div className="p-4 overflow-y-auto space-y-1">
                {state.loadingLibrary ? (
                    <div className="flex justify-center py-6"><Loader2 size={20} className="animate-spin text-gray-400" /></div>
                ) : state.libraryDocs.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">Nessun documento in libreria.</p>
                ) : (
                    state.libraryDocs.map((doc) => (
                        <button
                            key={doc.id}
                            onClick={() => {
                                callbacks.setAttachedFiles((prev) => [
                                    ...prev,
                                    { id: doc.id, name: doc.name, url: doc.url, source: 'library' as const },
                                ]);
                                callbacks.setIsLibraryModalOpen(false);
                            }}
                            className="w-full flex items-center justify-between text-left px-3 py-2 rounded border border-gray-100 hover:bg-gray-50 text-xs cursor-pointer"
                        >
                            <span className="truncate font-medium text-[#0f172a]">{doc.name}</span>
                            <span className="text-gray-400 ml-2">＋</span>
                        </button>
                    ))
                )}
            </div>
        </div>
    </div>
)}

{/* MODAL NUOVA CALL: oggetto + inviti → crea mail.channel su Odoo → popup */}

    </>
  );
}
