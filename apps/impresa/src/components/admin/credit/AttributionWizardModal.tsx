'use client';

// 05/10/2026 (C-attribution-1e/1f): modale nativa Next per conferma
// attribuzione. Sostituisce il bottone che apriva Odoo in nuova tab.

import { useEffect, useState } from 'react';
import { X, Loader2, AlertCircle, Plus, Trash2, CheckCircle2 } from 'lucide-react';
import PartnerAutocomplete, { PartnerValue } from './PartnerAutocomplete';

type CoSigner = {
  partner: PartnerValue;
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
  co_signer_lines: Array<{
    partner_id: number | null;
    partner_name: string;
    pct: number;
    notes: string;
  }>;
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
  mode?: 'confirm' | 'edit';  // 05/10/2026 (C-attribution-1g)
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

export default function AttributionWizardModal({ portfolioId, mode = 'confirm', onClose, onSuccess }: Props) {
  const isEdit = mode === 'edit';
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [split, setSplit] = useState<SplitPreview | null>(null);

  const [verificatoRighe, setVerificatoRighe] = useState(false);
  const [noteVerifica, setNoteVerifica] = useState('');
  const [broughtBy, setBroughtBy] = useState<PartnerValue>(null);
  const [referralId, setReferralId] = useState<number | null>(null);
  const [referralName, setReferralName] = useState('');
  const [coSigners, setCoSigners] = useState<CoSigner[]>([]);

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
        // 05/10/2026 (C-attribution-1f): il proxy Next inoltra la
        // risposta grezza di Odoo = {success, data}. Il payload utile
        // sta in data.defaults / data.split_preview.
        const payload = j.data || j;
        setPortfolio(payload.portfolio || null);
        const d: Defaults = payload.defaults || {
          verificato_righe: false,
          note_verifica: '',
          brought_by_partner_id: null,
          brought_by_partner_name: null,
          referral_id: null,
          referral_name: null,
          co_signer_lines: [],
        };
        setVerificatoRighe(!!d.verificato_righe);
        setNoteVerifica(d.note_verifica || '');
        setBroughtBy(
          d.brought_by_partner_id
            ? { id: d.brought_by_partner_id, name: d.brought_by_partner_name || '' }
            : null,
        );
        setReferralId(d.referral_id || null);
        setReferralName(d.referral_name || '');
        setCoSigners(
          (d.co_signer_lines || []).map((cs) => ({
            partner: cs.partner_id ? { id: cs.partner_id, name: cs.partner_name } : null,
            pct: cs.pct,
            notes: cs.notes || '',
          })),
        );
        setSplit(payload.split_preview || null);
      } catch (e: any) {
        setError(e.message || 'Errore caricamento');
      } finally {
        setLoading(false);
      }
    })();
  }, [portfolioId]);

  async function handleConfirm() {
    if (!isEdit && !verificatoRighe) {
      setError('Devi confermare di aver verificato le righe.');
      return;
    }
    if (!broughtBy) {
      setError("Il portatore e' obbligatorio.");
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
            confirmed_edit: isEdit,
            note_verifica: noteVerifica,
            brought_by_partner_id: broughtBy.id,
            referral_id: referralId,
            co_signer_lines: coSigners
              .filter((cs) => cs.partner)
              .map((cs) => ({
                partner_id: cs.partner!.id,
                pct: cs.pct,
                notes: cs.notes,
              })),
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

  function pickReferral() {
    const s = prompt('ID referral (o vuoto per annullare):', referralId ? String(referralId) : '');
    if (s === null) return;
    if (s === '') { setReferralId(null); setReferralName(''); return; }
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
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {isEdit ? 'Modifica attribuzione' : 'Conferma attribuzione'}
            </h2>
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
            {!isEdit && (
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
            )}

            <section>
              <h3 className="text-sm font-semibold text-slate-800 mb-2">{isEdit ? '1' : '2'}. Attribuzione</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-slate-500">Portatore <span className="text-red-500">*</span></label>
                  <div className="mt-1">
                    <PartnerAutocomplete
                      value={broughtBy}
                      onChange={setBroughtBy}
                      placeholder="Cerca portatore per nome, email o P.IVA…"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-500">Referral (opzionale)</label>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="flex-1 text-sm border border-slate-200 rounded px-2 py-1 bg-slate-50 truncate">
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

            <section>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-slate-800">{isEdit ? '2' : '3'}. Co-segnalatori</h3>
                <button
                  type="button"
                  onClick={() => setCoSigners([...coSigners, { partner: null, pct: 3.0, notes: '' }])}
                  className="text-xs px-2 py-1 rounded border border-slate-300 hover:bg-slate-50 flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Aggiungi
                </button>
              </div>
              {coSigners.length === 0 && (
                <p className="text-xs text-slate-500 italic">Nessun co-segnalatore</p>
              )}
              {coSigners.map((cs, idx) => (
                <div key={idx} className="flex items-start gap-2 mt-2">
                  <div className="flex-1 min-w-0">
                    <PartnerAutocomplete
                      value={cs.partner}
                      onChange={(p) => {
                        const copy = [...coSigners];
                        copy[idx] = { ...copy[idx], partner: p };
                        setCoSigners(copy);
                      }}
                      placeholder="Cerca partner…"
                    />
                  </div>
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
                    title="% fee V6"
                  />
                  <span className="text-xs text-slate-500 pt-2">%</span>
                  <button
                    type="button"
                    onClick={() => setCoSigners(coSigners.filter((_, i) => i !== idx))}
                    className="p-1.5 text-red-500 hover:bg-red-50 rounded mt-0.5"
                    title="Rimuovi"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </section>

            {split && !split.error && (
              <section>
                <h3 className="text-sm font-semibold text-slate-800 mb-2">{isEdit ? '3' : '4'}. Split proposto (anteprima)</h3>
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

        {!loading && (
          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-200 bg-slate-50">
            <button onClick={onClose} className="px-4 py-2 text-sm rounded border border-slate-300 hover:bg-slate-100">
              Annulla
            </button>
            <button
              onClick={handleConfirm}
              disabled={saving || (!isEdit && !verificatoRighe) || !broughtBy}
              className="px-4 py-2 text-sm rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {saving ? 'Salvataggio…' : (isEdit ? 'Salva modifiche' : 'Conferma attribuzione')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
