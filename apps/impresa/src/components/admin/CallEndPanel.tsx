"use client";
import { useEffect, useState } from "react";
import { X, Loader2, FileText, Zap, Mail, CheckCircle2 } from "lucide-react";

interface Sibling { id: number; name: string; }

export default function CallEndPanel({
  callId,
  durationSeconds,
  onClose,
  onOpenDebrief,
  onOpenEmail,
  onLeadGenerated,
}: {
  callId: number;
  durationSeconds: number;
  onClose: () => void;
  onOpenDebrief: (prefill: { objective: string; targetAudience: string; keyDeliverables: string; risksOrNotes: string }) => void;
  onOpenEmail: (prefill: { subject: string; body: string }) => void;
  onLeadGenerated?: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [partnerName, setPartnerName] = useState<string>("");
  const [outcomes, setOutcomes] = useState<{ id: number; body: string }[]>([]);
  const [notes, setNotes] = useState<{ id: number; body: string; promoted_to: string }[]>([]);
  const [siblings, setSiblings] = useState<Sibling[]>([]);
  const [selectedRel, setSelectedRel] = useState<number | "">("");
  const [selectedOutcomeId, setSelectedOutcomeId] = useState<number | "">("");
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [genOk, setGenOk] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`/api/admin/calls/${callId}/details`);
        const d = await r.json();
        if (d.success) {
          setPartnerName(d.call.partnerName || "");
          setNotes(d.call.notes || []);
          setOutcomes((d.call.notes || []).filter((n: any) => n.promoted_to === "outcome").map((n: any) => ({ id: n.id, body: n.body })));
          setSiblings(d.siblings || []);
          if ((d.siblings || []).length === 1) setSelectedRel(d.siblings[0].id);
        }
      } finally { setLoading(false); }
    })();
  }, [callId]);

  const durStr = `${String(Math.floor(durationSeconds / 60)).padStart(2, "0")}:${String(durationSeconds % 60).padStart(2, "0")}`;

  const buildDebrief = () => {
    const outTxt = outcomes.map((o) => `• ${o.body}`).join("\n") || "—";
    const attTxt = notes.filter((n) => n.promoted_to !== "outcome").slice(0, 5).map((n) => `• ${n.body}`).join("\n") || "—";
    return {
      objective: outcomes[0]?.body || `Call con ${partnerName}`,
      targetAudience: attTxt,
      keyDeliverables: outcomes.map((o) => o.body).join(" · "),
      risksOrNotes: `${notes.length} note totali, ${outcomes.length} sbocchi emersi`,
    };
  };

  const buildEmail = () => ({
    subject: `Riepilogo call con ${partnerName}`,
    body: `Ciao,\n\nriepilogo della call di oggi (${durStr}).\n\nPunti discussi:\n${notes.filter((n) => n.promoted_to !== "outcome").slice(0, 10).map((n) => `• ${n.body}`).join("\n") || "—"}\n\nProssimi passi:\n${outcomes.map((o) => `• ${o.body}`).join("\n") || "—"}\n\nA presto.`,
  });

  const generateLead = async () => {
    if (!selectedRel) return;
    setGenerating(true); setGenError(null);
    try {
      const body: any = { relationId: selectedRel };
      if (selectedOutcomeId) body.outcomeNoteId = selectedOutcomeId;
      const res = await fetch(`/api/admin/calls/${callId}/generate-lead`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.success) { setGenError(data.error); return; }
      setGenOk(data.leadId);
      onLeadGenerated?.();
    } finally { setGenerating(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
        <div className="border-b border-gray-100 px-5 py-3 flex items-center justify-between bg-gradient-to-r from-emerald-50 to-white rounded-t-xl">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={18} className="text-emerald-600" />
            <div>
              <h3 className="text-sm font-bold text-[#0f172a]">Call terminata · {durStr}</h3>
              <p className="text-[11px] text-gray-500">{partnerName} · {notes.length} note, {outcomes.length} sbocchi</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X size={18} /></button>
        </div>

        <div className="px-5 py-4 space-y-3">
          {loading ? (
            <div className="flex justify-center py-6"><Loader2 className="animate-spin text-gray-400" /></div>
          ) : (
            <>
              <button onClick={() => onOpenDebrief(buildDebrief())}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/40 text-left transition-colors">
                <FileText size={16} className="text-indigo-600 shrink-0" />
                <div className="flex-1">
                  <div className="text-xs font-semibold text-[#0f172a]">Compila Debrief</div>
                  <div className="text-[10px] text-gray-500">Pre-compilato da note e sbocchi</div>
                </div>
              </button>

              {outcomes.length > 0 && siblings.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Zap size={14} className="text-amber-600" />
                    <div className="text-xs font-semibold text-[#0f172a]">
                      {outcomes.length} sbocchi → genera lead
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <select value={selectedOutcomeId}
                      onChange={(e) => setSelectedOutcomeId(e.target.value ? parseInt(e.target.value) : "")}
                      className="w-full px-2 py-1.5 rounded border border-amber-200 text-xs bg-white">
                      <option value="">— scegli sbocco (opzionale) —</option>
                      {outcomes.map((o) => (
                        <option key={o.id} value={o.id}>{o.body.slice(0, 60)}{o.body.length > 60 ? "…" : ""}</option>
                      ))}
                    </select>
                    <select value={selectedRel}
                      onChange={(e) => setSelectedRel(e.target.value ? parseInt(e.target.value) : "")}
                      className="w-full px-2 py-1.5 rounded border border-amber-200 text-xs bg-white">
                      <option value="">— sotto-progetto destinazione —</option>
                      {siblings.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
                    </select>
                    <button onClick={generateLead} disabled={!selectedRel || generating}
                      className="w-full py-1.5 rounded bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold disabled:opacity-40 flex items-center justify-center gap-1.5">
                      {generating ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
                      {generating ? "Creo…" : "Genera lead in pipeline"}
                    </button>
                    {genError && <p className="text-[11px] text-red-600">{genError}</p>}
                    {genOk && <p className="text-[11px] text-emerald-700">✓ Lead #{genOk} creato</p>}
                  </div>
                </div>
              )}

              <button onClick={() => onOpenEmail(buildEmail())}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-gray-200 hover:border-emerald-300 hover:bg-emerald-50/40 text-left transition-colors">
                <Mail size={16} className="text-emerald-600 shrink-0" />
                <div className="flex-1">
                  <div className="text-xs font-semibold text-[#0f172a]">Manda email riepilogo</div>
                  <div className="text-[10px] text-gray-500">Pre-compilata con punti discussi + prossimi passi</div>
                </div>
              </button>
            </>
          )}
        </div>

        <div className="border-t border-gray-100 px-5 py-3 flex justify-end bg-gray-50 rounded-b-xl">
          <button onClick={onClose} className="px-3 py-1.5 rounded border border-gray-200 text-xs text-gray-600 hover:bg-white">
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
}
