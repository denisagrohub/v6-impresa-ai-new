"use client";
import { useEffect, useState } from "react";
import { X, Loader2, Mail, Phone, Building2, User, Save, MessageSquare, Calendar, FileText } from "lucide-react";

interface Person {
  id: number;
  name: string;
  partnerName?: string | null;
  partnerEmail?: string | null;
  contattoEmail?: string | null;
  funzione_progetto?: string | null;
  ruoloContatto?: string | null;
  partnerId?: number | null;
  fromTargetId?: number | null;
  fromTargetName?: string | null;
  fromTargetPartnerName?: string | null;
}

const FUNZIONE_LABEL: Record<string, string> = {
  committente: "🎯 Committente",
  partner_finanziario: "💰 Partner finanziario",
  intermediario: "🤝 Intermediario",
  consulente_operativo: "🛠️ Consulente operativo",
  referente_tecnico: "⚙️ Referente tecnico",
  fornitore: "📦 Fornitore",
  osservatore: "👁️ Osservatore",
  altro: "• Altro",
};

export default function PersonCard({
  person,
  onClose,
  onOpenTarget,
  onOpenOperativa,
}: {
  person: Person;
  onClose: () => void;
  onOpenTarget?: (targetId: number, targetName: string) => void;
  onOpenOperativa?: () => void;
}) {
  const [tab, setTab] = useState<'info' | 'storico'>('info');
  const [email, setEmail] = useState(person.partnerEmail || person.contattoEmail || "");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!person.partnerId) return;
      try {
        const r = await fetch(`/api/admin/partners/${person.partnerId}`);
        const d = await r.json();
        if (d.success && d.partner) {
          setEmail(d.partner.email || "");
          setPhone(d.partner.phone || "");
        }
      } catch {}
    })();
  }, [person.partnerId]);

  const save = async () => {
    if (!person.partnerId) return;
    setSaving(true); setError(null);
    try {
      const r = await fetch(`/api/admin/partners/${person.partnerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, phone }),
      });
      const d = await r.json();
      if (!d.success) { setError(d.error || "Errore"); return; }
      setSavedAt(new Date());
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  const displayName = person.partnerName || person.name;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>

        {/* HEADER */}
        <div className="border-b border-gray-100 px-5 py-3 flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
              <User size={18} className="text-indigo-600" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#0f172a]">{displayName}</h3>
              {person.funzione_progetto && (
                <p className="text-xs text-gray-500 mt-0.5">
                  {FUNZIONE_LABEL[person.funzione_progetto] || person.funzione_progetto}
                </p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X size={18} /></button>
        </div>

        {/* TABS */}
        <div className="flex border-b border-gray-100">
          <button onClick={() => setTab('info')}
            className={`flex-1 py-2 text-xs font-semibold transition-colors ${tab === 'info' ? 'text-indigo-700 border-b-2 border-indigo-500 bg-indigo-50/40' : 'text-gray-500 hover:text-gray-800'}`}>
            Info & contatti
          </button>
          <button onClick={() => setTab('storico')}
            className={`flex-1 py-2 text-xs font-semibold transition-colors ${tab === 'storico' ? 'text-indigo-700 border-b-2 border-indigo-500 bg-indigo-50/40' : 'text-gray-500 hover:text-gray-800'}`}>
            Storico
          </button>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto px-5 py-4 text-sm">
          {tab === 'info' && (
            <div className="space-y-4">
              {/* Collegamento al target */}
              {person.fromTargetId && (
                <div className="rounded-lg bg-sky-50 border border-sky-100 p-3 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-sky-700 mb-0.5">
                      Contatto di
                    </div>
                    <div className="text-sm font-semibold text-sky-900 flex items-center gap-1.5">
                      <Building2 size={13} /> {person.fromTargetPartnerName || person.fromTargetName}
                    </div>
                  </div>
                  {onOpenTarget && (
                    <button
                      onClick={() => { onOpenTarget(person.fromTargetId!, person.fromTargetPartnerName || person.fromTargetName || ''); onClose(); }}
                      className="px-3 py-1.5 rounded bg-sky-600 text-white text-xs font-semibold hover:bg-sky-700"
                    >
                      Apri target →
                    </button>
                  )}
                </div>
              )}

              {/* Email */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 mb-1 flex items-center gap-1">
                  <Mail size={11} /> Email
                </label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nome@azienda.it"
                  className="w-full px-3 py-2 rounded border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                />
              </div>

              {/* Telefono */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 mb-1 flex items-center gap-1">
                  <Phone size={11} /> Telefono
                </label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+39 ..."
                  className="w-full px-3 py-2 rounded border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                />
              </div>

              {/* Ruolo contatto (solo se target) */}
              {person.fromTargetId && person.ruoloContatto && (
                <div className="text-xs text-gray-600">
                  <span className="text-[11px] font-semibold text-gray-500">Ruolo: </span>
                  {person.ruoloContatto}
                </div>
              )}

              {error && <p className="text-xs text-red-600">{error}</p>}
              {savedAt && <p className="text-xs text-emerald-600">✓ Salvato alle {savedAt.toLocaleTimeString('it-IT')}</p>}
            </div>
          )}

          {tab === 'storico' && (
            <div className="space-y-3">
              <div className="text-xs text-gray-500 italic py-4 text-center">
                Storico email/call/note verra' integrato nel prossimo giro.
                Per ora apri l'operativa contestuale per vedere il flusso completo.
              </div>
              {onOpenOperativa && (
                <button
                  onClick={() => { onOpenOperativa(); onClose(); }}
                  className="w-full py-2 rounded border border-indigo-200 bg-indigo-50 text-indigo-700 text-xs font-semibold hover:bg-indigo-100 flex items-center justify-center gap-1.5"
                >
                  <MessageSquare size={12} /> Apri in operativa contestuale
                </button>
              )}
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="border-t border-gray-100 px-5 py-3 flex items-center justify-between bg-gray-50 rounded-b-xl">
          <div className="text-[11px] text-gray-500">
            {person.fromTargetId ? "Referente di un target" : "Persona del progetto"}
          </div>
          <div className="flex gap-2">
            {onOpenOperativa && !person.fromTargetId && (
              <button
                onClick={() => { onOpenOperativa(); onClose(); }}
                className="px-3 py-1.5 rounded border border-gray-200 text-xs text-gray-700 hover:bg-white flex items-center gap-1"
              >
                <MessageSquare size={11} /> Operativa
              </button>
            )}
            <button onClick={onClose} className="px-3 py-1.5 rounded border border-gray-200 text-xs text-gray-600 hover:bg-white">
              Chiudi
            </button>
            <button onClick={save} disabled={saving || !person.partnerId}
              className="px-3 py-1.5 rounded bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-40 flex items-center gap-1.5">
              {saving ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
              {saving ? "Salvo…" : "Salva"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
