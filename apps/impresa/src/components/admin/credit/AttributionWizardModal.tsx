'use client';

// 05/10/2026 (C-attribution-1e): modale nativa Next per conferma
// attribuzione. Sostituisce il vecchio bottone che apriva Odoo in
// nuova tab. Stesso dominio, stessa UI, un solo login.

import { useEffect, useState } from 'react';
import { X, Loader2, AlertCircle, Plus, Trash2, CheckCircle2 } from 'lucide-react';

type CoSigner = {
  partner_id: number | null;
  partner_name: string;
  pct: number;
  notes: string;
};

type Portfolio = {
  id: number;
  name: string;
  cedente_name: string | null;
  attribution_confirmed: boolean;
};

type Defaults = {
  verificato_righe: boolean;
  note_verifica: string;
  brought_by_partner_id: number | null;
  brought_by_partner_name: string | null;
  referral_id: number | null;
  referral_name: string | null;
  co_signer_lines: CoSigner[];
};

type SplitPreview = {
  portatore?: { name: string; pct: number };
  v6_struttura?: { pct: number; pct_lordo?: number; co_signer_detratti?: number };
  operativi?: Array<{ name: string; pct: number }>;
  co_segnalatori?: Array<{ name: string; pct: number }>;
  totale?: number;
  note?: string;
  error?: string;
};

type Props = {
  portfolioId: number;
  onClose: () => void;
  onSuccess: () => void;
};

function authHeaders(): Record<string, string> {
  try {
    const raw = localStorage.getItem('pi_session');
    const s = raw ? JSON.parse(raw) : null;
    return s?.token ? { Authorization: `JWT ${s.token}` } : {};
  } catch { return {}; }
}

export default function AttributionWizardModal({ portfolioId, onClose, onSuccess }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [split, setSplit] = useState<SplitPreview | null>(null);

  // Form state
  const [verificatoRighe, setVerificatoRighe] = useState(false);
  const [noteVerifica, setNoteVerifica] = useState('');
  const [broughtById, setBroughtById] = useState<number | null>(null);
  const [broughtByName, setBroughtByName] = useState('');
  const [referralId, setReferralId] = useState<number | null>(null);
  const [referralName, setReferralName] = useState('');
  const [coSigners, setCoSigners] = useState<CoSigner[]>([]);
  const [partnerSearch, setPartnerSearch] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true); setError(null);
      try {
        const r = await fetch(
          `/api/admin/credit-portfolios/${portfolioId}/attribution-wizard`,
          { headers: authHeaders() },
        );
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
        setPortfolio(j.portfolio);
        const d: Defaults = j.defaults;
        setVerificatoRighe(d.verificato_righe);
        setNoteVerifica(d.note_verifica || '');
        setBroughtById(d.brought_by_partner_id);
        setBroughtByName(d.brought_by_partner_name || '');
        setReferralId(d.referral_id);
        setReferralName(d.referral_name || '');
        setCoSigners(d.co_signer_lines || []);
        setSplit(j.split_preview || null);
      } catch (e: any) {
        setError(e.message || 'Errore caricamento');
      } finally {
        setLoading(false);
      }
    })();
  }, [portfolioId]);

  async function handleConfirm() {
    if (!verificatoRighe) {
      setError('Devi confermare di aver verificato le righe.');
      return;
    }
    if (!broughtById) {
      setError('Il portatore e\' obbligatorio.');
      return;
    }
    setSaving(true); setError(null);
    try {
      const r = await fetch(
        `/api/admin/credit-portfolios/${portfolioId}/attribution-wizard`,
        {
          method: 'POST',
          headers: { ...authHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({
            verificato_righe: true,
            note_verifica: noteVerifica,
            brought_by_partner_id: broughtById,
            referral_id: referralId,
            co_signer_lines: coSigners.filter(cs => cs.partner_id),
          }),
        },
      );
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      onSuccess();
    } catch (e: any) {
      setError(e.message || 'Errore salvataggio');
    } finally {
      setSaving(false);
    }
  }

  // Simple numeric input via prompt per portatore/referral
  // (evita di aggiungere una modale di ricerca partner complessa)
  function pickBroughtBy() {
    const s = prompt('ID partner portatore (o nome parziale):', broughtById ? String(broughtById) : '');
    if (!s) return;
    setBroughtById(Number(s));
    setBroughtByName(`Partner #${s}`);
  }
  function pickReferral() {
    const s = prompt('ID referral (o vuoto per annullare):', referralId ? String(referralId) : '');
    if (!s) { setReferralId(null); setReferralName(''); return; }
    setReferralId(Number(s));
    setReferralName(`Referral #${s}`);
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Conferma attribuzione</h2>
            {portfolio && (
              <p className="text-xs text-slate-500 mt-0.5">
                #{portfolio.id} · {portfolio.cedente_name || portfolio.name}
              </p>
            )}
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {loading && (
          <div className="p-8 flex items-center justify-center text-slate-500">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Caricamento…
          </div>
        )}

        {error && (
          <div className="m-4 p-3 bg-red-50 border border-red-200 rounded text-red-800 text-sm flex items-start gap-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>{error}</div>
          </div>
        )}

        {!loading && (
          <div className="p-6 space-y-6">

            {/* 1. Verifica */}
            <section>
              <h3 className="text-sm font-semibold text-slate-800 mb-2">1. Verifica estrazione</h3>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={verificatoRighe}
                  onChange={(e) => setVerificatoRighe(e.target.checked)}
                />
                Ho verificato le righe estratte dal PDF
              </label>
              <textarea
                value={noteVerifica}
                onChange={(e) => setNoteVerifica(e.target.value)}
                placeholder="Annotazioni sulla verifica (opzionale)…"
                rows={2}
                className="mt-2 w-full text-sm border border-slate-200 rounded px-2 py-1"
              />
            </section>

            {/* 2. Attribuzione */}
            <section>
              <h3 className="text-sm font-semibold text-slate-800 mb-2">2. Attribuzione</h3>
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="text-xs text-slate-500">Portatore <span className="text-red-500">*</span></label>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="flex-1 text-sm border border-slate-200 rounded px-2 py-1 bg-slate-50">
                      {broughtByName || <span className="text-amber-700 italic">Da assegnare</span>}
                    </span>
                    <button
                      type="button"
                      onClick={pickBroughtBy}
                      className="px-3 py-1 text-xs rounded border border-slate-300 hover:bg-slate-50"
                    >
                      Cambia
                    </button>
                  </div>
                  {broughtById && (
                    <p className="text-xs text-slate-400 mt-1">ID: {broughtById}</p>
                  )}
                </div>
                <div>
                  <label className="text-xs text-slate-500">Referral (opzionale)</label>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="flex-1 text-sm border border-slate-200 rounded px-2 py-1 bg-slate-50">
                      {referralName || '—'}
                    </span>
                    <button
                      type="button"
                      onClick={pickReferral}
                      className="px-3 py-1 text-xs rounded border border-slate-300 hover:bg-slate-50"
                    >
                      Cambia
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {/* 3. Co-segnalatori */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-slate-800">3. Co-segnalatori</h3>
                <button
                  type="button"
                  onClick={() => setCoSigners([...coSigners, { partner_id: null, partner_name: '', pct: 3.0, notes: '' }])}
                  className="text-xs px-2 py-1 rounded border border-slate-300 hover:bg-slate-50 flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Aggiungi
                </button>
              </div>
              {coSigners.length === 0 && (
                <p className="text-xs text-slate-500 italic">Nessun co-segnalatore</p>
              )}
              {coSigners.map((cs, idx) => (
                <div key={idx} className="flex items-center gap-2 mt-2">
                  <input
                    type="text"
                    placeholder="ID partner"
                    value={cs.partner_id || ''}
                    onChange={(e) => {
                      const v = e.target.value;
                      const copy = [...coSigners];
                      copy[idx] = { ...copy[idx], partner_id: v ? Number(v) : null };
                      setCoSigners(copy);
                    }}
                    className="w-24 text-sm border border-slate-200 rounded px-2 py-1"
                  />
                  <input
                    type="text"
                    placeholder="Nome"
                    value={cs.partner_name}
                    onChange={(e) => {
                      const copy = [...coSigners];
                      copy[idx] = { ...copy[idx], partner_name: e.target.value };
                      setCoSigners(copy);
                    }}
                    className="flex-1 text-sm border border-slate-200 rounded px-2 py-1"
                  />
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="10"
                    value={cs.pct}
                    onChange={(e) => {
                      const copy = [...coSigners];
                      copy[idx] = { ...copy[idx], pct: Number(e.target.value) };
                      setCoSigners(copy);
                    }}
                    className="w-20 text-sm border border-slate-200 rounded px-2 py-1"
                  />
                  <span className="text-xs text-slate-500">%</span>
                  <button
                    type="button"
                    onClick={() => setCoSigners(coSigners.filter((_, i) => i !== idx))}
                    className="p-1 text-red-500 hover:bg-red-50 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </section>

            {/* 4. Preview split */}
            {split && !split.error && (
              <section>
                <h3 className="text-sm font-semibold text-slate-800 mb-2">4. Split proposto (anteprima)</h3>
                <div className="bg-slate-50 border border-slate-200 rounded p-3 text-xs space-y-1">
                  {split.portatore && (
                    <div className="flex justify-between">
                      <span>Portatore: {split.portatore.name}</span>
                      <span className="tabular-nums">{split.portatore.pct}%</span>
                    </div>
                  )}
                  {split.operativi?.map((op, i) => (
                    <div key={i} className="flex justify-between">
                      <span>Operativo: {op.name}</span>
                      <span className="tabular-nums">{op.pct.toFixed(2)}%</span>
                    </div>
                  ))}
                  {split.v6_struttura && (
                    <div className="flex justify-between">
                      <span>V6 struttura</span>
                      <span className="tabular-nums">{split.v6_struttura.pct.toFixed(2)}%</span>
                    </div>
                  )}
                  {split.co_segnalatori?.map((cs, i) => (
                    <div key={i} className="flex justify-between text-slate-600">
                      <span>Co-segn: {cs.name}</span>
                      <span className="tabular-nums">{cs.pct.toFixed(2)}%</span>
                    </div>
                  ))}
                  <div className="flex justify-between font-semibold pt-1 border-t border-slate-200 mt-1">
                    <span>Totale</span>
                    <span className="tabular-nums">{split.totale?.toFixed(2)}%</span>
                  </div>
                  {split.note && <p className="text-slate-500 italic pt-1">{split.note}</p>}
                </div>
              </section>
            )}
          </div>
        )}

        {/* Footer */}
        {!loading && (
          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-200 bg-slate-50">
            <button onClick={onClose} className="px-4 py-2 text-sm rounded border border-slate-300 hover:bg-slate-100">
              Annulla
            </button>
            <button
              onClick={handleConfirm}
              disabled={saving || !verificatoRighe || !broughtById}
              className="px-4 py-2 text-sm rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {saving ? 'Salvataggio…' : 'Conferma attribuzione'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
