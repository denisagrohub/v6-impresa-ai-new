'use client';

import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';

type PartnerOpt = { id: number; name: string };

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
          <h3 className="text-sm font-bold">Nuovo deal</h3>
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
            <SelectField
              label="Schema"
              value={form.schema_code}
              onChange={v => setForm({ ...form, schema_code: v })}
              options={[
                { value: 'TEE-ROLLING-001', label: 'TEE Rolling 12-24 mesi' },
              ]}
            />
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

        <div className="border-t px-5 py-3 flex justify-end gap-2 bg-gray-50">
          <button onClick={onClose} className="px-3 py-1.5 rounded border text-xs text-gray-700 hover:bg-white">
            Annulla
          </button>
          <button
            onClick={handleSubmit}
            disabled={busy}
            className="px-4 py-1.5 rounded bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1.5"
          >
            {busy && <Loader2 size={12} className="animate-spin" />}
            {busy ? 'Creo...' : 'Crea deal'}
          </button>
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
