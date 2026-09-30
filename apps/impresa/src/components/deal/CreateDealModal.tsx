'use client';

import { useState, useEffect } from 'react';
import { X, Loader2, Check, ChevronRight, FileSignature } from 'lucide-react';

type PartnerOpt = { id: number; name: string };

type SchemaStep = {
    id: number; sequence: number; code: string; label: string;
    completionType: string; blocksDealState: boolean; requiresCodes: string;
    signerRoles: string; signatureProvider: string; signatureLevel: string;
};

type Schema = {
    id: number; code: string; name: string; version: number;
    applicabilityRules: any; description: string;
    steps?: SchemaStep[];
};

export function CreateDealModal({
  parentId, authToken, onClose, onCreated,
}: {
  parentId: number;
  authToken: string;
  onClose: () => void;
  onCreated: (dealId: number, projectId: number) => void;
}) {
  const [form, setForm] = useState({
    nome: '', seller: '', buyer: '',
    revenue_model: 'fee', schema_code: 'TEE-ROLLING-001',
    volume_month: 100000, unit: 'TEE',
    prezzo_base: 222.30, fee_pct: 4.5, durata_mesi: 12,
  });
  const [sellerResults, setSellerResults] = useState<PartnerOpt[]>([]);
  const [buyerResults, setBuyerResults] = useState<PartnerOpt[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 30/09/2026 (F2 B6): 3-step wizard con anteprima schema
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [schemas, setSchemas] = useState<Schema[]>([]);
  const [suggested, setSuggested] = useState<Schema | null>(null);
  const [selectedSchemaId, setSelectedSchemaId] = useState<number | null>(null);
  const [loadingSuggest, setLoadingSuggest] = useState(false);

  // Carica lista schemi al mount
  useEffect(() => {
    fetch('/api/admin/schemas', { headers: { Authorization: 'JWT ' + authToken } })
      .then(r => r.json())
      .then(d => setSchemas(d.schemas || []))
      .catch(() => {});
  }, [authToken]);

  // Suggerisci schema quando cambia revenue_model
  useEffect(() => {
    if (!form.revenue_model) return;
    setLoadingSuggest(true);
    const qs = new URLSearchParams({
      revenue_model: form.revenue_model,
      volume: String((form.volume_month || 0) * (form.durata_mesi || 12)),
    });
    fetch(`/api/admin/relations/${parentId}/suggest-schema?${qs}`, {
      headers: { Authorization: 'JWT ' + authToken },
    })
      .then(r => r.json())
      .then(d => {
        setSuggested(d.suggested || null);
        if (d.suggested && !selectedSchemaId) setSelectedSchemaId(d.suggested.id);
      })
      .catch(() => {})
      .finally(() => setLoadingSuggest(false));
  }, [form.revenue_model, form.volume_month, form.durata_mesi, parentId, authToken]);

  const selectedSchema = schemas.find(s => s.id === selectedSchemaId) || null;

  const goToPreview = async () => {
    // Carica dettagli schema con step
    if (selectedSchemaId) {
      try {
        const r = await fetch(`/api/admin/schemas/${selectedSchemaId}`, {
          headers: { Authorization: 'JWT ' + authToken },
        });
        const d = await r.json();
        if (d.schema) {
          // Merge
          setSchemas(prev => prev.map(s => s.id === d.schema.id ? d.schema : s));
          if (suggested?.id === d.schema.id) setSuggested(d.schema);
        }
      } catch { /* best effort */ }
    }
    setStep(2);
  };

  const roleLabel: Record<string, string> = {
    v6_admin: 'V6 (admin)',
    buyer: 'Compratore',
    seller: 'Venditore',
    consultant: 'Consulente',
    associate: 'Associate',
    all_participants: 'Tutti i participant',
    counterparty: 'Controparte',
    hera_comm: 'Hera Comm',
    esco_partner: 'ESCO',
  };

  const renderRoles = (csv: string) => {
    if (!csv) return <span className="text-gray-400 text-xs">—</span>;
    return csv.split(',').map(r => r.trim()).filter(Boolean).map(r => (
      <span key={r} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-indigo-50 text-indigo-700 mr-1">
        {roleLabel[r] || r}
      </span>
    ));
  };

  const searchPartner = async (q: string, setter: (r: PartnerOpt[]) => void) => {
    if (q.length < 2) { setter([]); return; }
    try {
      const r = await fetch('/api/admin/partners/search?q=' + encodeURIComponent(q), {
        headers: { Authorization: 'JWT ' + authToken },
      });
      const d = await r.json();
      setter((d.partners || d.results || []).slice(0, 8));
    } catch { setter([]); }
  };

  const handleSubmit = async () => {
    setError(null);
    if (!form.seller || !form.buyer) {
      setError('Venditore e compratore obbligatori');
      return;
    }
    const sId = parseInt(form.seller.split(' ')[0], 10);
    const bId = parseInt(form.buyer.split(' ')[0], 10);
    if (!sId || !bId) {
      setError('Seleziona venditore e compratore dall\'autocomplete');
      return;
    }
    setBusy(true);
    try {
      const r = await fetch('/api/admin/partner-projects/' + parentId + '/create-deal', {
        method: 'POST',
        headers: { Authorization: 'JWT ' + authToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: form.nome || null,
          seller_partner_id: sId,
          buyer_partner_id: bId,
          revenue_model: form.revenue_model,
          schema_code: form.schema_code,
          volume_month: form.volume_month,
          unit: form.unit,
          prezzo_base: form.prezzo_base,
          fee_pct: form.fee_pct,
          durata_mesi: form.durata_mesi,
        }),
      });
      const d = await r.json();
      if (!d.success) { setError(d.error || 'Errore'); return; }
      onCreated(d.deal_id, d.project_id);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="border-b px-5 py-3 flex items-center justify-between">
          <h3 className="text-sm font-bold">
            Nuovo deal
            <span className="ml-2 text-[10px] font-normal text-gray-500">
              Step {step} di 3
            </span>
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Nome (opzionale)</label>
            <input
              type="text"
              value={form.nome}
              onChange={e => setForm({ ...form, nome: e.target.value })}
              placeholder="Auto da seller → buyer"
              className="w-full px-3 py-1.5 rounded border text-sm"
            />
          </div>

          <PartnerField
            label="Venditore *"
            value={form.seller}
            onValue={v => setForm({ ...form, seller: v })}
            results={sellerResults}
            onSearch={q => searchPartner(q, setSellerResults)}
            onSelect={setSellerResults}
          />

          <PartnerField
            label="Compratore *"
            value={form.buyer}
            onValue={v => setForm({ ...form, buyer: v })}
            results={buyerResults}
            onSearch={q => searchPartner(q, setBuyerResults)}
            onSelect={setBuyerResults}
          />

          <div className="grid grid-cols-2 gap-3">
            <SelectField
              label="Modello"
              value={form.revenue_model}
              onChange={v => setForm({ ...form, revenue_model: v })}
              options={[
                { value: 'fee', label: 'Fee' },
                { value: 'spread', label: 'Spread' },
                { value: 'mixed', label: 'Misto' },
              ]}
            />
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Schema processo
                {loadingSuggest && <span className="ml-2 text-[10px] text-gray-400">(ricerco…)</span>}
              </label>
              <select
                value={selectedSchemaId || ''}
                onChange={e => {
                  const id = parseInt(e.target.value, 10);
                  setSelectedSchemaId(id || null);
                  const s = schemas.find(x => x.id === id);
                  if (s) setForm({ ...form, schema_code: s.code });
                }}
                className="w-full px-3 py-1.5 rounded border text-sm"
              >
                <option value="">— Seleziona —</option>
                {schemas.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.code} · v{s.version} · {s.name}
                    {suggested?.id === s.id ? ' (consigliato)' : ''}
                  </option>
                ))}
              </select>
              {suggested && suggested.id === selectedSchemaId && (
                <div className="mt-1 text-[10px] text-emerald-700 flex items-center gap-1">
                  <Check size={10} /> Suggerito automaticamente per questo deal
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <NumberField
              label="Volume/mese"
              value={form.volume_month}
              onChange={v => setForm({ ...form, volume_month: v })}
            />
            <TextField
              label="Unità"
              value={form.unit}
              onChange={v => setForm({ ...form, unit: v })}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <NumberField
              label="Prezzo base"
              step={0.01}
              value={form.prezzo_base}
              onChange={v => setForm({ ...form, prezzo_base: v })}
            />
            <NumberField
              label="Fee %"
              step={0.1}
              value={form.fee_pct}
              onChange={v => setForm({ ...form, fee_pct: v })}
            />
            <NumberField
              label="Durata"
              value={form.durata_mesi}
              onChange={v => setForm({ ...form, durata_mesi: v })}
            />
          </div>

          {error && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 p-2 rounded">
              {error}
            </div>
          )}
        </div>

        {/* STEP 2: anteprima schema + step + firme */}
        {step === 2 && selectedSchema && (
          <div className="px-5 py-4 border-t bg-gray-50 space-y-3">
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <FileSignature size={14} className="text-indigo-600" />
              <span className="font-semibold">Anteprima processo: {selectedSchema.code} v{selectedSchema.version}</span>
            </div>
            <div className="bg-white rounded border border-gray-200 divide-y divide-gray-100 max-h-80 overflow-y-auto">
              {(selectedSchema.steps || suggested?.steps || []).map((st, i) => (
                <div key={st.id} className="p-3 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold flex items-center justify-center">
                          {i + 1}
                        </span>
                        <span className="font-semibold text-[#1a2744]">{st.label}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                          {st.completionType}
                        </span>
                      </div>
                      {st.requiresCodes && (
                        <div className="text-[10px] text-gray-400 ml-7">
                          Si sblocca dopo: {st.requiresCodes.replace(/_/g, ' ')}
                        </div>
                      )}
                      {st.signerRoles && (
                        <div className="ml-7 mt-1 flex items-center gap-1 flex-wrap">
                          <span className="text-[10px] text-gray-500">Firma:</span>
                          {renderRoles(st.signerRoles)}
                          <span className="text-[10px] text-gray-400 ml-1">
                            · {st.signatureProvider}/{st.signatureLevel}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {(!selectedSchema.steps || selectedSchema.steps.length === 0) && (
                <div className="p-4 text-xs text-gray-400 text-center">
                  Schema senza step configurati.
                </div>
              )}
            </div>
            <div className="text-[10px] text-gray-500">
              Il deal verrà creato con questa checklist. Potrai modificare i singoli step dopo.
            </div>
          </div>
        )}

        {/* STEP 3: conferma */}
        {step === 3 && (
          <div className="px-5 py-4 border-t bg-emerald-50 space-y-2">
            <div className="text-xs font-semibold text-emerald-800 flex items-center gap-2">
              <Check size={14} /> Confermi la creazione?
            </div>
            <div className="text-[11px] text-emerald-700 space-y-0.5">
              <div>• Schema: <strong>{selectedSchema?.code || form.schema_code}</strong></div>
              <div>• Venditore → Compratore: <strong>{form.seller.split(' ').slice(1).join(' ') || '—'} → {form.buyer.split(' ').slice(1).join(' ') || '—'}</strong></div>
              <div>• Volume/mese: <strong>{form.volume_month} {form.unit}</strong> · Durata: <strong>{form.durata_mesi} mesi</strong></div>
              <div>• Prezzo base: <strong>{form.prezzo_base} €</strong> · Fee V6: <strong>{form.fee_pct}%</strong></div>
            </div>
          </div>
        )}

        <div className="border-t px-5 py-3 flex justify-between gap-2 bg-gray-50">
          <div>
            {step > 1 && (
              <button
                onClick={() => setStep((step - 1) as 1 | 2 | 3)}
                disabled={busy}
                className="px-3 py-1.5 rounded border text-xs text-gray-700 hover:bg-white"
              >
                ← Indietro
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} disabled={busy} className="px-3 py-1.5 rounded border text-xs text-gray-700 hover:bg-white">
              Annulla
            </button>
            {step === 1 && (
              <button
                onClick={goToPreview}
                disabled={!form.seller || !form.buyer || !selectedSchemaId}
                className="px-4 py-1.5 rounded bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1.5"
              >
                Avanti <ChevronRight size={12} />
              </button>
            )}
            {step === 2 && (
              <button
                onClick={() => setStep(3)}
                className="px-4 py-1.5 rounded bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 flex items-center gap-1.5"
              >
                Avanti <ChevronRight size={12} />
              </button>
            )}
            {step === 3 && (
              <button
                onClick={handleSubmit}
                disabled={busy}
                className="px-4 py-1.5 rounded bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1.5"
              >
                {busy && <Loader2 size={12} className="animate-spin" />}
                {busy ? 'Creo...' : 'Conferma e crea'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PartnerField({
  label, value, onValue, results, onSearch, onSelect,
}: {
  label: string;
  value: string;
  onValue: (v: string) => void;
  results: PartnerOpt[];
  onSearch: (q: string) => void;
  onSelect: (r: PartnerOpt[]) => void;
}) {
  return (
    <div className="relative">
      <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={e => { onValue(e.target.value); onSearch(e.target.value); }}
        placeholder="Cerca partner..."
        className="w-full px-3 py-1.5 rounded border text-sm"
      />
      {results.length > 0 && (
        <div className="absolute z-20 mt-1 w-full bg-white border rounded shadow-lg max-h-40 overflow-y-auto">
          {results.map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() => { onValue(p.id + ' — ' + p.name); onSelect([]); }}
              className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 border-b border-gray-100 last:border-0"
            >
              <span className="font-medium">{p.name}</span>
              <span className="ml-2 text-gray-400">#{p.id}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function NumberField({
  label, value, step, onChange,
}: {
  label: string;
  value: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
      <input
        type="number"
        step={step || 1}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value || '0'))}
        className="w-full px-3 py-1.5 rounded border text-sm"
      />
    </div>
  );
}

function TextField({
  label, value, onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-1.5 rounded border text-sm"
      />
    </div>
  );
}

function SelectField({
  label, value, onChange, options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-1.5 rounded border text-sm"
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}
