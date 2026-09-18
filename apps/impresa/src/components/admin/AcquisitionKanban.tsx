"use client";
import { useEffect, useState } from "react";
import { Loader2, Plus, Phone, X, Building2, User, Move, AlertCircle, ChevronDown } from "lucide-react";
import LiveCallDrawer from "./LiveCallDrawer";

interface Column { name: string; sequence: number; is_won: boolean; is_lost: boolean; }
interface Lead {
  id: number; name: string;
  partnerId: number | null; partnerName: string;
  partnerEmail: string | null; partnerPhone: string | null;
  contattoId: number | null; contattoName: string | null; contattoRole: string | null;
  settore: string | null;
  stageId: number | null; stageName: string | null;
  stagesByName: Record<string, number>;
  state: string;
}
interface RootProject { id: number; name: string; }

export default function AcquisitionKanban({ relationId, relationName }: {
  relationId: number; relationName: string;
}) {
  const [columns, setColumns] = useState<Column[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState<string | null>(null);
  const [addQuery, setAddQuery] = useState("");
  const [addResults, setAddResults] = useState<{ id: number; name: string }[]>([]);
  const [addNewName, setAddNewName] = useState("");
  const [addNewEmail, setAddNewEmail] = useState("");
  const [addBusy, setAddBusy] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const [callOpen, setCallOpen] = useState<{ partnerId: number; partnerName: string; leadId: number } | null>(null);
  const [moveOpen, setMoveOpen] = useState<Lead | null>(null);
  const [rootProjects, setRootProjects] = useState<RootProject[]>([]);
  const [moveBusy, setMoveBusy] = useState(false);

  const load = async () => {
    try {
      const res = await fetch(`/api/admin/acquisition/${relationId}/board`);
      const data = await res.json();
      if (!data.success) { setError(data.error || "Errore"); return; }
      setColumns(data.stages || []);
      setLeads(data.leads || []);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [relationId]);

  useEffect(() => {
    if (!addQuery.trim() || addQuery.length < 2) { setAddResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/admin/partners/search?q=${encodeURIComponent(addQuery.trim())}`);
        const d = await r.json();
        if (d.success) setAddResults(d.partners || []);
      } catch {}
    }, 250);
    return () => clearTimeout(t);
  }, [addQuery]);

  const leadsByCol = (colName: string) => leads.filter((l) => l.stageName === colName);

  const onDrop = async (colName: string) => {
    if (!draggedId) return;
    const lead = leads.find((l) => l.id === draggedId);
    if (!lead || lead.stageName === colName) { setDraggedId(null); setDragOverCol(null); return; }
    const stageId = lead.stagesByName[colName];
    if (!stageId) { setError(`Fase "${colName}" non configurata per ${lead.partnerName}`); setDraggedId(null); setDragOverCol(null); return; }

    // ottimistico
    setLeads((prev) => prev.map((l) => l.id === draggedId ? { ...l, stageName: colName, stageId } : l));

    try {
      const res = await fetch(`/api/admin/acquisition/leads/${draggedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stageId }),
      });
      const data = await res.json();
      if (!data.success) { setError(data.error); load(); }
    } catch (e: any) { setError(e.message); load(); }
    finally { setDraggedId(null); setDragOverCol(null); }
  };

  const addLead = async (mode: "existing" | "new") => {
    if (!addOpen) return;
    setAddBusy(true); setAddError(null);
    try {
      const body: any = {};
      if (mode === "existing" && addResults[0]) body.partnerId = addResults[0].id;
      else if (mode === "new") { body.name = addNewName; body.email = addNewEmail; }
      else { setAddError("Seleziona un'azienda o compila il nome"); setAddBusy(false); return; }

      const res = await fetch(`/api/admin/acquisition/${relationId}/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.success) { setAddError(data.error); return; }
      setAddOpen(null); setAddQuery(""); setAddResults([]); setAddNewName(""); setAddNewEmail("");
      load();
    } catch (e: any) { setAddError(e.message); }
    finally { setAddBusy(false); }
  };

  const openMove = async (lead: Lead) => {
    setMoveOpen(lead);
    setMoveBusy(true);
    try {
      const r = await fetch(`/api/admin/acquisition/leads/${lead.id}`);
      const d = await r.json();
      if (d.success) setRootProjects(d.siblings || []);
    } finally { setMoveBusy(false); }
  };

  const moveToProject = async (destParentId: number) => {
    if (!moveOpen) return;
    setMoveBusy(true);
    try {
      const res = await fetch(`/api/admin/acquisition/leads/${moveOpen.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destParentId }),
      });
      const data = await res.json();
      if (!data.success) { setError(data.error); return; }
      setMoveOpen(null);
      load();
    } finally { setMoveBusy(false); }
  };

  const setState = async (lead: Lead, state: string) => {
    try {
      await fetch(`/api/admin/acquisition/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state }),
      });
      load();
    } catch {}
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-gray-400" /></div>;

  if (columns.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 text-sm">
        Nessuna pipeline configurata. Crea un target per generare le fasi.
      </div>
    );
  }

  return (
    <div className="w-full">
      {error && (
        <div className="mb-3 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700 flex items-center gap-2">
          <AlertCircle size={14} /> {error}
          <button onClick={() => setError(null)} className="ml-auto"><X size={12} /></button>
        </div>
      )}

      <div className="flex gap-3 overflow-x-auto pb-4">
        {columns.map((col) => {
          const items = leadsByCol(col.name);
          const isOver = dragOverCol === col.name;
          return (
            <div key={col.name}
              onDragOver={(e) => { e.preventDefault(); setDragOverCol(col.name); }}
              onDragLeave={() => setDragOverCol(null)}
              onDrop={() => onDrop(col.name)}
              className={`shrink-0 w-64 rounded-xl border-2 transition-colors ${
                col.is_won ? "border-emerald-200 bg-emerald-50/40"
                : col.is_lost ? "border-red-100 bg-red-50/30"
                : isOver ? "border-indigo-400 bg-indigo-50/60"
                : "border-gray-200 bg-white"
              }`}>
              <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`text-[11px] font-bold uppercase tracking-wide ${
                    col.is_won ? "text-emerald-700" : col.is_lost ? "text-red-600" : "text-gray-700"}`}>
                    {col.name}
                  </span>
                  <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
                    {items.length}
                  </span>
                </div>
                {!col.is_won && !col.is_lost && (
                  <button onClick={() => setAddOpen(col.name)} className="text-gray-400 hover:text-indigo-600" title="Aggiungi target">
                    <Plus size={14} />
                  </button>
                )}
              </div>
              <div className="p-2 space-y-1.5 min-h-[80px]">
                {items.map((lead) => (
                  <div key={lead.id} draggable
                    onDragStart={() => setDraggedId(lead.id)}
                    onDragEnd={() => { setDraggedId(null); setDragOverCol(null); }}
                    className={`bg-white border border-gray-100 rounded p-2 text-xs cursor-grab active:cursor-grabbing hover:border-indigo-300 hover:shadow-sm transition-all ${
                      draggedId === lead.id ? "opacity-40" : ""
                    } ${lead.state === "bocciato" ? "opacity-60" : ""} ${lead.state === "promosso" ? "border-emerald-300 bg-emerald-50/30" : ""}`}>

                    <div className="font-semibold text-[#0f172a] flex items-center gap-1">
                      <Building2 size={11} className="text-gray-400 shrink-0" />
                      {lead.partnerName}
                    </div>

                    {lead.contattoName && (
                      <div className="text-[10px] text-gray-600 mt-0.5 flex items-center gap-1">
                        <User size={9} className="text-gray-400" />
                        {lead.contattoName}
                        {lead.contattoRole && <span className="text-gray-400">· {lead.contattoRole}</span>}
                      </div>
                    )}
                    {lead.settore && <div className="text-[10px] text-gray-500 mt-0.5">{lead.settore}</div>}

                    <div className="mt-1.5 flex items-center gap-1 text-gray-400">
                      <button onClick={() => setCallOpen({ partnerId: lead.partnerId!, partnerName: lead.partnerName, leadId: lead.id })}
                        disabled={!lead.partnerId}
                        className="hover:text-red-600 disabled:opacity-30" title="Avvia Live Call">
                        <Phone size={11} />
                      </button>

                      {/* Menu state */}
                      <div className="relative group">
                        <button className="hover:text-indigo-600" title="Stato target">
                          <ChevronDown size={11} />
                        </button>
                        <div className="hidden group-hover:block absolute left-0 top-full z-30 min-w-[130px] mt-0.5 bg-white border border-gray-200 rounded shadow-lg py-1 text-[10px]">
                          <button onClick={() => setState(lead, "attivo")} className="w-full text-left px-2 py-1 hover:bg-gray-50">⚪ Attivo</button>
                          <button onClick={() => setState(lead, "promosso")} className="w-full text-left px-2 py-1 hover:bg-emerald-50 text-emerald-700">✅ Promosso</button>
                          <button onClick={() => setState(lead, "bocciato")} className="w-full text-left px-2 py-1 hover:bg-red-50 text-red-700">❌ Bocciato</button>
                          <button onClick={() => setState(lead, "archiviato")} className="w-full text-left px-2 py-1 hover:bg-gray-50 text-gray-500">📦 Archivia</button>
                        </div>
                      </div>

                      <button onClick={() => openMove(lead)} className="ml-auto hover:text-indigo-600" title="Sposta ad altro progetto">
                        <Move size={11} />
                      </button>
                    </div>
                  </div>
                ))}
                {items.length === 0 && (
                  <p className="text-[10px] text-gray-300 italic text-center py-3">
                    {col.is_won || col.is_lost ? "—" : "Trascina qui"}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL + TARGET */}
      {addOpen !== null && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setAddOpen(null)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold mb-3">Aggiungi target alla pipeline</h3>

            <label className="block text-[10px] font-semibold text-gray-500 uppercase mb-1">Cerca esistente</label>
            <input value={addQuery} onChange={(e) => setAddQuery(e.target.value)}
              placeholder="Nome azienda…" className="w-full px-2 py-1.5 rounded border text-xs mb-2" />
            {addResults.length > 0 && (
              <div className="max-h-32 overflow-y-auto border rounded mb-2">
                {addResults.map((p) => (
                  <button key={p.id} onClick={() => { setAddResults([p]); setAddQuery(p.name); }}
                    className="w-full text-left px-2 py-1 text-xs hover:bg-gray-50 border-b border-gray-50 last:border-0">
                    {p.name}
                  </button>
                ))}
              </div>
            )}
            {addResults.length > 0 && (
              <button onClick={() => addLead("existing")} disabled={addBusy}
                className="w-full mb-3 py-1.5 rounded bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-40">
                {addBusy ? "…" : `Usa "${addResults[0].name}"`}
              </button>
            )}

            <div className="text-center text-[10px] text-gray-400 my-2">— oppure —</div>

            <label className="block text-[10px] font-semibold text-gray-500 uppercase mb-1">Crea nuova</label>
            <input value={addNewName} onChange={(e) => setAddNewName(e.target.value)}
              placeholder="Nome *" className="w-full px-2 py-1.5 rounded border text-xs mb-1" />
            <input value={addNewEmail} onChange={(e) => setAddNewEmail(e.target.value)}
              placeholder="Email (opzionale)" className="w-full px-2 py-1.5 rounded border text-xs mb-3" />

            {addError && <p className="text-xs text-red-600 mb-2">{addError}</p>}

            <div className="flex justify-end gap-2">
              <button onClick={() => setAddOpen(null)} className="px-3 py-1.5 text-xs text-gray-600">Annulla</button>
              <button onClick={() => addLead("new")} disabled={addBusy || !addNewName.trim()}
                className="px-3 py-1.5 rounded bg-[#0f172a] text-white text-xs font-semibold disabled:opacity-40">
                {addBusy ? "…" : "Crea + aggiungi"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL SPOSTA A PROGETTO ROOT */}
      {moveOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setMoveOpen(null)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold mb-1">Sposta "{moveOpen.partnerName}"</h3>
            <p className="text-[11px] text-gray-500 mb-3">
              Scegli un altro progetto root:
            </p>
            {moveBusy ? (
              <div className="flex justify-center py-4"><Loader2 className="animate-spin text-gray-400" size={16} /></div>
            ) : rootProjects.length === 0 ? (
              <p className="text-xs text-gray-400 italic py-3">Nessun altro progetto root.</p>
            ) : (
              <div className="space-y-1.5">
                {rootProjects.map((p) => (
                  <button key={p.id} onClick={() => moveToProject(p.id)}
                    className="w-full text-left px-3 py-2 rounded border border-gray-100 hover:bg-indigo-50 text-xs">
                    <span className="font-medium">{p.name}</span>
                  </button>
                ))}
              </div>
            )}
            <div className="flex justify-end mt-3">
              <button onClick={() => setMoveOpen(null)} className="px-3 py-1.5 text-xs text-gray-600">Annulla</button>
            </div>
          </div>
        </div>
      )}

      {callOpen && callOpen.partnerId && (
        <LiveCallDrawer
          partnerId={callOpen.partnerId}
          partnerName={callOpen.partnerName}
          relationId={relationId}
          leadId={callOpen.leadId}
          scouting={null}
          onClose={() => { setCallOpen(null); load(); }}
        />
      )}
    </div>
  );
}
