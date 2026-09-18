"use client";
import { useEffect, useRef, useState } from "react";
import { Phone, X, Send, Loader2, ArrowRight, Building2, Lightbulb, ClipboardList, Plus } from "lucide-react";
import type { ScoutingData } from "./ScoutingModal";

interface CallNote {
  id: number;
  body: string;
  captured_at: string;
  promoted_to: string;
  promoted_field: string | null;
}

// Sezioni scouting (duplicate intenzionalmente da ScoutingModal: vogliamo
// che il drawer sia autonomo e non accoppiato al modal)
const SECTIONS: { key: string; title: string; fields: [string, string][] }[] = [
  { key: "identita", title: "Identità", fields: [["settore", "Settore"], ["ateco", "Codice ATECO"], ["dipendenti", "Dipendenti"], ["sede", "Sede"], ["sito", "Sito web"], ["piva", "P.IVA"]] },
  { key: "finanza", title: "Finanza", fields: [["fatturatoMln", "Fatturato (Mln €)"], ["ebitdaPct", "EBITDA (%)"], ["dso", "DSO (gg)"], ["note", "Note finanziarie"]] },
  { key: "posizionamento", title: "Posizionamento", fields: [["clientiChiave", "Clienti chiave"], ["concorrenti", "Concorrenti"], ["puntiDoloranti", "Punti doloranti"]] },
  { key: "fit", title: "Fit", fields: [["founding", "Founding"], ["rolling12", "Rolling 12"], ["rolling24", "Rolling 24"], ["idoneita", "Idoneità / osservazioni"]] },
];

const PROMO_LABEL: Record<string, string> = {
  scouting_identita: "→ Identità",
  scouting_finanza: "→ Finanza",
  scouting_posizionamento: "→ Posizionamento",
  scouting_fit: "→ Fit",
  outcome: "→ Sbocco",
  none: "",
};

export default function LiveCallDrawer({
  partnerId,
  partnerName,
  relationId,
  leadId,
  scouting,
  onClose,
  onScoutingUpdated,
}: {
  partnerId: number;
  partnerName: string;
  relationId?: number;
  leadId?: number;
  scouting: ScoutingData | null;
  onClose: () => void;
  onScoutingUpdated?: (s: ScoutingData) => void;
}) {
  const [callId, setCallId] = useState<number | null>(null);
  const [starting, setStarting] = useState(true);
  const [notes, setNotes] = useState<CallNote[]>([]);
  const [draftNote, setDraftNote] = useState("");
  const [draftOutcome, setDraftOutcome] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [ending, setEnding] = useState(false);
  const [tab, setTab] = useState<"note" | "scouting" | "sbocchi">("note");
  const [promoMenuFor, setPromoMenuFor] = useState<number | null>(null);
  const [scoutingLocal, setScoutingLocal] = useState<ScoutingData | null>(scouting);
  const [elapsed, setElapsed] = useState(0);
  const notesEndRef = useRef<HTMLDivElement>(null);
  const startedAtRef = useRef<number>(Date.now());

  // 1) Avvia la call al mount
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/calls/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ partnerId, relationId, leadId }),
        });
        const data = await res.json();
        if (data.success) setCallId(data.callId);
      } finally {
        setStarting(false);
      }
    })();
  }, [partnerId, relationId, leadId]);

  // 2) Polling note ogni 5s
  useEffect(() => {
    if (!callId) return;
    let alive = true;
    const fetchNotes = async () => {
      try {
        const res = await fetch(`/api/admin/calls/${callId}/note`);
        const data = await res.json();
        if (alive && data.success) setNotes(data.notes || []);
      } catch {}
    };
    fetchNotes();
    const iv = setInterval(fetchNotes, 5000);
    return () => { alive = false; clearInterval(iv); };
  }, [callId]);

  // 3) Timer durata
  useEffect(() => {
    const iv = setInterval(() => setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000)), 1000);
    return () => clearInterval(iv);
  }, []);

  // 4) Scroll automatico alle nuove note
  useEffect(() => {
    notesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [notes.length]);

  const fmtDuration = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const ss = s % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  };

  const addNote = async (body: string, isOutcome = false) => {
    if (!callId || !body.trim()) return;
    setSavingNote(true);
    try {
      const res = await fetch(`/api/admin/calls/${callId}/note`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: body.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        if (isOutcome) setDraftOutcome("");
        else setDraftNote("");
        const r2 = await fetch(`/api/admin/calls/${callId}/note`);
        const d2 = await r2.json();
        if (d2.success) setNotes(d2.notes || []);
      }
    } finally {
      setSavingNote(false);
    }
  };

  const promoteNote = async (noteId: number, section: string, field: string) => {
    if (!callId) return;
    try {
      const res = await fetch(`/api/admin/calls/${callId}/promote-note`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteId, section, field, partnerId, mode: "append" }),
      });
      const data = await res.json();
      if (data.success) {
        setScoutingLocal(data.scouting);
        onScoutingUpdated?.(data.scouting);
        setPromoMenuFor(null);
        const r2 = await fetch(`/api/admin/calls/${callId}/note`);
        const d2 = await r2.json();
        if (d2.success) setNotes(d2.notes || []);
      }
    } catch {}
  };

  const endCall = async () => {
    if (!callId) return;
    setEnding(true);
    try {
      await fetch(`/api/admin/calls/${callId}/end`, { method: "POST" });
      onClose();
    } finally {
      setEnding(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div
        className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="border-b border-gray-100 px-4 py-3 flex items-center justify-between bg-gradient-to-r from-red-50 to-white">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
            </span>
            <div>
              <div className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                <Phone size={12} /> Live Call — {partnerName}
              </div>
              <div className="text-[10px] text-gray-500 font-mono">{fmtDuration(elapsed)}</div>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700" title="Chiudi senza terminare">
            <X size={18} />
          </button>
        </div>

        {/* TABS */}
        <div className="flex border-b border-gray-100">
          {([["note", "📝 Note"], ["scouting", "🏢 Scouting"], ["sbocchi", "💡 Sbocchi"]] as const).map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${tab === k ? "text-indigo-700 border-b-2 border-indigo-500 bg-indigo-50/40" : "text-gray-500 hover:text-gray-800"}`}>
              {label}
            </button>
          ))}
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto px-3 py-3">

          {/* TAB NOTE */}
          {tab === "note" && (
            <div className="space-y-2">
              {starting && <div className="flex justify-center py-4"><Loader2 className="animate-spin text-gray-400" size={18} /></div>}
              {notes.length === 0 && !starting && (
                <p className="text-xs text-gray-400 italic text-center py-6">
                  Nessuna nota ancora. Scrivi la prima qui sotto.
                </p>
              )}
              {notes.map((n) => (
                <div key={n.id} className="group bg-yellow-50 border border-yellow-200 rounded px-2.5 py-2 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="text-[10px] text-gray-400 font-mono mb-0.5">
                        {new Date(n.captured_at).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
                      </div>
                      <div className="text-gray-800 whitespace-pre-wrap">{n.body}</div>
                      {n.promoted_to && n.promoted_to !== "none" && (
                        <div className="mt-1 inline-flex items-center gap-1 text-[10px] text-indigo-700 bg-indigo-100 px-1.5 py-0.5 rounded">
                          {PROMO_LABEL[n.promoted_to] || n.promoted_to}
                          {n.promoted_field && <span className="font-mono">.{n.promoted_field}</span>}
                        </div>
                      )}
                    </div>
                    {(!n.promoted_to || n.promoted_to === "none") && (
                      <button
                        onClick={() => setPromoMenuFor(promoMenuFor === n.id ? null : n.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-indigo-600 hover:bg-indigo-50 rounded"
                        title="Promuovi a campo scouting"
                      >
                        <ArrowRight size={14} />
                      </button>
                    )}
                  </div>

                  {promoMenuFor === n.id && (
                    <div className="mt-2 bg-white border border-indigo-200 rounded p-2 text-[10px] space-y-1.5">
                      <div className="font-semibold text-gray-700 mb-1">Porta questa nota in…</div>
                      {SECTIONS.map((sec) => (
                        <div key={sec.key}>
                          <div className="text-gray-500 font-medium">{sec.title}</div>
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {sec.fields.map(([fkey, flabel]) => (
                              <button
                                key={fkey}
                                onClick={() => promoteNote(n.id, sec.key, fkey)}
                                className="px-1.5 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 rounded border border-indigo-100"
                              >
                                {flabel}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                      <button
                        onClick={() => promoteNote(n.id, "outcome", "text")}
                        className="w-full mt-1 px-2 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded border border-amber-200 font-medium"
                      >
                        💡 Segna come sbocco commerciale
                      </button>
                      <button onClick={() => setPromoMenuFor(null)} className="w-full text-gray-400 hover:text-gray-600 text-[10px] mt-0.5">Annulla</button>
                    </div>
                  )}
                </div>
              ))}
              <div ref={notesEndRef} />
            </div>
          )}

          {/* TAB SCOUTING */}
          {tab === "scouting" && (
            <div className="space-y-3 text-xs">
              {SECTIONS.map((sec) => (
                <div key={sec.key}>
                  <div className="text-[10px] font-bold text-gray-500 uppercase mb-1">{sec.title}</div>
                  <div className="space-y-1">
                    {sec.fields.map(([fkey, flabel]) => {
                      const val = (scoutingLocal as any)?.[sec.key]?.[fkey] || "";
                      return (
                        <div key={fkey} className="flex items-start gap-2 border-b border-gray-50 pb-1">
                          <span className="text-gray-500 w-32 shrink-0">{flabel}</span>
                          <span className={`flex-1 ${val ? "text-gray-900 font-medium" : "text-gray-300 italic"}`}>
                            {val || "—"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              <p className="text-[10px] text-gray-400 italic pt-2 border-t border-gray-100">
                I campi si popolano promuovendo le note (tab 📝).
              </p>
            </div>
          )}

          {/* TAB SBOCCHI */}
          {tab === "sbocchi" && (
            <div className="space-y-2 text-xs">
              <div className="flex gap-1.5">
                <input
                  value={draftOutcome}
                  onChange={(e) => setDraftOutcome(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); addNote(draftOutcome, true); } }}
                  placeholder="Nuovo sbocco emerso dalla call…"
                  className="flex-1 px-2 py-1.5 rounded border border-amber-200 text-xs focus:outline-none focus:ring-2 focus:ring-amber-300"
                />
                <button
                  onClick={() => addNote(draftOutcome, true)}
                  disabled={savingNote || !draftOutcome.trim()}
                  className="px-2.5 rounded bg-amber-500 hover:bg-amber-600 text-white disabled:opacity-40"
                >
                  <Plus size={14} />
                </button>
              </div>
              {notes.filter((n) => n.promoted_to === "outcome").length === 0 ? (
                <p className="text-[10px] text-gray-400 italic pt-2">
                  Nessuno sbocco ancora. Aggiungi o promuovi una nota dal tab 📝.
                </p>
              ) : (
                notes.filter((n) => n.promoted_to === "outcome").map((n) => (
                  <div key={n.id} className="bg-amber-50 border border-amber-200 rounded px-2.5 py-2">
                    <div className="text-[10px] text-gray-400 font-mono mb-0.5">
                      {new Date(n.captured_at).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                    <div className="text-gray-800">{n.body}</div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="border-t border-gray-100 px-3 py-3 space-y-2 bg-white">
          {tab === "note" && (
            <div className="flex gap-1.5">
              <input
                value={draftNote}
                onChange={(e) => setDraftNote(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); addNote(draftNote); } }}
                placeholder="Scrivi una nota e premi Invio…"
                disabled={!callId}
                className="flex-1 px-2 py-1.5 rounded border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
              <button
                onClick={() => addNote(draftNote)}
                disabled={savingNote || !draftNote.trim() || !callId}
                className="px-2.5 rounded bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-40"
              >
                {savingNote ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              </button>
            </div>
          )}
          <button
            onClick={endCall}
            disabled={ending || !callId}
            className="w-full py-2 rounded bg-red-600 hover:bg-red-700 text-white text-xs font-bold disabled:opacity-40"
          >
            {ending ? "Chiusura…" : "Termina call e salva"}
          </button>
        </div>
      </div>
    </div>
  );
}
